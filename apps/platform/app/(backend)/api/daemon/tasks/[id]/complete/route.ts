import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { serverDB } from '@/database';
import { agentTasks } from '@/database/schemas';
import { getDaemonRuntime } from '../../../_auth';
import { updateBoardKanbanStatus } from '@/database/models/issueBoardState';
import { createInboxItem } from '@/database/models/inboxItem';

interface TaskResult {
  prUrl?: string;
  summary?: string;
  branchName?: string;
  phase?: 'planning' | 'question';
  question?: string;
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

  let body: { result?: TaskResult };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { result } = body;
  if (!result || typeof result !== 'object') {
    return NextResponse.json({ error: 'result is required' }, { status: 400 });
  }

  const { id } = await params;

  const isPausedOnQuestion = result.phase === 'question';

  const [updated] = await serverDB
    .update(agentTasks)
    .set({
      status: isPausedOnQuestion ? 'waiting_for_user' : 'completed',
      completedAt: new Date(),
      result: JSON.stringify(result),
    })
    .where(
      and(
        eq(agentTasks.id, id),
        eq(agentTasks.runtimeId, runtime.id),
        eq(agentTasks.status, 'running')
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Task not found or not in running state' }, { status: 404 });
  }

  // Planning-task completions are intentionally left in the 'planning' column — the
  // human decides when to drag the card to 'todo' to kick off implementation.
  if (updated.taskType === 'implementation') {
    try {
      await updateBoardKanbanStatus(serverDB, {
        repositoryId: updated.repositoryId,
        issueNumber: updated.issueNumber,
        kanbanStatus: isPausedOnQuestion ? 'waiting_for_user' : 'in_review',
      });
    } catch {
      // Board sync is best-effort — do not fail the task completion
    }
  }

  if (updated.issueNumber && updated.issueTitle) {
    await createInboxItem(serverDB, {
      userId: updated.userId,
      type: isPausedOnQuestion ? 'agent_blocked' : 'task_completed',
      severity: isPausedOnQuestion ? 'action_required' : 'info',
      repositoryId: updated.repositoryId,
      issueNumber: updated.issueNumber,
      issueTitle: updated.issueTitle,
      title: isPausedOnQuestion ? 'Agent needs your input' : 'Task completed',
      body: isPausedOnQuestion ? result.question ?? null : result.summary ?? null,
      agentId: updated.agentId,
      details: { taskId: updated.id, ...result },
    });
  }

  return NextResponse.json(updated);
}
