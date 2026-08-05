import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { authedProcedure, router } from '@/lib/trpc/lambda';
import { serverDatabase } from '@/lib/trpc/lambda/middleware';
import { inboxItems, repositories } from '@/database/schemas';
import type { ThinkThrooDatabase } from '@/database/type';

const inboxProcedure = authedProcedure.use(serverDatabase);

async function loadOwnedItem(db: ThinkThrooDatabase, userId: string, id: string) {
  const [item] = await db
    .select()
    .from(inboxItems)
    .where(and(eq(inboxItems.id, id), eq(inboxItems.userId, userId)))
    .limit(1);
  if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Inbox item not found' });
  return item;
}

export const inboxRouter = router({
  list: inboxProcedure.query(({ ctx }) =>
    ctx.serverDB
      .select({ item: inboxItems, repositoryFullName: repositories.fullName })
      .from(inboxItems)
      .leftJoin(repositories, eq(repositories.id, inboxItems.repositoryId))
      .where(and(eq(inboxItems.userId, ctx.userId), eq(inboxItems.archived, false)))
      .orderBy(desc(inboxItems.createdAt))
      .then((rows) => rows.map((r) => ({ ...r.item, repositoryFullName: r.repositoryFullName })))
  ),

  listArchived: inboxProcedure.query(({ ctx }) =>
    ctx.serverDB
      .select({ item: inboxItems, repositoryFullName: repositories.fullName })
      .from(inboxItems)
      .leftJoin(repositories, eq(repositories.id, inboxItems.repositoryId))
      .where(and(eq(inboxItems.userId, ctx.userId), eq(inboxItems.archived, true)))
      .orderBy(desc(inboxItems.createdAt))
      .limit(200)
      .then((rows) => rows.map((r) => ({ ...r.item, repositoryFullName: r.repositoryFullName })))
  ),

  unreadCount: inboxProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.serverDB
      .select({ count: sql<number>`count(*)::int` })
      .from(inboxItems)
      .where(
        and(
          eq(inboxItems.userId, ctx.userId),
          eq(inboxItems.read, false),
          eq(inboxItems.archived, false)
        )
      );
    return row?.count ?? 0;
  }),

  markRead: inboxProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await loadOwnedItem(ctx.serverDB, ctx.userId, input.id);
      const [updated] = await ctx.serverDB
        .update(inboxItems)
        .set({ read: true })
        .where(and(eq(inboxItems.id, input.id), eq(inboxItems.userId, ctx.userId)))
        .returning();
      return updated;
    }),

  archive: inboxProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await loadOwnedItem(ctx.serverDB, ctx.userId, input.id);
      const [updated] = await ctx.serverDB
        .update(inboxItems)
        .set({ archived: true })
        .where(and(eq(inboxItems.id, input.id), eq(inboxItems.userId, ctx.userId)))
        .returning();
      return updated;
    }),

  unarchive: inboxProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await loadOwnedItem(ctx.serverDB, ctx.userId, input.id);
      const [updated] = await ctx.serverDB
        .update(inboxItems)
        .set({ archived: false })
        .where(and(eq(inboxItems.id, input.id), eq(inboxItems.userId, ctx.userId)))
        .returning();
      return updated;
    }),

  markAllRead: inboxProcedure.mutation(async ({ ctx }) => {
    await ctx.serverDB
      .update(inboxItems)
      .set({ read: true })
      .where(
        and(
          eq(inboxItems.userId, ctx.userId),
          eq(inboxItems.read, false),
          eq(inboxItems.archived, false)
        )
      );
    return { success: true };
  }),

  archiveAllRead: inboxProcedure.mutation(async ({ ctx }) => {
    await ctx.serverDB
      .update(inboxItems)
      .set({ archived: true })
      .where(
        and(
          eq(inboxItems.userId, ctx.userId),
          eq(inboxItems.read, true),
          eq(inboxItems.archived, false)
        )
      );
    return { success: true };
  }),
});

export type InboxRouter = typeof inboxRouter;
