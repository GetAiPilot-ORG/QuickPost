import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import ConversationThread from "@/components/instagram/ConversationThread";
import InboxConversationList from "@/components/instagram/InboxConversationList";
import LeadPanel from "@/components/instagram/LeadPanel";
import { Button } from "@/components/ui/button";
import { useInbox } from "@/hooks/useInbox";
import { supabase } from "@/lib/supabase";

export default function InstagramInbox() {
  const { conversations, loading, error, refresh } = useInbox();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = async () => {
    await refresh();
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    // Connect to Backend SSE for realtime updates (bypasses Supabase RLS)
    const eventSource = new EventSource(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/instapilot/stream`);
    
    eventSource.onmessage = (e) => {
      if (e.data === 'refresh') {
        handleRefresh();
      }
    };

    return () => {
      eventSource.close();
    };
  }, [refresh]);

  const selected = conversations.find((conversation) => conversation.id === selectedId);

  return (
    <div className="min-h-full bg-[var(--canvas)] px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--arc)]">GAP InstaPilot</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-[var(--ink)]">Instagram Inbox</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild className="gap-2">
              <Link to="/dashboard/instapilot?mode=builder">
                <ArrowLeft className="h-4 w-4" />
                Builder
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={handleRefresh} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </header>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
        {loading ? <div className="rounded-lg border border-black/10 bg-white p-4 text-sm text-[var(--slate)]">Loading inbox...</div> : null}
        <div className="grid gap-5 xl:grid-cols-[320px_1fr_280px]">
          <InboxConversationList conversations={conversations} selectedId={selectedId} onSelect={setSelectedId} />
          <ConversationThread conversationId={selectedId} refreshKey={refreshKey} onChanged={refresh} />
          <LeadPanel lead={selected?.instagram_leads?.[0] || selected?.lead_data} />
        </div>
      </div>
    </div>
  );
}
