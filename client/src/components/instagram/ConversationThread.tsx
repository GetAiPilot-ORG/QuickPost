import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  RoboticIcon,
  ExternalLinkIcon,
  Message01Icon,
  PauseIcon,
  PlayIcon,
  SentIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  fetchConversationThread,
  sendManualInstagramReply,
  updateConversation,
} from "@/services/instagramApi";

function renderMessageWithLinks(text: string, isOutbound: boolean) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline font-medium break-all hover:opacity-80 transition ${
            isOutbound ? "text-white underline decoration-white/70" : "text-blue-600 underline decoration-blue-400"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function ConversationThread({
  conversationId,
  refreshKey,
  onChanged,
}: {
  conversationId?: string;
  refreshKey?: number;
  onChanged: () => void;
}) {
  const [thread, setThread] = useState<any>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
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
    if (!conversationId || !draft.trim() || sending) return;
    setSending(true);
    try {
      await sendManualInstagramReply(conversationId, draft.trim());
      setDraft("");
      await load();
      onChanged();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Reply failed");
    } finally {
      setSending(false);
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
      <section className="flex h-full min-h-0 flex-col items-center justify-center rounded-lg border border-black/10 bg-white p-8 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-arc-050)] text-[var(--arc)] mb-3">
          <HugeiconsIcon icon={Message01Icon} size={24} strokeWidth={1.8} />
        </div>
        <h3 className="font-semibold text-[var(--ink)] text-base">Select a conversation</h3>
        <p className="mt-1 text-xs text-[var(--slate)] max-w-xs">
          Choose a chat from the left panel to review messages and reply.
        </p>
      </section>
    );
  }

  const conversation = thread?.conversation;
  const username = conversation?.instagram_username;
  const displayName =
    username ||
    conversation?.instagram_name ||
    (conversation?.instagram_user_id ? `IG user ${String(conversation.instagram_user_id).slice(-4)}` : "Instagram user");
  const shouldShowResume =
    conversation?.bot_paused ||
    conversation?.status === "human_needed" ||
    conversation?.status === "human_active";
  const needsHuman = conversation?.status === "human_needed";
  const isDisconnected =
    conversation?.instagram_accounts?.is_connected === false ||
    conversation?.instagram_accounts?.token_status === "disconnected";

  return (
    <section className={`flex flex-col h-full min-h-0 rounded-lg border bg-white shadow-sm overflow-hidden ${needsHuman ? "border-amber-300" : "border-black/10"}`}>
      {/* Conversation Top Header */}
      <div className={`flex flex-col gap-3 border-b px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between ${needsHuman ? "border-amber-200 bg-amber-50/70" : "border-black/10 bg-white"}`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border ${
            needsHuman ? "border-amber-300 bg-amber-100 text-amber-700" : "border-black/10 bg-[var(--color-arc-050)] text-[var(--arc)]"
          }`}>
            {conversation?.profile_pic_url ? (
              <img src={conversation.profile_pic_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <HugeiconsIcon icon={UserIcon} size={20} strokeWidth={1.8} />
            )}
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[var(--ink)] truncate">{displayName}</h2>
              {username ? (
                <a
                  href={`https://instagram.com/${username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--slate)] hover:text-[var(--arc)] transition-colors inline-flex items-center"
                  title="Open profile on Instagram"
                >
                  <HugeiconsIcon icon={ExternalLinkIcon} size={14} strokeWidth={1.8} />
                </a>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <span className="text-[11px] font-semibold text-[var(--slate)]">
                {conversation?.is_user_follow_business === true
                  ? "Follower"
                  : conversation?.is_user_follow_business === false
                  ? "Non-follower"
                  : "Follower unknown"}
              </span>
              <span className="text-[11px] text-[var(--slate)] opacity-50">·</span>
              {needsHuman ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.2 text-[10px] font-bold text-amber-800">
                  <HugeiconsIcon icon={Alert02Icon} size={11} strokeWidth={2} /> Needs Attention
                </span>
              ) : conversation?.bot_paused ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.2 text-[10px] font-bold text-slate-600">
                  <HugeiconsIcon icon={PauseIcon} size={11} strokeWidth={2} /> Bot Paused
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/70 px-2 py-0.2 text-[10px] font-bold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> AI Active
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={togglePause}
            className={`gap-1.5 text-xs font-semibold bg-white ${
              needsHuman
                ? "border-amber-300 text-amber-900 hover:bg-amber-100"
                : shouldShowResume
                ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                : "border-black/10 text-[var(--slate)] hover:bg-black/5"
            }`}
            disabled={!conversation}
          >
            {shouldShowResume ? (
              <HugeiconsIcon icon={PlayIcon} size={14} strokeWidth={1.8} />
            ) : (
              <HugeiconsIcon icon={PauseIcon} size={14} strokeWidth={1.8} />
            )}
            {shouldShowResume ? "Resume Bot" : "Pause Bot"}
          </Button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#faf8f5] p-4 space-y-3">
        {loading ? (
          <div className="py-8 text-center text-xs text-[var(--slate)]">
            Loading messages...
          </div>
        ) : null}

        {conversation?.status === "human_needed" ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-950 shadow-xs">
            <HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <strong className="font-semibold">Manual reply needed:</strong> The bot paused because this message requires human attention. Send a reply below, then click Resume Bot when finished.
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
            .map((message: any) => {
              const isOutbound = message.direction === "outbound";
              const timeString = new Date(message.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={message.id}
                  className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed shadow-xs break-words ${
                      isOutbound
                        ? "rounded-tr-xs bg-[#0084ff] text-white"
                        : "rounded-tl-xs bg-white text-[var(--ink)] border border-[rgba(20,20,19,0.08)]"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">
                      {renderMessageWithLinks(message.message_text, isOutbound)}
                    </div>

                    <div
                      className={`mt-1 flex items-center gap-1.5 text-[10px] ${
                        isOutbound ? "justify-end text-white/80" : "justify-start text-[var(--slate)]"
                      }`}
                    >
                      {message.ai_generated && isOutbound ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-[rgba(255,255,255,0.22)] px-1.5 py-0.5 text-[9px] font-semibold text-white tracking-wide shadow-2xs"
                          title="Sent automatically by InstaPilot AI"
                        >
                          <HugeiconsIcon icon={RoboticIcon} size={11} strokeWidth={2} className="shrink-0" />
                          <span>AI</span>
                        </span>
                      ) : null}
                      <span>{timeString}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input / Reply Bar */}
      {isDisconnected ? (
        <div className="flex items-center justify-between gap-3 border-t border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2.5">
            <HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={1.8} className="text-amber-700 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-900">Instagram Disconnected</p>
              <p className="text-[11px] text-amber-700">Reconnect account to send manual replies.</p>
            </div>
          </div>
          <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
            <Link to="/connect">Reconnect</Link>
          </Button>
        </div>
      ) : (
        <div className="border-t border-black/10 bg-white p-3.5 space-y-1.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2"
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a reply..."
              disabled={sending}
              className="flex-1 rounded-full border border-black/10 bg-[#f9f8f6] px-4 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--slate)] focus:outline-none focus:border-[var(--arc)] focus:bg-white transition-all"
            />
            <Button
              type="submit"
              disabled={!draft.trim() || sending}
              size="icon"
              aria-label="Send reply"
              className="h-10 w-10 shrink-0 rounded-full bg-[var(--arc)] hover:bg-[#e84f00] text-white transition-all shadow-xs disabled:opacity-40"
            >
              <HugeiconsIcon icon={SentIcon} size={16} strokeWidth={1.8} />
            </Button>
          </form>
          <p className="text-[10px] text-[var(--slate)] px-2">
            Official Meta Direct API • Manual replies will pause the AI bot for this chat
          </p>
        </div>
      )}
    </section>
  );
}
