import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Check, ChevronDown, ExternalLink, Info, Instagram, Languages, MessageCircle, Power, Save, SlidersHorizontal, Sparkles, Store, Wand2, Tag } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { createInstagramBot, updateInstagramBot } from "@/services/instagramApi";

const tones = ["friendly", "professional", "casual", "luxury", "sales-focused"];
const languages = ["auto-detect", "English", "Hindi", "Hinglish"];
const goals = ["support", "sales", "course info", "booking", "product FAQ"];

const promptPresets = [
  {
    id: "closer",
    label: "🎯 Lead Closer",
    desc: "Direct answers + asks for phone/email before pricing",
    prompt:
      "Act as an energetic sales & lead qualification specialist for {{business_name}}. Do not repeat greetings; jump straight into the answer. Answer product/service questions concisely, but whenever the user asks about pricing or booking, politely ask for their name and phone/WhatsApp number so our team can send the complete catalog.",
  },
  {
    id: "support",
    label: "🤝 Friendly Support",
    desc: "Direct, patient, helpful answers without repetitive greetings",
    prompt:
      "Act as a patient, warm, and helpful customer support specialist for {{business_name}}. Do not repeat greetings on every reply; answer customer questions directly and politely using the Knowledge Base. Never push for aggressive sales unless requested.",
  },
  {
    id: "booking",
    label: "📅 Demo & Call Booker",
    desc: "Drives prospective clients to schedule calls directly",
    prompt:
      "Your primary objective is to get prospective customers to book a 1-on-1 discovery call or demo. Jump straight to the point, highlight key benefits briefly, and ask if they would like to schedule a quick 15-minute walkthrough.",
  },
  {
    id: "hinglish",
    label: "🇮🇳 Hinglish Creator",
    desc: "Conversational Hinglish with natural emojis",
    prompt:
      "Talk naturally in conversational, friendly Hinglish (Hindi + English blend) with emojis (🔥, 🙌, 🚀). Keep it casual and authentic. Do not say hello/hi on every message; jump directly into answering.",
  },
  {
    id: "offers",
    label: "🎁 Promo & Deals",
    desc: "Direct answers + discount code when asked",
    prompt:
      "You are an assistant for {{business_name}}. Answer product and shipping questions directly without robotic greetings. If the customer expresses price hesitation or asks about ongoing offers, share the special 10% first-time discount code: WELCOME10.",
  },
];

const defaultForm = {
  bot_name: "InstaPilot Assistant",
  business_name: "",
  tone: "friendly",
  language: "auto-detect",
  bot_goal: "support",
  system_prompt: "",
  fallback_message: "I am not fully sure about that. Our team will help you shortly.",
  welcome_message: "Hi! Welcome to {{business_name}}. How can I help you today?",
  quick_replies: ["Pricing", "Services", "Book a Call", "Talk to Human"],
  handoff_keywords: ["human", "agent", "call me", "support"],
  lead_fields: ["name", "phone", "email", "requirement"],
  confidence_threshold: 0.68,
  daily_reply_limit: 250,
  is_active: false,
  human_handoff_enabled: true,
};

export default function BotBuilderForm({
  accounts,
  accountsBusy = false,
  selectedBot,
  onSaved,
}: {
  accounts: any[];
  accountsBusy?: boolean;
  selectedBot?: any;
  onSaved: (bot?: any) => void;
}) {
  const [form, setForm] = useState<any>(() => selectedBot || { ...defaultForm, instagram_account_id: accounts[0]?.id || "" });
  const [saving, setSaving] = useState(false);

  const activeAccountOptions = useMemo(() => {
    const seen = new Set<string>();
    return accounts
      .filter((account) => account.is_connected)
      .filter((account) => {
        const identity = String(
          account.instagram_business_account_id ||
            account.instagram_user_id ||
            account.page_id ||
            account.instagram_username ||
            account.id
        );
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      });
  }, [accounts]);

  const selectedAccount = useMemo(() => {
    return activeAccountOptions.find((acc) => acc.id === form.instagram_account_id) || activeAccountOptions[0];
  }, [activeAccountOptions, form.instagram_account_id]);

  const statusLabel = form.id ? (form.is_active ? "Active" : "Paused") : form.is_active ? "Active" : "Draft";

  const setField = (key: string, value: unknown) => setForm((current: any) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!form.id && !form.instagram_account_id && activeAccountOptions[0]?.id) {
      setField("instagram_account_id", activeAccountOptions[0].id);
    }
  }, [activeAccountOptions, form.id, form.instagram_account_id]);

  useEffect(() => {
    if (accounts.length > 0 && form.instagram_account_id && !activeAccountOptions.some((account) => account.id === form.instagram_account_id)) {
      setField("instagram_account_id", activeAccountOptions[0]?.id || "");
    }
  }, [accounts, activeAccountOptions, form.instagram_account_id]);

  const save = async (overrides: Record<string, unknown> = {}) => {
    const nextForm = { ...form, ...overrides };
    if (!nextForm.instagram_account_id) {
      toast.error("Instagram account is syncing. Please wait a moment or connect Instagram.");
      return;
    }
    if (!nextForm.business_name?.trim()) {
      toast.error("Add your business name first.");
      return;
    }
    setSaving(true);
    try {
      const sanitizedPayload = {
        ...nextForm,
        quick_replies: Array.isArray(nextForm.quick_replies) ? nextForm.quick_replies : [],
        handoff_keywords: Array.isArray(nextForm.handoff_keywords) ? nextForm.handoff_keywords : [],
        lead_fields: Array.isArray(nextForm.lead_fields) ? nextForm.lead_fields : [],
      };
      const savedBot = nextForm.id
        ? await updateInstagramBot(nextForm.id, sanitizedPayload)
        : await createInstagramBot(sanitizedPayload);
      toast.success(
        "is_active" in overrides
          ? nextForm.is_active
            ? "Bot activated live!"
            : "Bot paused."
          : "Bot saved successfully."
      );
      onSaved(savedBot);
      if (savedBot) setForm(savedBot);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Failed to save bot");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-xs">
      {/* Top Header Bar */}
      <div className="border-b border-black/10 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-gray-900">
              {form.id ? "Bot Persona & Behavior" : "Configure Bot Persona"}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Define how your AI bot speaks, represents your business, and handles customer inquiries.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-3 py-1.5 text-xs font-semibold ${form.is_active ? "bg-emerald-100 text-emerald-800" : "bg-black/5 text-[var(--slate)]"}`}>
              {statusLabel}
            </span>
            {form.id ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => save({ is_active: !form.is_active })}
                disabled={saving || !activeAccountOptions.length}
                className="gap-2 bg-white"
              >
                <Power className="h-4 w-4" />
                {form.is_active ? "Pause Bot" : "Activate Bot"}
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => save()}
              disabled={saving || !activeAccountOptions.length}
              className="gap-2 bg-[var(--arc)] text-white hover:bg-[#d95f27]"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Bot Persona"}
            </Button>
          </div>
        </div>
      </div>

      {!activeAccountOptions.length && !accountsBusy ? (
        <div className="m-5 rounded-xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-amber-900">No Instagram Account Connected</h3>
            <p className="mt-0.5 text-xs text-amber-700">Link your Instagram Professional account to activate automatic DM handling.</p>
          </div>
          <Button asChild className="gap-2 bg-[var(--arc)] text-xs font-semibold text-white hover:bg-[#d95f27] h-9">
            <Link to="/dashboard/instapilot/connect">
              <Instagram className="h-3.5 w-3.5" />
              <span>Connect Instagram Account</span>
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div>
            <SectionTitle icon={<Store className="h-4 w-4" />} title="Business Identity" />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Field label="Instagram account">
                <AccountSelect
                  accounts={activeAccountOptions}
                  busy={accountsBusy}
                  value={form.instagram_account_id || ""}
                  onChange={(value) => setField("instagram_account_id", value)}
                />
              </Field>
              <Field label="Bot name">
                <input value={form.bot_name || ""} onChange={(e) => setField("bot_name", e.target.value)} className="instapilot-input" />
              </Field>
              <Field label="Business name">
                <input value={form.business_name || ""} onChange={(e) => setField("business_name", e.target.value)} className="instapilot-input" placeholder="Your brand or store" />
              </Field>
              <Field label="Bot purpose">
                <Segmented options={goals} value={form.bot_goal} onChange={(value) => setField("bot_goal", value)} />
              </Field>
            </div>
          </div>

          <div>
            <SectionTitle icon={<Wand2 className="h-4 w-4" />} title="Custom AI Instructions & Persona (System Prompt)" />
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-end flex-wrap gap-1.5 text-xs text-[var(--slate)]">
                <span>Dynamic tags:</span>
                  <button
                    type="button"
                    onClick={() => setField("system_prompt", (form.system_prompt || "") + " {{business_name}}")}
                    className="rounded bg-gray-100 border border-black/5 px-2 py-0.5 font-mono text-[11px] font-medium text-gray-700 hover:bg-gray-200 transition"
                    title="Click to insert {{business_name}}"
                  >
                    {"{{business_name}}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setField("system_prompt", (form.system_prompt || "") + " {{bot_name}}")}
                    className="rounded bg-gray-100 border border-black/5 px-2 py-0.5 font-mono text-[11px] font-medium text-gray-700 hover:bg-gray-200 transition"
                    title="Click to insert {{bot_name}}"
                  >
                    {"{{bot_name}}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setField("system_prompt", (form.system_prompt || "") + " {{current_date}}")}
                    className="rounded bg-gray-100 border border-black/5 px-2 py-0.5 font-mono text-[11px] font-medium text-gray-700 hover:bg-gray-200 transition"
                    title="Click to insert {{current_date}}"
                  >
                    {"{{current_date}}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setField("system_prompt", (form.system_prompt || "") + " {{current_time}}")}
                    className="rounded bg-gray-100 border border-black/5 px-2 py-0.5 font-mono text-[11px] font-medium text-gray-700 hover:bg-gray-200 transition"
                    title="Click to insert {{current_time}}"
                  >
                    {"{{current_time}}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setField("system_prompt", (form.system_prompt || "") + " {{current_day}}")}
                    className="rounded bg-gray-100 border border-black/5 px-2 py-0.5 font-mono text-[11px] font-medium text-gray-700 hover:bg-gray-200 transition"
                    title="Click to insert {{current_day}}"
                  >
                    {"{{current_day}}"}
                  </button>
                </div>

              {/* Presets Bar */}
              <div className="flex flex-wrap gap-2">
                {promptPresets.map((preset) => {
                  const isActive = form.system_prompt === preset.prompt;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setField("system_prompt", preset.prompt)}
                      className={`group flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        isActive
                          ? "border-black bg-black text-white shadow-sm"
                          : "border-black/10 bg-white text-[var(--slate)] hover:border-black/20 hover:text-[var(--ink)]"
                      }`}
                      title={preset.desc}
                    >
                      <span>{preset.label}</span>
                    </button>
                  );
                })}
                {form.system_prompt ? (
                  <button
                    type="button"
                    onClick={() => setField("system_prompt", "")}
                    className="rounded-lg border border-dashed border-black/20 px-2.5 py-2 text-xs text-[var(--slate)] hover:border-red-300 hover:text-red-600"
                    title="Clear prompt"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              <Field label="System Prompt & Behavior Rules">
                <textarea
                  value={form.system_prompt || ""}
                  onChange={(e) => setField("system_prompt", e.target.value)}
                  rows={4}
                  className="instapilot-input font-mono text-xs leading-5"
                  placeholder="e.g. Act as a senior consultant named Priya for {{business_name}}. Speak in energetic Hinglish. Whenever someone asks for pricing, ask for their WhatsApp number so our team can send the catalog. Never provide medical advice."
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--slate)]">
                  <span>Injected directly into OpenAI LLM system instructions before each reply.</span>
                  <span>{(form.system_prompt || "").length} characters</span>
                </div>
              </Field>
            </div>
          </div>

          <div>
            <SectionTitle icon={<Languages className="h-4 w-4" />} title="Conversation Style" />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Field label="Tone">
                <Segmented options={tones} value={form.tone} onChange={(value) => setField("tone", value)} />
              </Field>
              <Field label="Language">
                <Segmented options={languages} value={form.language} onChange={(value) => setField("language", value)} />
              </Field>
              <Field label="Welcome message">
                <textarea value={form.welcome_message || ""} onChange={(e) => setField("welcome_message", e.target.value)} rows={4} className="instapilot-input" />
              </Field>
              <Field label="Fallback message">
                <textarea value={form.fallback_message || ""} onChange={(e) => setField("fallback_message", e.target.value)} rows={4} className="instapilot-input" />
              </Field>
            </div>
          </div>

          <div>
            <SectionTitle icon={<MessageCircle className="h-4 w-4" />} title="Automation Rules" />
            <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              <Field label="Quick replies">
                <TagInput value={form.quick_replies || []} onChange={(value) => setField("quick_replies", value)} />
              </Field>
              <Field label="Human handoff keywords">
                <TagInput value={form.handoff_keywords || []} onChange={(value) => setField("handoff_keywords", value)} />
              </Field>
              <Field label="Lead fields">
                <TagInput value={form.lead_fields || []} onChange={(value) => setField("lead_fields", value)} />
              </Field>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-black/10 bg-[#fbfaf8] p-4">
          <p className="text-xs font-semibold text-[var(--ink)]">Safety Controls</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <ToggleRow
              icon={<Power className="h-4 w-4" />}
              title="Bot active"
              description="Allow automatic replies for inbound DMs. Only one bot can be active per Instagram account."
              help="When you activate this bot, any other live bot on the same Instagram account is automatically moved to draft."
              checked={Boolean(form.is_active)}
              onChange={(value) => setField("is_active", value)}
            />
            <ToggleRow
              icon={<Check className="h-4 w-4" />}
              title="Human handoff"
              description="Pause automation for risky or low-confidence chats."
              help="Keeps the user safe when payment, refund, complaint, legal, or uncertain questions need a person."
              checked={form.human_handoff_enabled !== false}
              onChange={(value) => setField("human_handoff_enabled", value)}
            />
          </div>
          <div className="rounded-lg border border-black/10 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <SlidersHorizontal className="h-4 w-4" />
              Confidence threshold
              <InfoHint text="Higher value means the bot hands off to a human more often. Lower value means it replies more often." />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input type="range" min="0.3" max="0.95" step="0.01" value={form.confidence_threshold || 0.68} onChange={(e) => setField("confidence_threshold", Number(e.target.value))} className="flex-1 accent-[var(--arc)]" />
              <input type="number" min="0.3" max="0.95" step="0.01" value={form.confidence_threshold || 0.68} onChange={(e) => setField("confidence_threshold", Number(e.target.value))} className="w-20 rounded-md border border-black/10 px-2 py-2 text-sm" />
            </div>
          </div>
          <div className="rounded-lg border border-black/10 bg-white p-4 text-sm leading-6 text-[var(--slate)]">
            Replies stay short, use only your knowledge base, and move to human support when the answer is uncertain.
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[var(--slate)]">{label}</span>
      {children}
    </label>
  );
}

function AccountSelect({
  accounts,
  busy = false,
  value,
  onChange,
}: {
  accounts: any[];
  busy?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find((account) => account.id === value);

  if (!accounts.length && busy) {
    return (
      <div className="min-h-[52px] rounded-lg border border-black/10 bg-white px-4 py-3">
        <div className="h-4 w-52 animate-pulse rounded bg-black/[0.08]" />
        <div className="mt-2 h-3 w-64 max-w-full animate-pulse rounded bg-black/[0.05]" />
      </div>
    );
  }

  if (!accounts.length) {
    return (
      <div className="flex min-h-[52px] items-center gap-3 rounded-lg border border-dashed border-black/20 bg-[#f8f6f3] px-4 text-sm text-[var(--slate)]">
        <Instagram className="h-4 w-4 text-[var(--arc)]" />
        Auto-syncing from Social Pilot...
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        onBlur={() => window.setTimeout(() => setOpen(false), 140)}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-lg border border-black/10 bg-white px-4 text-left text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:border-black/20 focus:border-[var(--arc)] focus:outline-none focus:ring-4 focus:ring-orange-500/10"
      >
        <span className="flex min-w-0 items-center gap-3">
          <AccountAvatar account={selected} selected />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-[var(--ink)]">
              {selected ? `@${selected.instagram_username || selected.instagram_business_account_id}` : "Select account"}
            </span>
            <span className="block truncate text-xs text-[var(--slate)]">
              {selected?.page_name || "Instagram Professional account"}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--slate)] transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-lg border border-black/10 bg-white p-1 shadow-xl">
          {accounts.map((account) => {
            const isSelected = account.id === value;
            return (
              <button
                type="button"
                key={account.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(account.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm transition ${
                  isSelected ? "bg-orange-50 text-[var(--ink)]" : "text-[var(--ink)] hover:bg-[#f8f6f3]"
                }`}
              >
                <AccountAvatar account={account} selected={isSelected} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    @{account.instagram_username || account.instagram_business_account_id}
                  </span>
                  <span className="block truncate text-xs text-[var(--slate)]">
                    {account.page_name || account.page_id || "Connected via Social Pilot"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function AccountAvatar({ account, selected = false }: { account?: any; selected?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = account?.profile_picture_url;

  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full ${
        selected ? "bg-orange-50 text-[var(--arc)]" : "bg-[#f1eee9] text-[var(--arc)]"
      }`}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Instagram className="h-4 w-4" />
      )}
    </span>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-black/10 pb-3 text-sm font-semibold text-[var(--ink)]">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-700">{icon}</span>
      {title}
    </div>
  );
}

function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          type="button"
          key={option}
          onClick={() => onChange(option)}
          className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
            value === option ? "border-black bg-black text-white shadow-sm" : "border-black/10 bg-[#f8f6f3] text-[var(--slate)] hover:border-black/20 hover:bg-white hover:text-[var(--ink)]"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  help,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  help?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-black/10 bg-white p-4">
      <span className="flex gap-3">
        <span className="mt-0.5 text-gray-700">{icon}</span>
        <span>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ink)]">
            {title}
            {help ? <InfoHint text={help} /> : null}
          </span>
          <span className="mt-1 block text-xs leading-5 text-[var(--slate)]">{description}</span>
        </span>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-black" />
    </label>
  );
}

function InfoHint({ text }: { text: string }) {
  return (
    <Info
      className="h-3.5 w-3.5 shrink-0 cursor-help text-[var(--slate)]"
      aria-label={text}
      title={text}
    />
  );
}

function TagInput({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const safeArray = Array.isArray(value) ? value : [];
  return (
    <input
      value={safeArray.join(", ")}
      onChange={(event) => onChange(event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
      className="instapilot-input"
      placeholder="Comma separated"
    />
  );
}
