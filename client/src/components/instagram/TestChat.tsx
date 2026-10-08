import { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon, RoboticIcon } from "@hugeicons/core-free-icons";
import toast from "react-hot-toast";
import { testInstagramBotReply } from "@/services/instagramApi";

const defaultQuickPrompts = ["Pricing", "Services", "Book a Call", "Talk to Human"];

export default function TestChat({
  botId,
  systemPrompt,
  compact = false,
  showHeader = true,
  fullHeight = false,
}: {
  botId?: string;
  systemPrompt?: string;
  compact?: boolean;
  showHeader?: boolean;
  fullHeight?: boolean;
}) {
  const [messages, setMessages] = useState<any[]>([
    { role: "bot", text: "Hey! How can I help you today?" },
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const clearChat = () => {
    setMessages([{ role: "bot", text: "Hey! How can I help you today?" }]);
    toast.success("Chat reset");
  };

  const send = async (textToSend?: string) => {
    if (!botId) {
      toast.error("Please configure and save your bot persona first.");
      return;
    }
    const text = (textToSend || draft).trim();
    if (!text) return;
    setDraft("");

    // Multi-turn history excluding initial greeting
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
    <div className={`flex flex-col ${fullHeight ? "h-full bg-white" : "overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-xs"}`}>
      {showHeader && (
        <div className="flex items-center justify-between border-b border-black/[0.08] bg-white px-4 py-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-0.5 shadow-xs">
                <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-gray-800">
                  <HugeiconsIcon icon={RoboticIcon} size={16} strokeWidth={1.8} />
                </span>
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900 leading-tight">InstaPilot AI</div>
              <div className="text-[10px] text-gray-400 font-medium">Active now • Simulation</div>
            </div>
          </div>
          <button
            type="button"
            onClick={clearChat}
            title="Clear chat history"
            className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 transition hover:bg-gray-50 hover:text-black"
          >
            <HugeiconsIcon icon={RefreshIcon} size={12} strokeWidth={1.8} />
            <span>Reset</span>
          </button>
        </div>
      )}

      {/* Message Stream */}
      <div
        className={`flex-1 overflow-y-auto bg-[#fafafa] p-4 sm:p-5 space-y-3.5 ${
          !fullHeight ? (compact ? "h-[380px]" : "h-[450px]") : ""
        }`}
      >
        <div className="text-center my-1">
          <span className="text-[10px] font-medium text-gray-400 bg-white border border-black/5 px-2.5 py-0.5 rounded-full shadow-2xs">
            Instagram DM Simulation
          </span>
        </div>

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[78%] px-4 py-2.5 text-[13.5px] leading-relaxed ${
                message.role === "user"
                  ? "rounded-[18px] rounded-br-[4px] bg-[#0095f6] text-white"
                  : "rounded-[18px] rounded-bl-[4px] bg-[#efefef] text-[#1c1e21]"
              }`}
            >
              <StructuredMessage text={message.text} role={message.role} />
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-[18px] rounded-bl-[4px] bg-[#efefef] px-4 py-3 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar */}
      <div className="border-t border-black/[0.04] bg-white px-3.5 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <span className="text-[10px] font-semibold text-gray-400 shrink-0">Suggestions:</span>
        {defaultQuickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={sending}
            onClick={() => send(prompt)}
            className="shrink-0 rounded-full border border-black/[0.08] bg-[#f9f9fb] px-3 py-1 text-[11px] font-medium text-gray-600 transition hover:bg-gray-100 hover:text-black active:scale-95 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Instagram-style Pill Input Bar */}
      <div className="border-t border-black/[0.08] bg-white p-3 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2 rounded-full border border-black/15 bg-white px-4 py-2 focus-within:border-black/40 focus-within:ring-2 focus-within:ring-black/5 transition shadow-xs"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={sending}
            className="bare-input min-w-0 flex-1 text-[13.5px] text-gray-900 placeholder:text-gray-400"
            style={{
              border: "none",
              background: "transparent",
              boxShadow: "none",
              outline: "none",
              borderRadius: "0",
            }}
            placeholder="Message..."
          />
          <button
            type="submit"
            disabled={sending || !botId || !draft.trim()}
            className="text-xs font-bold text-[#0095f6] hover:text-[#0074cc] transition disabled:text-gray-300 disabled:cursor-not-allowed px-1"
          >
            Send
          </button>
        </form>
      </div>
    </div>
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
            <div key={index} className="rounded-lg border border-black/[0.06] bg-gray-50/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-gray-900">{part.name}</div>
                {part.price ? <div className="shrink-0 font-semibold text-emerald-700">{part.price}</div> : null}
              </div>
              {part.detail ? <div className="mt-1 text-[11px] leading-relaxed text-gray-500">{part.detail}</div> : null}
            </div>
          );
        }

        if (part.type === "bullet") {
          return (
            <div key={index} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0084ff]" />
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
                  className="text-[#0084ff] underline hover:text-[#0066ee] font-medium break-all"
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
