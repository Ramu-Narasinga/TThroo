import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { serverDB } from '@/database';
import { agentTasks, issueComments, issueBoardStates, repositories } from '@/database/schemas';
import { createServiceRoleClient } from '@/utils/supabase/service-role';
import { getDaemonRuntime } from '../../../_auth';
import { enqueueForAgentByName } from '@/lib/enqueueForAgent';
import { createInboxItem } from '@/database/models/inboxItem';

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

  let body: { body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { body: commentBody } = body;
  if (!commentBody || typeof commentBody !== 'string') {
    return NextResponse.json({ error: 'body is required' }, { status: 400 });
  }

  const { id } = await params;

  // Verify task belongs to this runtime and get context needed for the comment
  const [task] = await serverDB
    .select({
      id: agentTasks.id,
      userId: agentTasks.userId,
      repositoryId: agentTasks.repositoryId,
      issueNumber: agentTasks.issueNumber,
      issueTitle: agentTasks.issueTitle,
      agentId: agentTasks.agentId,
    })
    .from(agentTasks)
    .where(and(eq(agentTasks.id, id), eq(agentTasks.runtimeId, runtime.id)))
    .limit(1);

  if (!task || !task.issueNumber) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const [comment] = await serverDB
    .insert(issueComments)
    .values({
      repositoryId: task.repositoryId,
      issueNumber: task.issueNumber,
      userId: task.userId,
      authorType: 'agent',
      agentTaskId: task.id,
      body: commentBody,
    })
    .returning();

  // Broadcast so the UI updates in real time
  const supabase = createServiceRoleClient();
  await supabase.channel(`issue-comments:${task.repositoryId}:${task.issueNumber}`).httpSend('new-comment', { comment });

  if (task.issueTitle) {
    await createInboxItem(serverDB, {
      userId: task.userId,
      type: 'new_comment',
      severity: 'info',
      repositoryId: task.repositoryId,
      issueNumber: task.issueNumber,
      issueTitle: task.issueTitle,
      title: 'New comment',
      body: commentBody,
      agentId: task.agentId,
      details: { commentId: comment.id, taskId: task.id },
    });
  }

  // Squad delegation: when the leader agent posts a comment on a squad-assigned issue,
  // scan for @AgentName mentions and auto-queue tasks for matched agents.
  try {
    const [boardState] = await serverDB
      .select({ assigneeSquadId: issueBoardStates.assigneeSquadId, issueTitle: issueBoardStates.issueTitle, issueHtmlUrl: issueBoardStates.issueHtmlUrl })
      .from(issueBoardStates)
      .where(
        and(
          eq(issueBoardStates.repositoryId, task.repositoryId),
          eq(issueBoardStates.issueNumber, task.issueNumber!),
          eq(issueBoardStates.userId, task.userId)
        )
      )
      .limit(1);

    if (boardState?.assigneeSquadId) {
      const mentions = [...commentBody.matchAll(/@([\w][\w\s-]*[\w]|[\w]+)/g)].map((m) => m[1].trim());
      if (mentions.length > 0) {
        const [repo] = await serverDB
          .select({ fullName: repositories.fullName, installationId: repositories.installationId })
          .from(repositories)
          .where(eq(repositories.id, task.repositoryId))
          .limit(1);

        if (repo) {
          for (const name of mentions) {
            await enqueueForAgentByName(serverDB, {
              agentName: name,
              repositoryId: task.repositoryId,
              repoFullName: repo.fullName,
              repoInstallationId: repo.installationId,
              issueNumber: task.issueNumber!,
              issueTitle: boardState.issueTitle ?? '',
              issueHtmlUrl: boardState.issueHtmlUrl ?? null,
              userId: task.userId,
            }).catch(() => {/* best-effort */});
          }
        }
      }
    }
  } catch {
    // Non-fatal — squad delegation is best-effort
  }

  return NextResponse.json({ ok: true, commentId: comment.id });
}
