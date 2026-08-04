"use client";

import { useCallback, useEffect, useState } from "react";
import { useCurrentUser } from "./useCurrentUser";
import { useInboxRealtime } from "./useInboxRealtime";
import { inboxClientService } from "@/service/inbox/client";

export function useUnreadInboxCount() {
  const { id: userId } = useCurrentUser();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    inboxClientService.unreadCount().then(setCount).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useInboxRealtime(userId, refresh);

  return count;
}
