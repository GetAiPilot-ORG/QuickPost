import { useEffect, useState } from "react";
import ConversationThread from "@/components/instagram/ConversationThread";
import InboxConversationList from "@/components/instagram/InboxConversationList";
import LeadPanel from "@/components/instagram/LeadPanel";
import { useInbox } from "@/hooks/useInbox";
import { syncInstagramInbox } from "@/services/instagramApi";

export default function InstagramInbox() {
  const { conversations, loading, error, refresh } = useInbox();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const handleRefresh = async () => {
    setSyncing(true);
    try {
      await syncInstagramInbox();
    } catch (e) {
      console.warn('[INSTAPILOT] Manual sync warning:', e);
    } finally {
      setSyncing(false);
    }
    await refresh();
    setRefreshKey((prev) => prev + 1);
  };

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (!selectedId && conversations.length > 0) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  useEffect(() => {
    // Connect to Backend SSE for realtime updates (bypasses Supabase RLS)
    const streamUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/instapilot/stream`;
    const eventSource = new EventSource(streamUrl);
    
    eventSource.onmessage = (e) => {
      if (e.data === 'refresh') {
        handleRefresh();
      }
    };

    eventSource.onerror = (err) => {
      console.warn('[SSE] Reconnecting to stream...', err);
    };

    // Safety background poll every 4 seconds to guarantee sync
    const pollInterval = setInterval(() => {
      if (!document.hidden) {
        handleRefresh();
      }
    }, 4000);

    return () => {
      eventSource.close();
      clearInterval(pollInterval);
    };
  }, [refresh]);

  const selected = conversations.find((conversation) => conversation.id === selectedId);

  return (
    <div className="h-[calc(100vh-56px)] w-full bg-[var(--canvas)] p-3 flex flex-col overflow-hidden">
      {error ? (
        <div className="mb-2 shrink-0 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="mb-2 shrink-0 rounded-lg border border-black/10 bg-white p-2.5 text-xs text-[var(--slate)]">
          Loading inbox...
        </div>
      ) : null}
      <div className="flex-1 min-h-0 w-full grid grid-cols-1 xl:grid-cols-[300px_1fr_270px] gap-2.5 items-stretch">
        <InboxConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <ConversationThread
          conversationId={selectedId}
          refreshKey={refreshKey}
          onChanged={refresh}
        />
        <LeadPanel
          lead={selected?.instagram_leads?.[0] || selected?.lead_data}
          onRefresh={handleRefresh}
          syncing={syncing}
        />
      </div>
    </div>
  );
}
