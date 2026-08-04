import { NextRequest, NextResponse } from 'next/server';
import { serverDB } from '@/database';
import { agentTasks, agentTaskReviewComments, repositories } from '@/database/schemas';
import { and, eq, desc } from 'drizzle-orm';
import { getDaemonRuntime } from '../../../_auth';
import { generateGithubAppJwt } from '@/lib/generate-github-app-jwt';
import { createInboxItem } from '@/database/models/inboxItem';

interface ReviewCommentInput {
  filename: string;
  startLine: number;
  endLine?: number;
  body: string;
  severity?: string;
}

async function generateInstallationToken(installationId: string): Promise<string> {
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${generateGithubAppJwt()}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );
  if (!res.ok) throw new Error(`Failed to generate installation token: ${res.status}`);
  const data = await res.json() as { token: string };
  return data.token;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let runtime: Awaited<ReturnType<typeof getDaemonRuntime>>;
  try {
    runtime = await getDaemonRuntime(req);
  } catch (errResponse) {
    return errResponse as NextResponse;
  }

  const { id: taskId } = await params;

  let body: { summary?: string; comments?: ReviewCommentInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { summary = '', comments = [] } = body;

  // Verify task belongs to this runtime
  const [reviewTask] = await serverDB
    .select({
      id: agentTasks.id,
      userId: agentTasks.userId,
      repositoryId: agentTasks.repositoryId,
      issueNumber: agentTasks.issueNumber,
      issueTitle: agentTasks.issueTitle,
      agentId: agentTasks.agentId,
    })
    .from(agentTasks)
    .where(and(eq(agentTasks.id, taskId), eq(agentTasks.runtimeId, runtime.id)))
    .limit(1);

  if (!reviewTask) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // Find the latest completed implementation task to get the branch name
  const [implTask] = await serverDB
    .select({ result: agentTasks.result })
    .from(agentTasks)
    .where(and(
      eq(agentTasks.repositoryId, reviewTask.repositoryId),
      eq(agentTasks.issueNumber, reviewTask.issueNumber!),
      eq(agentTasks.taskType, 'implementation'),
      eq(agentTasks.status, 'completed'),
    ))
    .orderBy(desc(agentTasks.completedAt))
    .limit(1);

  let branchName: string | null = null;
  if (implTask?.result) {
    try {
      const parsed = JSON.parse(implTask.result) as { branchName?: string };
      branchName = parsed.branchName ?? null;
    } catch { /* ignore */ }
  }

  // Fetch repository metadata
  const [repo] = await serverDB
    .select({ fullName: repositories.fullName, installationId: repositories.installationId })
    .from(repositories)
    .where(eq(repositories.id, reviewTask.repositoryId))
    .limit(1);

  if (!repo) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
  }

  const [owner, repoName] = repo.fullName.split('/');

  // Post to GitHub only if we have the branch name and a token
  let githubReviewId: number | null = null;
  const githubCommentIds: Map<number, number> = new Map(); // index → githubCommentId

  if (branchName && repo.installationId) {
    try {
      const token = await generateInstallationToken(repo.installationId);

      // Find the PR for this branch
      const prRes = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/pulls?head=${owner}:${branchName}&state=all&sort=updated&per_page=1`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
      );

      if (prRes.ok) {
        const prs = await prRes.json() as Array<{ number: number; head: { sha: string } }>;
        if (prs.length > 0) {
          const { number: prNumber, head: { sha: commitId } } = prs[0];

          // Build GitHub inline comments (only those with valid line numbers)
          const githubComments = comments
            .filter(c => c.startLine > 0)
            .map(c => ({ path: c.filename, line: c.startLine, body: c.body }));

          // Post the review with summary body + inline comments
          const reviewRes = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/pulls/${prNumber}/reviews`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                commit_id: commitId,
                event: 'COMMENT',
                body: summary,
                comments: githubComments,
              }),
            }
          );

          if (reviewRes.ok) {
            const reviewData = await reviewRes.json() as { id: number; comments?: Array<{ id: number; path: string; line: number }> };
            githubReviewId = reviewData.id;

            // Map each comment back by index (GitHub returns them in order)
            (reviewData.comments ?? []).forEach((gc, idx) => {
              githubCommentIds.set(idx, gc.id);
            });
          } else {
            const errBody = await reviewRes.text();
            console.error('[review-comments] GitHub review post failed:', reviewRes.status, errBody);
          }
        }
      }
    } catch (err) {
      // Non-fatal — still save comments to DB even if GitHub posting fails
      console.error('[review-comments] GitHub API error:', err);
    }
  }

  // Save to DB
  const rowsToInsert = [];

  // Summary row
  rowsToInsert.push({
    taskId,
    repositoryId: reviewTask.repositoryId,
    userId: reviewTask.userId,
    issueNumber: reviewTask.issueNumber,
    filename: '__summary__',
    startLine: 0,
    endLine: null,
    body: summary,
    severity: 'summary',
    authorType: 'agent',
    parentCommentId: null,
    githubCommentId: githubReviewId,
  });

  // Inline comment rows
  comments.forEach((c, idx) => {
    rowsToInsert.push({
      taskId,
      repositoryId: reviewTask.repositoryId,
      userId: reviewTask.userId,
      issueNumber: reviewTask.issueNumber,
      filename: c.filename,
      startLine: c.startLine,
      endLine: c.endLine ?? null,
      body: c.body,
      severity: c.severity ?? 'suggestion',
      authorType: 'agent',
      parentCommentId: null,
      githubCommentId: githubCommentIds.get(idx) ?? null,
    });
  });

  let saved;
  try {
    saved = await serverDB
      .insert(agentTaskReviewComments)
      .values(rowsToInsert)
      .returning();
  } catch (err) {
    console.error('[review-comments] DB insert failed:', err);
    return NextResponse.json({ error: 'Failed to save review comments' }, { status: 500 });
  }

  if (reviewTask.issueNumber && reviewTask.issueTitle) {
    await createInboxItem(serverDB, {
      userId: reviewTask.userId,
      type: 'review_requested',
      severity: 'attention',
      repositoryId: reviewTask.repositoryId,
      issueNumber: reviewTask.issueNumber,
      issueTitle: reviewTask.issueTitle,
      title: 'Code review ready',
      body: summary,
      agentId: reviewTask.agentId,
      details: { taskId, reviewCommentCount: comments.length },
    });
  }

  return NextResponse.json({ comments: saved }, { status: 201 });
}
