import { useCallback, useEffect, useState } from "react";
import { fetchInboxConversations } from "@/services/instagramApi";

export function useInbox() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError(null);
    try {
      setConversations(await fetchInboxConversations());
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to load inbox");
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(true);
  }, [refresh]);

  return { conversations, loading, error, refresh };
}
