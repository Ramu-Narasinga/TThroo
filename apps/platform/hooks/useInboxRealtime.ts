"use client";

import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

/** Live-refresh callback whenever this user's inbox_items row set changes. */
export function useInboxRealtime(userId: string | undefined, onChange: () => void) {
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = (supabase.channel(`inbox:${userId}`) as any)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inbox_items", filter: `user_id=eq.${userId}` },
        () => onChange()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, onChange]);
}
