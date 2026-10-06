import { useMemo, useState } from "react";
import { Bot, RotateCcw, Send, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { testInstagramBotReply } from "@/services/instagramApi";

export default function TestChat({
  botId,
  systemPrompt,
  compact = false,
  showHeader = true,
}: {
  botId?: string;
  systemPrompt?: string;
  compact?: boolean;
  showHeader?: boolean;
}) {
  const [messages, setMessages] = useState<any[]>([
    { role: "bot", text: "Test your Instagram DM bot before activating it." },
  ]);
  const [draft, setDraft] = useState("What are your prices?");
  const [sending, setSending] = useState(false);

  const clearChat = () => {
    setMessages([{ role: "bot", text: "Test your Instagram DM bot before activating it." }]);
    toast.success("Chat memory cleared");
  };

  const send = async () => {
    if (!botId) {
      toast.error("Save a bot before testing.");
      return;
    }
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    
    // Prepare multi-turn history (skip initial greeting placeholder)
    const historyPayload = messages
      .filter((m, idx) => idx > 0 && m.text)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((current) => [...current, { role: "user", text }]);
    setSending(true);
    try {
      const reply = await testInstagramBotReply(botId, text, systemPrompt, historyPayload);
      setMessages((current) => [
        ...current,
        { role: "bot", text: reply.text, confidence: reply.confidence, handoff: reply.handoff },
      ]);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Test failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-xl border border-black/10 bg-white shadow-sm">
      {showHeader ? (
        <div className="border-b border-black/10 bg-[#fffaf7] p-4">
          <p className="text-xs font-semibold text-[var(--arc)]">Preview Chat</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">Test replies</h2>
        </div>
      ) : null}
      <div className="p-3">
        <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-black/10 bg-[#fffaf7] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-[var(--arc)]">
                <Bot className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-semibold leading-4 text-[var(--ink)]">InstaPilot</div>
                <div className="text-xs leading-4 text-[var(--slate)]">Preview replies</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearChat}
                title="Clear chat and reset memory"
                className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-[var(--slate)] transition hover:border-black/20 hover:text-[var(--ink)]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset chat</span>
              </button>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Test mode</span>
            </div>
          </div>

          <div className={`${compact ? "h-[430px]" : "h-[470px]"} overflow-y-auto bg-[#f8f6f3] p-4`}>
            <div className="space-y-3">
              {messages.map((message, index) => (
                <div key={index} className={`flex items-end gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "bot" ? (
                    <span className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[var(--slate)] shadow-sm">
                      <Bot className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                  <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-[13px] leading-6 shadow-sm ${
                    message.role === "user"
                      ? "rounded-br-md bg-[#3797f0] text-white"
                      : "rounded-bl-md border border-black/5 bg-white text-[var(--ink)]"
                  }`}>
                    <StructuredMessage text={message.text} role={message.role} />
                    {typeof message.confidence === "number" ? (
                      <div className={`mt-2 text-[11px] font-semibold ${message.role === "user" ? "text-white/75" : "text-[var(--slate)]"}`}>
                        {Math.round(message.confidence * 100)}% confident {message.handoff ? " / human review suggested" : ""}
                      </div>
                    ) : null}
                  </div>
                  {message.role === "user" ? (
                    <span className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[var(--slate)] shadow-sm">
                      <UserRound className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-black/10 bg-white p-3">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") send();
              }}
              className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3797f0] focus:ring-2 focus:ring-blue-500/10"
              placeholder="Ask a customer question"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !botId}
              aria-label="Send test message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#3797f0] text-white transition hover:bg-[#1877f2] disabled:cursor-not-allowed disabled:bg-black/25"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function StructuredMessage({ text, role }: { text: string; role: string }) {
  const parts = useMemo(() => structureText(text), [text]);

  if (role === "user") return <>{text}</>;

  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        if (part.type === "plan") {
          return (
            <div key={index} className="rounded-xl border border-black/5 bg-[#fafafa] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-[var(--ink)]">{part.name}</div>
                {part.price ? <div className="shrink-0 font-semibold text-[#0f9f6e]">{part.price}</div> : null}
              </div>
              {part.detail ? <div className="mt-1 text-xs leading-5 text-[var(--slate)]">{part.detail}</div> : null}
            </div>
          );
        }

        if (part.type === "bullet") {
          return (
            <div key={index} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3797f0]" />
              <span>{renderInline(part.text)}</span>
            </div>
          );
        }

        return <p key={index}>{renderInline(part.text)}</p>;
      })}
    </div>
  );
}

function structureText(text: string) {
  const cleaned = text
    .replace(/\r/g, "")
    .replace(/\s+-\s+/g, "\n- ")
    .replace(/(\*\*[^*]+?\*\*:)/g, "\n- $1")
    .trim();

  return cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const normalized = line.replace(/^[-•]\s*/, "").trim();
      const planMatch = normalized.match(/^\*\*(.+?)\*\*:?\s*(.+)$/);
      if (planMatch) {
        const detail = planMatch[2].trim();
        const price = detail.match(/₹[\d,]+/)?.[0];
        return {
          type: "plan",
          name: planMatch[1].trim(),
          price,
          detail: detail.replace(price || "", "").replace(/[()]/g, "").trim(),
        };
      }
      if (/^[-•]\s*/.test(line)) return { type: "bullet", text: normalized };
      return { type: "text", text: line };
    });
}

function renderInline(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const boldTokens = text.split(/(\*\*[^*]+?\*\*)/g);

  return boldTokens.map((boldToken, bIndex) => {
    if (boldToken.startsWith("**") && boldToken.endsWith("**")) {
      return <strong key={bIndex}>{boldToken.slice(2, -2)}</strong>;
    }

    const subTokens = boldToken.split(urlRegex);
    return (
      <span key={bIndex}>
        {subTokens.map((subToken, sIndex) => {
          if (/^https?:\/\//i.test(subToken)) {
            let cleanUrl = subToken;
            let trailing = "";
            const match = subToken.match(/[.,)!?]+$/);
            if (match) {
              trailing = match[0];
              cleanUrl = subToken.slice(0, -trailing.length);
            }

            return (
              <span key={sIndex}>
                <a
                  href={cleanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0095f6] underline hover:text-[#1877f2] font-medium break-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  {cleanUrl}
                </a>
                {trailing}
              </span>
            );
          }
          return <span key={sIndex}>{subToken}</span>;
        })}
      </span>
    );
  });
}
