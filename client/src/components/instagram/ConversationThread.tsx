import { useEffect, useState, useRef } from "react";
import { AlertTriangle, Bot, Pause, Play, Send, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  fetchConversationThread,
  sendManualInstagramReply,
  updateConversation,
} from "@/services/instagramApi";

export default function ConversationThread({ conversationId, refreshKey, onChanged }: { conversationId?: string; refreshKey?: number; onChanged: () => void }) {
  const [thread, setThread] = useState<any>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const load = async (isInitial = false) => {
    if (!conversationId) return;
    if (isInitial || !thread) setLoading(true);
    try {
      const nextThread = await fetchConversationThread(conversationId);
      setThread(nextThread);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Failed to load thread");
    } finally {
      if (isInitial || !thread) setLoading(false);
    }
  };

  useEffect(() => {
    load(true);
  }, [conversationId]);

  useEffect(() => {
    if (refreshKey) {
      load(false);
    }
  }, [refreshKey]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [thread?.messages?.length]);

  const send = async () => {
    if (!conversationId || !draft.trim()) return;
    try {
      await sendManualInstagramReply(conversationId, draft.trim());
      setDraft("");
      await load();
      onChanged();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Reply failed");
    }
  };

  const togglePause = async () => {
    if (!conversationId || !thread?.conversation) return;
    const shouldResume =
      thread.conversation.bot_paused ||
      thread.conversation.status === "human_needed" ||
      thread.conversation.status === "human_active";
    await updateConversation(conversationId, {
      bot_paused: !shouldResume,
      status: shouldResume ? "bot_active" : "human_active",
      failure_count: shouldResume ? 0 : thread.conversation.failure_count,
    });
    await load();
    onChanged();
  };

  if (!conversationId) {
    return (
      <section className="flex min-h-[560px] items-center justify-center rounded-lg border border-black/10 bg-white p-8 text-sm text-[var(--slate)] shadow-sm">
        Select a conversation.
      </section>
    );
  }

  const conversation = thread?.conversation;
  const displayName =
    conversation?.instagram_username ||
    conversation?.instagram_name ||
    (conversation?.instagram_user_id ? `IG user ${String(conversation.instagram_user_id).slice(-4)}` : "Instagram user");
  const shouldShowResume =
    conversation?.bot_paused ||
    conversation?.status === "human_needed" ||
    conversation?.status === "human_active";
  const needsHuman = conversation?.status === "human_needed";

  return (
    <section className={`rounded-lg border bg-white shadow-sm ${needsHuman ? "border-amber-300" : "border-black/10"}`}>
      <div className={`flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between ${needsHuman ? "border-amber-200 bg-amber-50" : "border-black/10"}`}>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--arc)]">
            {needsHuman ? "Action needed" : "Conversation"}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ${
              needsHuman ? "bg-amber-100 text-amber-700" : "bg-orange-50 text-[var(--arc)]"
            }`}>
              {conversation?.profile_pic_url ? (
                <img src={conversation.profile_pic_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-4 w-4" />
              )}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[var(--ink)]">{displayName}</h2>
              <p className="text-[11px] font-semibold text-[var(--slate)]">
                {conversation?.is_user_follow_business === true
                  ? "Follower"
                  : conversation?.is_user_follow_business === false
                    ? "Non-follower"
                    : "Follower unknown"}
                {needsHuman ? " / Needs your reply" : conversation?.bot_paused ? " / Bot paused" : " / Bot active"}
              </p>
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={togglePause}
          className={`gap-2 bg-white ${needsHuman ? "border-amber-300 text-amber-900 hover:bg-amber-100" : ""}`}
          disabled={!conversation}
        >
          {shouldShowResume ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          {shouldShowResume ? "Resume Bot" : "Pause Bot"}
        </Button>
      </div>

      <div className="h-[560px] overflow-y-auto bg-[var(--canvas)] p-5">
        {loading ? <p className="text-sm text-[var(--slate)]">Loading thread...</p> : null}
        {conversation?.status === "human_needed" ? (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <b>Human reply needed.</b> The bot paused because this message needs manual attention. Reply below, then resume the bot when you are ready.
            </div>
          </div>
        ) : null}
        <div className="space-y-3">
          {(thread?.messages || [])
            .filter((message: any, index: number, arr: any[]) => {
              if (index === 0) return true;
              const prev = arr[index - 1];
              if (message.id === prev.id) return false;
              if (
                message.direction === prev.direction &&
                message.message_text === prev.message_text &&
                Math.abs(new Date(message.created_at).getTime() - new Date(prev.created_at).getTime()) < 10000
              ) {
                return false;
              }
              return true;
            })
            .map((message: any) => (
            <div key={message.id} className={`flex gap-2 ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}>
              {message.direction === "inbound" ? <UserRound className="mt-2 h-4 w-4 text-[var(--slate)]" /> : null}
              <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-[13px] leading-6 shadow-sm ${
                message.direction === "outbound" ? "rounded-br-md bg-[#3797f0] text-white" : "rounded-bl-md bg-white text-[var(--ink)]"
              }`}>
                {message.message_text}
                <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold opacity-65">
                  {message.ai_generated ? <Bot className="h-3 w-3" /> : null}
                  {new Date(message.created_at).toLocaleString()}
                </div>
              </div>
              {message.direction === "outbound" ? <Bot className="mt-2 h-4 w-4 text-[var(--slate)]" /> : null}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="flex gap-2 border-t border-black/10 p-4">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") send();
          }}
          className="instapilot-input"
          placeholder="Reply manually through official Meta send API"
        />
        <Button type="button" onClick={send} size="icon" aria-label="Send reply" className="bg-[#3797f0] text-white hover:bg-[#1877f2]">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
