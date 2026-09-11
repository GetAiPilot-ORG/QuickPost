import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  Inbox,
  Info,
  Link2,
  MessageCircle,
  Plus,
  Power,
  ShieldCheck,
  Sparkles,
  TestTube2,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import BotBuilderForm from "@/components/instagram/BotBuilderForm";
import KnowledgeBaseUploader from "@/components/instagram/KnowledgeBaseUploader";
import TestChat from "@/components/instagram/TestChat";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useDialog } from "@/context/DialogContext";
import { useInstagramAccounts } from "@/hooks/useInstagramAccounts";
import { useInstagramBots } from "@/hooks/useInstagramBots";
import { deleteInstagramBot, fetchInstagramAnalytics, updateInstagramBot } from "@/services/instagramApi";

export default function InstagramBots() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditMode = searchParams.has("mode") || searchParams.has("edit");

  const { connectedAccounts } = useAuth();
  const { confirm } = useDialog();
  const hasPostingInstagram = Boolean(connectedAccounts.instagram?.connected);
  const { accounts, loading: accountsLoading, syncing, refresh: refreshAccounts, syncFromSocialPilot } = useInstagramAccounts({
    autoSync: hasPostingInstagram,
  });
  const { bots, loading, error, refresh: refreshBots } = useInstagramBots();
  const [selectedBotId, setSelectedBotId] = useState<string | undefined>();
  const [analytics, setAnalytics] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [userSetStep, setUserSetStep] = useState(false);

  useEffect(() => {
    fetchInstagramAnalytics().then(setAnalytics).catch(() => null);
  }, []);

  useEffect(() => {
    if (!selectedBotId && bots[0]?.id) setSelectedBotId(bots[0].id);
  }, [bots, selectedBotId]);

  const selectedBot = useMemo(() => bots.find((bot) => bot.id === selectedBotId), [bots, selectedBotId]);
  const connectedAccount = accounts.find((account) => account.is_connected);
  const accountsBusy = accountsLoading || syncing;
  const activeBots = bots.filter((bot) => bot.is_active).length;
  const hasBot = bots.length > 0;

  useEffect(() => {
    if (!loading && activeBots > 0 && !isEditMode) {
      navigate("/dashboard/instapilot/inbox", { replace: true });
    }
  }, [loading, activeBots, isEditMode, navigate]);

  useEffect(() => {
    if (!userSetStep) {
      if (!connectedAccount) {
        setActiveStep(0);
      } else if (!selectedBot?.id) {
        setActiveStep(1);
      } else if (activeStep === 0) {
        setActiveStep(1);
      }
    }
  }, [connectedAccount, selectedBot?.id, userSetStep]);

  const removeBot = async (bot: any) => {
    const ok = await confirm(
      "Delete bot?",
      `Delete "${bot.bot_name}"? This removes its knowledge base and stops automation for this bot.`,
      {
        intent: "danger",
        confirmText: "Delete bot",
        cancelText: "Keep bot",
      },
    );
    if (!ok) return;
    try {
      await deleteInstagramBot(bot.id);
      toast.success("Bot deleted");
      if (selectedBotId === bot.id) setSelectedBotId(undefined);
      await refreshBots();
      fetchInstagramAnalytics().then(setAnalytics).catch(() => null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Failed to delete bot");
    }
  };

  if (loading && !isEditMode) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#f7f5f2]">
        <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-white px-6 py-4 shadow-sm text-sm font-semibold text-[var(--ink)]">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--arc)] border-t-transparent" />
          <span>Checking active InstaPilot bot...</span>
        </div>
      </div>
    );
  }

  if (!loading && activeBots > 0 && !isEditMode) {
    return null;
  }

  return (
    <div className="min-h-full bg-[#f7f5f2] px-4 py-5 lg:px-8">
      <div className="mx-auto max-w-[1320px] space-y-5">
        <header className="relative z-20 overflow-visible rounded-xl border border-black/10 bg-white shadow-sm">
          <div className="grid gap-5 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--arc)]">
                <Sparkles className="h-3.5 w-3.5" />
                Instagram AI Bot Builder
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[var(--ink)] sm:text-4xl">Build your Instagram DM bot</h1>
                <div className="group relative">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                    aria-label="What does this bot do?"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                  <div className="pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-50 hidden w-[340px] -translate-x-1/2 rounded-xl border border-blue-200 bg-white p-4 text-sm leading-6 text-blue-950 shadow-[0_18px_50px_rgba(15,23,42,0.18)] group-hover:block group-focus-within:block sm:left-full sm:top-1/2 sm:ml-3 sm:-translate-y-1/2 sm:translate-x-0">
                    <div className="mb-1 flex items-center gap-2 font-semibold text-blue-950">
                      <Info className="h-4 w-4 text-blue-700" />
                      Yeh bot kya karta hai?
                    </div>
                    <p className="text-blue-900">
                      Instagram DMs me customer questions ka answer deta hai using your business knowledge. Agar answer clear na ho, payment/refund issue ho, ya user human mange, bot chat ko human reply ke liye mark karta hai.
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--slate)]">
                Follow the 4 steps below. First connect, save bot identity, add knowledge base answers, then test & activate live. Click any step to switch view.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button variant="outline" asChild className="gap-2 bg-white">
                <Link to="/dashboard/instapilot/connect">
                  <Link2 className="h-4 w-4" />
                  Connect
                </Link>
              </Button>
              <Button variant="outline" type="button" onClick={() => setPreviewOpen(true)} className="gap-2 bg-white">
                <TestTube2 className="h-4 w-4" />
                Test preview
              </Button>
              <Button variant="outline" asChild className="gap-2 bg-white">
                <Link to="/dashboard/instapilot/inbox">
                  <Inbox className="h-4 w-4" />
                  Inbox
                </Link>
              </Button>
            </div>
          </div>
        </header>

        {/* 4-Step Interactive Wizard Header */}
        <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-4">
            <StepCard
              number="1"
              title="Connect"
              text={connectedAccount ? `@${connectedAccount.instagram_username || "instagram"} connected` : "Connect Instagram once"}
              done={Boolean(connectedAccount)}
              active={activeStep === 0}
              onClick={() => {
                setUserSetStep(true);
                setActiveStep(0);
              }}
            />
            <StepCard
              number="2"
              title="Bot details"
              text={selectedBot?.id ? `${selectedBot.bot_name} saved` : "Name, language, tone"}
              done={Boolean(selectedBot?.id)}
              active={activeStep === 1}
              onClick={() => {
                setUserSetStep(true);
                setActiveStep(1);
              }}
            />
            <StepCard
              number="3"
              title="Knowledge"
              text="FAQs, pricing, policies"
              done={Boolean(selectedBot?.id && (selectedBot?.knowledge_count > 0 || selectedBot?.sources_count > 0))}
              active={activeStep === 2}
              onClick={() => {
                setUserSetStep(true);
                setActiveStep(2);
              }}
            />
            <StepCard
              number="4"
              title="Test & activate"
              text="Preview & turn live"
              done={activeBots > 0}
              active={activeStep === 3}
              onClick={() => {
                setUserSetStep(true);
                setActiveStep(3);
              }}
            />
          </div>
        </section>

        <section className="rounded-xl border border-emerald-200 bg-[#eefdf5] p-4 text-sm leading-6 text-emerald-950">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="max-w-5xl">
              Official Meta APIs only. InstaPilot uses Meta Login/OAuth, Graph API, Instagram Messaging API, and webhooks.
              It does not use password login, scraping, browser automation, private APIs, cold DM automation, or spam messaging.
            </p>
          </div>
        </section>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--arc)]">
                    Workspace
                    <Info className="h-3.5 w-3.5 normal-case tracking-normal text-[var(--slate)]" title="Only one InstaPilot bot is allowed. Use Edit Existing Bot to update it." />
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">Bots</h2>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={hasBot ? "Edit existing bot" : "Create bot"}
                  title={hasBot ? "Edit Existing Bot" : "Create bot"}
                  onClick={() => {
                    if (bots[0]?.id) {
                      setSelectedBotId(bots[0].id);
                      toast("Only one InstaPilot bot is allowed. Editing existing bot.", { icon: "i" });
                      setUserSetStep(true);
                      setActiveStep(1);
                      return;
                    }
                    setSelectedBotId(undefined);
                    setUserSetStep(true);
                    setActiveStep(1);
                  }}
                >
                  {hasBot ? <Bot className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
              <div className="mt-4 space-y-2">
                {loading ? <p className="text-sm text-[var(--slate)]">Loading bots...</p> : null}
                {bots.map((bot) => (
                  <div
                    role="button"
                    tabIndex={0}
                    key={bot.id}
                    onClick={() => {
                      setSelectedBotId(bot.id);
                      if (activeStep === 0) setActiveStep(1);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedBotId(bot.id);
                        if (activeStep === 0) setActiveStep(1);
                      }
                    }}
                    className={`w-full rounded-lg border p-4 text-left transition ${
                      selectedBotId === bot.id ? "border-orange-300 bg-orange-50 text-[var(--ink)] shadow-sm" : "border-black/10 bg-[#f8f6f3] text-[var(--ink)] hover:border-black/20 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{bot.bot_name}</div>
                        <div className="mt-1 truncate text-xs opacity-75">{bot.business_name || "Business not set"}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                          bot.is_active ? "bg-emerald-100 text-emerald-700" : "bg-black/5 text-[var(--slate)]"
                        }`}>
                          {bot.is_active ? "Live" : "Draft"}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeBot(bot);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 opacity-80 transition hover:bg-red-50 hover:opacity-100"
                          aria-label={`Delete ${bot.bot_name}`}
                          title="Delete bot"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                      <span className="rounded bg-white px-2 py-1 text-[var(--slate)]">{bot.bot_goal}</span>
                      <span className="rounded bg-white px-2 py-1 text-[var(--slate)]">{bot.language}</span>
                    </div>
                  </div>
                ))}
                {!loading && bots.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-black/20 bg-[#f8f6f3] p-5 text-sm leading-6 text-[var(--slate)]">
                    You can create one InstaPilot bot for this workspace. Use the wizard steps to set up identity and knowledge base.
                  </div>
                ) : null}
              </div>
            </div>
            <QuickStats analytics={analytics} activeBots={activeBots} />
          </aside>

          {/* Dedicated Step Views */}
          <div className="space-y-5">
            {/* Step 1: Connect */}
            {activeStep === 0 && (
              <div className="space-y-5">
                <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3 border-b border-black/10 pb-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-[var(--arc)]">
                      <Link2 className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--arc)]">Step 1 of 4</p>
                      <h2 className="text-xl font-semibold text-[var(--ink)]">Instagram Account Connection</h2>
                    </div>
                  </div>
                  {connectedAccount ? (
                    <div className="mt-5 space-y-4">
                      <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                          <div>
                            <p className="font-semibold">Connected to @{connectedAccount.instagram_username || "instagram"}</p>
                            <p className="text-xs text-emerald-800">Your Instagram account is linked and ready for automation.</p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-md bg-emerald-600 px-3 py-1 text-xs font-bold text-white">Connected</span>
                      </div>
                      <div className="flex justify-end pt-2">
                        <Button
                          type="button"
                          onClick={() => {
                            setUserSetStep(true);
                            setActiveStep(1);
                          }}
                          className="gap-2 bg-[var(--arc)] text-white hover:bg-[#d95f27]"
                        >
                          <span>Proceed to Step 2: Bot Details</span>
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-4">
                      <p className="text-sm leading-6 text-[var(--slate)]">
                        Connect your official Instagram Professional / Business account once to enable DM automation.
                      </p>
                      {!connectedAccount && hasPostingInstagram && accountsBusy ? (
                        <SyncSkeleton />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {hasPostingInstagram ? (
                            <Button type="button" variant="outline" onClick={() => syncFromSocialPilot()} disabled={syncing}>
                              {syncing ? "Syncing..." : "Sync now"}
                            </Button>
                          ) : null}
                          <Button asChild className="gap-2">
                            <Link to="/dashboard/instapilot/connect">Connect Instagram Account</Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* Step 2: Bot Details */}
            {activeStep === 1 && (
              <div className="space-y-5">
                <BotBuilderForm
                  key={selectedBot?.id || "new"}
                  accounts={accounts}
                  accountsBusy={accountsBusy}
                  selectedBot={selectedBot}
                  onSaved={(savedBot) => {
                    if (savedBot?.id) setSelectedBotId(savedBot.id);
                    refreshAccounts();
                    refreshBots();
                    setUserSetStep(true);
                    setActiveStep(2); // Automatically advance to Step 3 (Knowledge Base)
                    toast.success("Bot saved! Moving to Knowledge Base configuration.");
                  }}
                />
                {selectedBot?.id ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-4 shadow-sm">
                    <p className="text-sm text-[var(--slate)]">Bot details saved. Ready to configure FAQs and knowledge base?</p>
                    <Button
                      type="button"
                      onClick={() => {
                        setUserSetStep(true);
                        setActiveStep(2);
                      }}
                      className="gap-2 bg-[var(--arc)] text-white hover:bg-[#d95f27]"
                    >
                      <span>Next: Add Knowledge Base</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            )}

            {/* Step 3: Knowledge Base */}
            {activeStep === 2 && (
              <div className="space-y-5">
                <KnowledgeBaseUploader botId={selectedBot?.id} />
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-4 shadow-sm">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setUserSetStep(true);
                      setActiveStep(1);
                    }}
                    className="gap-2 bg-white"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Bot Details</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setUserSetStep(true);
                      setActiveStep(3);
                    }}
                    className="gap-2 bg-[var(--arc)] text-white hover:bg-[#d95f27]"
                  >
                    <span>Next: Test & Activate Bot</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Test & Activate */}
            {activeStep === 3 && (
              <div className="space-y-5">
                <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
                  <div className="border-b border-black/10 bg-[#fffaf7] p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                          <TestTube2 className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">Step 4 of 4</p>
                          <h2 className="text-xl font-semibold text-[var(--ink)]">Test & Activate Bot</h2>
                        </div>
                      </div>
                      <span
                        className={`rounded-md px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] ${
                          selectedBot?.is_active ? "bg-emerald-100 text-emerald-800" : "bg-black/5 text-[var(--slate)]"
                        }`}
                      >
                        {selectedBot?.is_active ? "Live" : "Draft / Paused"}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-sm text-[var(--slate)]">
                      Test how your bot responds to user questions in real-time. Once your test responses look great, activate your bot live!
                    </p>
                  </div>
                </section>

                <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
                  <TestChat botId={selectedBot?.id} compact={false} showHeader={false} />

                  <div className="space-y-4">
                    <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
                      <h3 className="font-semibold text-[var(--ink)]">Live Activation</h3>
                      <p className="mt-1 text-xs leading-5 text-[var(--slate)]">
                        When active, this bot will automatically reply to incoming Instagram DMs using your saved knowledge base.
                      </p>
                      <div className="mt-5">
                        <Button
                          type="button"
                          onClick={async () => {
                            if (!selectedBot?.id) return;
                            try {
                              await updateInstagramBot(selectedBot.id, { is_active: !selectedBot.is_active });
                              toast.success(selectedBot.is_active ? "Bot paused" : "Bot activated live!");
                              refreshBots();
                            } catch (err: any) {
                              toast.error(err.message || "Failed to update status");
                            }
                          }}
                          disabled={!selectedBot?.id}
                          className={`w-full gap-2 py-6 text-base font-bold shadow-sm ${
                            selectedBot?.is_active
                              ? "bg-amber-600 text-white hover:bg-amber-700"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          <Power className="h-5 w-5" />
                          {selectedBot?.is_active ? "Pause Bot" : "Activate Bot Live"}
                        </Button>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setUserSetStep(true);
                        setActiveStep(2);
                      }}
                      className="w-full gap-2 bg-white"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Back to Knowledge Base</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <PreviewDrawer open={previewOpen} onClose={() => setPreviewOpen(false)} botId={selectedBot?.id} />
    </div>
  );
}

function SyncSkeleton() {
  return (
    <section className="rounded-xl border border-black/10 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-black/[0.08]" />
          <div className="h-3 w-[520px] max-w-full animate-pulse rounded bg-black/[0.06]" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 animate-pulse rounded-lg bg-black/[0.06]" />
          <div className="h-9 w-36 animate-pulse rounded-lg bg-black/[0.08]" />
        </div>
      </div>
    </section>
  );
}

function StepCard({
  number,
  title,
  text,
  done,
  active,
  onClick,
}: {
  number: string;
  title: string;
  text: string;
  done: boolean;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-xl border p-4 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--arc)]/20 ${
        active
          ? "border-[var(--arc)] bg-[#fff7f2] shadow-md ring-2 ring-[var(--arc)]/20"
          : done
            ? "border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 hover:bg-emerald-50"
            : "border-black/10 bg-[#f8f6f3] hover:border-black/20 hover:bg-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-transform group-hover:scale-105 ${
            done
              ? "bg-emerald-600 text-white shadow-sm"
              : active
                ? "bg-[var(--arc)] text-white shadow-sm"
                : "bg-white text-[var(--slate)] border border-black/10"
          }`}
        >
          {done ? <CheckCircle2 className="h-4 w-4" /> : number}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
            <span>{title}</span>
            {active ? <span className="h-2 w-2 rounded-full bg-[var(--arc)] animate-pulse" /> : null}
          </div>
          <div className="truncate text-xs text-[var(--slate)]">{text}</div>
        </div>
      </div>
    </button>
  );
}

function PreviewDrawer({ open, onClose, botId }: { open: boolean; onClose: () => void; botId?: string }) {
  return (
    <div className={`fixed inset-0 z-[90] ${open ? "" : "pointer-events-none"}`}>
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        className={`absolute inset-0 bg-black/25 backdrop-blur-[2px] transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-[430px] overflow-y-auto bg-[#f7f5f2] shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white px-5 py-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--arc)]">Preview</p>
            <h2 className="text-lg font-semibold text-[var(--ink)]">Test bot replies</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--slate)] transition hover:text-[var(--ink)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3">
          <TestChat botId={botId} compact showHeader={false} />
        </div>
      </aside>
    </div>
  );
}

function QuickStats({ analytics, activeBots }: { analytics?: any; activeBots: number }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--arc)]">Today at a glance</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniStat icon={<Bot className="h-4 w-4" />} label="Live bots" value={activeBots} />
        <MiniStat icon={<MessageCircle className="h-4 w-4" />} label="Chats" value={analytics?.totalConversations || 0} />
        <MiniStat icon={<BookOpen className="h-4 w-4" />} label="Handoffs" value={analytics?.humanHandoffs || 0} />
        <MiniStat icon={<Zap className="h-4 w-4" />} label="Leads" value={analytics?.leadsCaptured || 0} />
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[#f8f6f3] p-3">
      <div className="flex items-center gap-2 text-[var(--slate)]">{icon}<span className="text-[11px] font-semibold">{label}</span></div>
      <div className="mt-2 text-xl font-semibold text-[var(--ink)]">{value}</div>
    </div>
  );
}
