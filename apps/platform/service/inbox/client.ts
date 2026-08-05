import { lambdaClient } from '@/lib/trpc/client/lambda';

export type InboxItemType =
  | 'task_completed'
  | 'task_failed'
  | 'agent_blocked'
  | 'new_comment'
  | 'review_requested';

export type InboxSeverity = 'info' | 'attention' | 'action_required';

export interface InboxItem {
  id: string;
  userId: string;
  type: InboxItemType;
  severity: InboxSeverity;
  repositoryId: string;
  repositoryFullName: string | null;
  issueBoardStateId: string | null;
  issueNumber: number;
  issueTitle: string;
  title: string;
  body: string | null;
  actorType: 'agent' | 'system';
  agentId: string | null;
  details: string | null;
  read: boolean;
  archived: boolean;
  createdAt: Date;
}

export class InboxClientService {
  list = async (): Promise<InboxItem[]> => {
    return lambdaClient.inbox.list.query() as Promise<InboxItem[]>;
  };

  listArchived = async (): Promise<InboxItem[]> => {
    return lambdaClient.inbox.listArchived.query() as Promise<InboxItem[]>;
  };

  unreadCount = async (): Promise<number> => {
    return lambdaClient.inbox.unreadCount.query() as Promise<number>;
  };

  markRead = async (id: string): Promise<InboxItem> => {
    return lambdaClient.inbox.markRead.mutate({ id }) as Promise<InboxItem>;
  };

  archive = async (id: string): Promise<InboxItem> => {
    return lambdaClient.inbox.archive.mutate({ id }) as Promise<InboxItem>;
  };

  unarchive = async (id: string): Promise<InboxItem> => {
    return lambdaClient.inbox.unarchive.mutate({ id }) as Promise<InboxItem>;
  };

  markAllRead = async (): Promise<{ success: boolean }> => {
    return lambdaClient.inbox.markAllRead.mutate() as Promise<{ success: boolean }>;
  };

  archiveAllRead = async (): Promise<{ success: boolean }> => {
    return lambdaClient.inbox.archiveAllRead.mutate() as Promise<{ success: boolean }>;
  };
}

export const inboxClientService = new InboxClientService();
