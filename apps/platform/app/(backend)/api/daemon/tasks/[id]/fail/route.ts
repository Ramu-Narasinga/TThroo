import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { serverDB } from '@/database';
import { agentTasks } from '@/database/schemas';
import { getDaemonRuntime } from '../../../_auth';
import { updateBoardKanbanStatus } from '@/database/models/issueBoardState';
import { createInboxItem } from '@/database/models/inboxItem';

const RETRYABLE_REASONS = ['runtime_offline', 'timeout'];
const MAX_ATTEMPTS = 2;

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

  let body: { reason?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { reason, message } = body;
  if (!reason || typeof reason !== 'string') {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }

  const { id } = await params;

  const [failed] = await serverDB
    .update(agentTasks)
    .set({
      status: 'failed',
      completedAt: new Date(),
      failureReason: reason,
      failureMessage: message ?? null,
      waitReason: null,
    })
    .where(
      and(
        eq(agentTasks.id, id),
        eq(agentTasks.runtimeId, runtime.id),
        inArray(agentTasks.status, ['running', 'dispatched', 'waiting_local_directory'])
      )
    )
    .returning();

  if (!failed) {
    return NextResponse.json({ error: 'Task not found or invalid status' }, { status: 404 });
  }

  let retryTask = null;
  const isRetryable = RETRYABLE_REASONS.includes(reason);
  if (isRetryable && failed.attemptCount < MAX_ATTEMPTS) {
    const [newTask] = await serverDB
      .insert(agentTasks)
      .values({
        agentId: failed.agentId,
        runtimeId: failed.runtimeId,
        repositoryId: failed.repositoryId,
        userId: failed.userId,
        issueNumber: failed.issueNumber,
        issueTitle: failed.issueTitle,
        issueBody: failed.issueBody,
        issueHtmlUrl: failed.issueHtmlUrl,
        status: 'queued',
        sessionId: failed.sessionId,
        workDir: failed.workDir,
        attemptCount: failed.attemptCount + 1,
        priority: failed.priority,
      })
      .returning();
    retryTask = newTask;
  }

  if (failed.taskType === 'implementation') {
    try {
      await updateBoardKanbanStatus(serverDB, {
        repositoryId: failed.repositoryId,
        issueNumber: failed.issueNumber,
        kanbanStatus: 'blocked',
      });
    } catch {
      // Board sync is best-effort — do not fail the task failure handler
    }
  }

  if (failed.issueNumber && failed.issueTitle) {
    await createInboxItem(serverDB, {
      userId: failed.userId,
      type: 'task_failed',
      severity: 'action_required',
      repositoryId: failed.repositoryId,
      issueNumber: failed.issueNumber,
      issueTitle: failed.issueTitle,
      title: 'Task failed',
      body: message ?? reason,
      agentId: failed.agentId,
      details: { taskId: failed.id, reason, retrying: Boolean(retryTask) },
    });
  }

  return NextResponse.json({ task: failed, retryTask });
}
