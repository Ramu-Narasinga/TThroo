"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  GitPullRequest,
  Inbox as InboxIcon,
  Loader2,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { Button } from "@thinkthroo/ui/components/button";
import { Badge } from "@thinkthroo/ui/components/badge";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInboxRealtime } from "@/hooks/useInboxRealtime";
import {
  inboxClientService,
  InboxItem,
  InboxItemType,
} from "@/service/inbox/client";

type View = "inbox" | "archived";

const TYPE_ICON: Record<InboxItemType, React.ReactNode> = {
  task_completed: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  task_failed: <XCircle className="h-4 w-4 text-red-600" />,
  agent_blocked: <MessageSquare className="h-4 w-4 text-amber-600" />,
  new_comment: <MessageSquare className="h-4 w-4 text-blue-600" />,
  review_requested: <GitPullRequest className="h-4 w-4 text-purple-600" />,
};

const SEVERITY_VARIANT: Record<InboxItem["severity"], "outline" | "secondary" | "destructive"> = {
  info: "outline",
  attention: "secondary",
  action_required: "destructive",
};

export default function InboxPage() {
  const router = useRouter();
  const { id: userId } = useCurrentUser();
  const [view, setView] = useState<View>("inbox");
  const [items, setItems] = useState<InboxItem[]>([]);
  const [archivedItems, setArchivedItems] = useState<InboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [active, archived] = await Promise.all([
        inboxClientService.list(),
        inboxClientService.listArchived(),
      ]);
      setItems(active);
      setArchivedItems(archived);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useInboxRealtime(userId, refresh);

  const visibleItems = view === "inbox" ? items : archivedItems;
  const unreadCount = useMemo(() => items.filter((i) => !i.read).length, [items]);

  const handleSelect = async (item: InboxItem) => {
    if (!item.read) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
      inboxClientService.markRead(item.id).catch(() => {});
    }
    if (item.repositoryFullName) {
      router.push(`/repositories/${item.repositoryFullName}/issues/${item.issueNumber}`);
    }
  };

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setBusyId(id);
    try {
      await inboxClientService.archive(id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleUnarchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setBusyId(id);
    try {
      await inboxClientService.unarchive(id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    await inboxClientService.markAllRead();
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inbox</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Updates from your agents — task results, comments, and reviews.
          </p>
        </div>
        {view === "inbox" && unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={handleMarkAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      <div className="mb-4 flex items-center gap-1 border-b">
        <button
          onClick={() => setView("inbox")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
            view === "inbox" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
          }`}
        >
          Inbox{unreadCount > 0 ? ` (${unreadCount})` : ""}
        </button>
        <button
          onClick={() => setView("archived")}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
            view === "archived" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
          }`}
        >
          Archived
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading inbox…
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
          <InboxIcon className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {view === "inbox" ? "You're all caught up." : "No archived notifications."}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleSelect(item)}
              className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 ${
                !item.read && view === "inbox" ? "bg-muted/20" : ""
              }`}
            >
              <div className="mt-0.5 shrink-0">{TYPE_ICON[item.type]}</div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className={`text-sm truncate ${!item.read && view === "inbox" ? "font-semibold" : "font-medium"}`}>
                    {item.title}
                  </p>
                  {item.severity !== "info" && (
                    <Badge variant={SEVERITY_VARIANT[item.severity]} className="shrink-0">
                      {item.severity === "action_required" ? "Action required" : "Attention"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {item.issueTitle} {item.repositoryFullName ? `· ${item.repositoryFullName}` : ""}
                </p>
                {item.body && (
                  <p className="text-xs text-muted-foreground/80 truncate">{item.body}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
                disabled={busyId === item.id}
                onClick={(e) => (view === "inbox" ? handleArchive(e, item.id) : handleUnarchive(e, item.id))}
              >
                {busyId === item.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : view === "inbox" ? (
                  <Archive className="h-3.5 w-3.5" />
                ) : (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
