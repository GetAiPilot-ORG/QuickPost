import { AlertTriangle, BarChart3 } from "lucide-react";

export default function BotSettingsPanel({ analytics }: { analytics?: any }) {
  const stats = [
    ["Conversations", analytics?.totalConversations || 0],
    ["Bot replies", analytics?.botReplies || 0],
    ["Handoffs", analytics?.humanHandoffs || 0],
    ["Leads", analytics?.leadsCaptured || 0],
    ["Unanswered", analytics?.unansweredQuestions || 0],
    ["Conversion", `${analytics?.conversionRate || 0}%`],
  ];

  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--canvas)]">
          <BarChart3 className="h-5 w-5 text-[var(--ink)]" />
        </span>
        <div>
          <p className="text-xs font-semibold text-[var(--arc)]">Analytics</p>
          <h2 className="text-lg font-semibold text-[var(--ink)]">Last 30 days</h2>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-black/10 bg-[#f8f6f3] p-3">
            <div className="text-xl font-semibold text-[var(--ink)]">{value}</div>
            <div className="mt-1 text-xs font-medium text-[var(--slate)]">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Safety note
          </div>
          Bot replies only to inbound DMs and hands off risky or low-confidence chats.
        </div>
      </div>
    </section>
  );
}
