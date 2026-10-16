import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, UserIcon } from "@hugeicons/core-free-icons";

function formatMessageTime(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

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
    <aside className="flex flex-col h-full min-h-0 rounded-lg border border-black/10 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-black/10 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-[var(--arc)]">Inbox</p>
            <h2 className="text-lg font-bold text-[var(--ink)]">Conversations</h2>
          </div>
          {handoffCount ? (
            <span
              className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800"
              title="Chats waiting for your manual reply"
            >
              {handoffCount} need reply
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-5 text-center text-xs text-[var(--slate)]">
            No Instagram DMs have arrived yet.
          </div>
        ) : null}

        {conversations
          .filter((c) => c.instagram_messages && c.instagram_messages.length > 0)
          .filter((c) => c.instagram_username || c.instagram_name)
          .sort((a, b) => {
            const latestA = [...(a.instagram_messages || [])].sort(
              (x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
            )[0];
            const latestB = [...(b.instagram_messages || [])].sort(
              (x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
            )[0];
            const timeA = latestA ? new Date(latestA.created_at).getTime() : 0;
            const timeB = latestB ? new Date(latestB.created_at).getTime() : 0;
            return timeB - timeA;
          })
          .map((conversation) => {
            const latest = [...(conversation.instagram_messages || [])].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];
            const displayName =
              conversation.instagram_username ||
              conversation.instagram_name ||
              `IG user ${String(conversation.instagram_user_id || "").slice(-4)}`;
            const follows = conversation.is_user_follow_business;
            const needsHuman = conversation.status === "human_needed";
            const isSelected = selectedId === conversation.id;

            return (
              <button
                type="button"
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                className={`block w-full border-b px-3.5 py-3 text-left transition ${
                  isSelected
                    ? needsHuman
                      ? "border-amber-300 bg-amber-50"
                      : "border-orange-200 bg-orange-50/70"
                    : needsHuman
                    ? "border-amber-100 bg-[#fffbf2] hover:bg-amber-50"
                    : "border-black/5 hover:bg-black/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border ${
                        needsHuman
                          ? "border-amber-200 bg-amber-100 text-amber-700"
                          : "border-black/5 bg-orange-50 text-[var(--arc)]"
                      }`}
                    >
                      {conversation.profile_pic_url ? (
                        <img
                          src={conversation.profile_pic_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <HugeiconsIcon icon={UserIcon} size={16} strokeWidth={1.5} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-[var(--ink)]">
                        {displayName}
                      </p>
                      <p className="truncate text-[11px] text-[var(--slate)]">
                        {conversation.instagram_accounts?.instagram_username
                          ? `@${conversation.instagram_accounts.instagram_username} • `
                          : ""}
                        {follows === true
                          ? "Follower"
                          : follows === false
                          ? "Non-follower"
                          : "Follower unknown"}{" "}
                        / {conversation.instagram_bots?.bot_name || "InstaPilot"}
                      </p>
                    </div>
                  </div>

                  {needsHuman ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                      <HugeiconsIcon icon={AlertCircleIcon} size={11} strokeWidth={2} />
                      Reply
                    </span>
                  ) : latest?.created_at ? (
                    <span className="text-[11px] font-medium text-[var(--slate)] shrink-0">
                      {formatMessageTime(latest.created_at)}
                    </span>
                  ) : null}
                </div>

                {needsHuman ? (
                  <div className="mt-2 rounded border border-amber-200 bg-white/70 px-2 py-1 text-[10px] font-semibold text-amber-800">
                    Human reply needed
                  </div>
                ) : null}

                <p className="mt-1.5 line-clamp-2 text-xs text-[var(--slate)]">
                  {latest?.message_text || "No messages yet"}
                </p>
              </button>
            );
          })}
      </div>
    </aside>
  );
}
