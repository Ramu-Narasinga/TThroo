import { pgTable, uuid, text, integer, boolean, timestamp, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { repositories } from './repository';
import { issueBoardStates } from './issueBoardState';

// Notification feed for agent-driven events on a user's issues (task completed/failed,
// agent needs input, agent commented, agent finished a code review). Recipient is always
// the resource owner (userId) — this app has no separate assignee-user to notify yet, so
// self-triggered events (status/priority changes the human made themselves) are not
// written here. See apps/platform inbox implementation plan for the full event mapping.
export const inboxItems = pgTable('inbox_items', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: uuid('user_id').notNull(),

  // 'task_completed' | 'task_failed' | 'agent_blocked' | 'new_comment' | 'review_requested'
  type: text('type').notNull(),
  // 'info' | 'attention' | 'action_required'
  severity: text('severity').notNull().default('info'),

  repositoryId: uuid('repository_id').references(() => repositories.id, { onDelete: 'cascade' }).notNull(),
  issueBoardStateId: uuid('issue_board_state_id').references(() => issueBoardStates.id, { onDelete: 'cascade' }),
  issueNumber: integer('issue_number').notNull(),
  issueTitle: text('issue_title').notNull(),

  title: text('title').notNull(),
  body: text('body'),
  actorType: text('actor_type').notNull().default('agent'), // 'agent' | 'system'
  agentId: uuid('agent_id'),
  details: text('details'), // JSON-encoded

  read: boolean('read').notNull().default(false),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy('inbox_items_select', {
    as: 'permissive', for: 'select', to: ['authenticated'],
    using: sql`(auth.uid() = ${table.userId})`,
  }),
  pgPolicy('inbox_items_update', {
    as: 'permissive', for: 'update', to: ['authenticated'],
    using: sql`(auth.uid() = ${table.userId})`,
  }),
]);
