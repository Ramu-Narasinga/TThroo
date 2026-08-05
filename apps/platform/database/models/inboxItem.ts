import { serverDB } from '@/database';
import { inboxItems } from '@/database/schemas';

type DB = typeof serverDB;

/** Best-effort inbox write — never throws, so callers never need try/catch. */
export async function createInboxItem(
  db: DB,
  item: {
    userId: string;
    type: string;
    severity?: 'info' | 'attention' | 'action_required';
    repositoryId: string;
    issueBoardStateId?: string | null;
    issueNumber: number;
    issueTitle: string;
    title: string;
    body?: string | null;
    agentId?: string | null;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await db.insert(inboxItems).values({
      userId: item.userId,
      type: item.type,
      severity: item.severity ?? 'info',
      repositoryId: item.repositoryId,
      issueBoardStateId: item.issueBoardStateId ?? null,
      issueNumber: item.issueNumber,
      issueTitle: item.issueTitle,
      title: item.title,
      body: item.body ?? null,
      agentId: item.agentId ?? null,
      details: item.details ? JSON.stringify(item.details) : null,
    });
  } catch (err) {
    console.error('[inbox] createInboxItem failed', err);
  }
}
