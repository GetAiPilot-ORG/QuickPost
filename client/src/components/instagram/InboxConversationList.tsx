import { AlertCircle, Bot, Circle, UserRound } from "lucide-react";

export default function InboxConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: any[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const handoffCount = conversations.filter((conversation) => conversation.status === "human_needed").length;

  return (
    <aside className="rounded-lg border border-black/10 bg-white shadow-sm">
      <div className="border-b border-black/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--arc)]">Inbox</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--ink)]">Conversations</h2>
          </div>
          {handoffCount ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800" title="Chats waiting for your manual reply">
              {handoffCount} need reply
            </span>
          ) : null}
        </div>
      </div>
      <div className="max-h-[720px] overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-5 text-sm text-[var(--slate)]">No Instagram DMs have arrived yet.</div>
        ) : null}
        {conversations
          .filter(c => c.instagram_messages && c.instagram_messages.length > 0)
          .filter(c => c.instagram_username || c.instagram_name)
          .sort((a, b) => {
            const latestA = [...(a.instagram_messages || [])].sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())[0];
            const latestB = [...(b.instagram_messages || [])].sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())[0];
            const timeA = latestA ? new Date(latestA.created_at).getTime() : 0;
            const timeB = latestB ? new Date(latestB.created_at).getTime() : 0;
            return timeB - timeA;
          })
          .map((conversation) => {
          const latest = [...(conversation.instagram_messages || [])].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )[0];
          const displayName =
            conversation.instagram_username ||
            conversation.instagram_name ||
            `IG user ${String(conversation.instagram_user_id || "").slice(-4)}`;
          const follows = conversation.is_user_follow_business;
          const needsHuman = conversation.status === "human_needed";
          return (
            <button
              type="button"
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={`block w-full border-b p-4 text-left transition ${
                selectedId === conversation.id
                  ? needsHuman
                    ? "border-amber-300 bg-amber-50"
                    : "border-orange-200 bg-orange-50"
                  : needsHuman
                    ? "border-amber-200 bg-[#fff8ea] hover:bg-amber-50"
                    : "border-black/5 hover:bg-black/[0.03]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ${
                    needsHuman ? "bg-amber-100 text-amber-700" : "bg-orange-50 text-[var(--arc)]"
                  }`}>
                    {conversation.profile_pic_url ? (
                      <img src={conversation.profile_pic_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <UserRound className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--ink)]">
                      {displayName}
                    </p>
                    <p className="truncate text-[11px] text-[var(--slate)]">
                      {conversation.instagram_accounts?.instagram_username ? `@${conversation.instagram_accounts.instagram_username} • ` : ""}
                      {follows === true ? "Follower" : follows === false ? "Non-follower" : "Follower unknown"} / {conversation.instagram_bots?.bot_name || "InstaPilot"}
                    </p>
                  </div>
                </div>
                {needsHuman ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Reply
                  </span>
                ) : conversation.bot_paused ? (
                  <Circle className="h-4 w-4 text-slate-400" />
                ) : (
                  <Bot className="h-4 w-4 text-emerald-600" />
                )}
              </div>
              {needsHuman ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                  Human reply needed
                </div>
              ) : null}
              <p className="mt-3 line-clamp-2 text-[13px] text-[var(--slate)]">{latest?.message_text || "No messages yet"}</p>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
