import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ExternalLink,
  Inbox,
  Info,
  Instagram,
  Link2,
  MessageCircle,
  Plus,
  Power,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TestTube2,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import BotBuilderForm from "@/components/instagram/BotBuilderForm";
import InfoHelp from "@/components/InfoHelp";
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

  const wizardSteps = [
    {
      id: 0,
      number: "1",
      title: "Connect Account",
      subtitle: connectedAccount ? `@${connectedAccount.instagram_username || "instagram"}` : "Link official profile",
      done: Boolean(connectedAccount),
    },
    {
      id: 1,
      number: "2",
      title: "Bot Persona",
      subtitle: selectedBot?.id ? selectedBot.bot_name || "Bot details" : "Name, goal & prompt",
      done: Boolean(selectedBot?.id),
    },
    {
      id: 2,
      number: "3",
      title: "Knowledge Base",
      subtitle: selectedBot?.id ? "FAQs & Business docs" : "Unlock via Step 2",
      done: Boolean(selectedBot?.id && ((selectedBot as any)?.knowledge_count > 0 || (selectedBot as any)?.sources_count > 0)),
    },
    {
      id: 3,
      number: "4",
      title: "Test & Go Live",
      subtitle: activeBots > 0 ? "Automations Live" : "Simulator & Turn On",
      done: activeBots > 0,
    },
  ];

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
    <div className="min-h-full bg-[#f7f5f2] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1360px] space-y-6">

        {/* 1. Header Row */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
              Build your Instagram DM bot
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="gap-2 bg-white shadow-sm hover:border-[var(--arc)]"
            >
              <TestTube2 className="h-4 w-4 text-[var(--arc)]" />
              <span>Test Simulator</span>
            </Button>
            <Button
              variant="outline"
              asChild
              className="gap-2 bg-white shadow-sm hover:border-[var(--arc)]"
            >
              <Link to="/dashboard/instapilot/inbox">
                <Inbox className="h-4 w-4 text-[var(--arc)]" />
                <span>Social Inbox</span>
              </Link>
            </Button>
          </div>
        </header>

        {/* 2. Interactive Segmented Stepper */}
        <nav aria-label="Bot builder steps" className="rounded-xl border border-black/10 bg-white p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {wizardSteps.map((step) => {
              const isActive = activeStep === step.id;
              const isDone = step.done;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    setUserSetStep(true);
                    setActiveStep(step.id);
                  }}
                  className={`group relative flex items-center gap-3 rounded-lg p-3 text-left transition-all focus:outline-none ${
                    isActive
                      ? "border border-orange-200 bg-orange-50/70 shadow-sm"
                      : isDone
                        ? "border border-transparent bg-transparent hover:bg-emerald-50/40"
                        : "border border-transparent bg-transparent hover:bg-gray-50"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-transform group-hover:scale-105 ${
                      isActive
                        ? "bg-[var(--arc)] text-white shadow-sm"
                        : isDone
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-gray-100 text-[var(--slate)] border border-black/5"
                    }`}
                  >
                    {isDone ? <Check className="h-4 w-4 stroke-[2.5]" /> : step.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-semibold ${isActive ? "text-[var(--arc)]" : "text-[var(--ink)]"}`}>
                        {step.title}
                      </span>
                      {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[var(--arc)] animate-pulse" />}
                    </div>
                    <p className="truncate text-[11px] text-[var(--slate)]">
                      {step.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm">
            {error}
          </div>
        )}

        {/* 3. Main Workspace Grid */}
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">

          {/* Left Column: Bot Control Deck & Quick Stats */}
          <aside className="space-y-5">
            {/* Active Bot Card */}
            <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-black/10 pb-3">
                <span className="flex items-center gap-2 text-xs font-semibold text-[var(--arc)]">
                  <Bot className="h-4 w-4" />
                  Bot Control Deck
                </span>
                {hasBot && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedBotId(undefined);
                      setUserSetStep(true);
                      setActiveStep(1);
                    }}
                    className="h-7 text-xs text-[var(--slate)] hover:text-[var(--arc)] px-2"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    New
                  </Button>
                )}
              </div>

              {selectedBot ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-[var(--arc)] text-white shadow-sm">
                        <Bot className="h-6 w-6" />
                        <span
                          className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white ${
                            selectedBot.is_active ? "bg-emerald-500 animate-pulse" : "bg-gray-300"
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-[var(--ink)]">
                          {selectedBot.bot_name || "InstaPilot Bot"}
                        </h3>
                        <p className="truncate text-xs text-[var(--slate)]">
                          {selectedBot.business_name || (connectedAccount ? `@${connectedAccount.instagram_username}` : "Draft")}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeBot(selectedBot)}
                      className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Delete bot"
                      aria-label="Delete bot"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Status Toggle Card */}
                  <div className="rounded-lg border border-black/10 bg-[#fbf9f6] p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-medium text-[var(--slate)]">Live status</div>
                      <div className={`text-xs font-bold ${selectedBot.is_active ? "text-emerald-700" : "text-gray-600"}`}>
                        {selectedBot.is_active ? "Active & Replying" : "Paused / Draft"}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={selectedBot.is_active ? "outline" : "default"}
                      onClick={async () => {
                        try {
                          await updateInstagramBot(selectedBot.id, { is_active: !selectedBot.is_active });
                          toast.success(selectedBot.is_active ? "Bot paused." : "Bot activated live!");
                          refreshBots();
                        } catch (err: any) {
                          toast.error(err.message || "Failed to update bot status");
                        }
                      }}
                      className={`gap-1.5 text-xs font-semibold h-8 ${
                        selectedBot.is_active
                          ? "bg-white hover:bg-gray-50 border-black/10"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {selectedBot.is_active ? "Pause" : "Go Live"}
                    </Button>
                  </div>

                  {/* Quick Metadata Chips */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-gray-50 p-2 border border-black/5">
                      <span className="text-[10px] text-[var(--slate)] block">Goal</span>
                      <span className="font-semibold capitalize text-[var(--ink)] truncate block">
                        {selectedBot.bot_goal || "Support"}
                      </span>
                    </div>
                    <div className="rounded-md bg-gray-50 p-2 border border-black/5">
                      <span className="text-[10px] text-[var(--slate)] block">Tone</span>
                      <span className="font-semibold capitalize text-[var(--ink)] truncate block">
                        {selectedBot.tone || "Friendly"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-black/20 bg-[#fcfbfa] p-4 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-[var(--arc)]">
                    <Bot className="h-5 w-5" />
                  </div>
                  <h3 className="mt-2 text-xs font-bold text-[var(--ink)]">No bot active yet</h3>
                  <p className="mt-1 text-[11px] leading-4 text-[var(--slate)]">
                    Complete the 4 steps on the right to train and launch your automated assistant.
                  </p>
                </div>
              )}
            </div>

            {/* Performance Stats */}
            <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-black/10 pb-3">
                <span className="text-xs font-semibold text-[var(--arc)]">Performance & Activity</span>
                <span className="text-[10px] text-[var(--slate)]">Last 30 days</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <MiniStat icon={<Bot className="h-4 w-4" />} label="Live bots" value={activeBots} />
                <MiniStat icon={<MessageCircle className="h-4 w-4" />} label="DMs replied" value={analytics?.totalConversations || 0} />
                <MiniStat icon={<BookOpen className="h-4 w-4" />} label="Handoffs" value={analytics?.humanHandoffs || 0} />
                <MiniStat icon={<Zap className="h-4 w-4" />} label="Leads captured" value={analytics?.leadsCaptured || 0} />
              </div>
            </div>

            {/* Meta Official APIs Guarantee */}
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4 text-xs text-emerald-950 space-y-1.5 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>100% Anti-Ban Protection</span>
              </div>
              <p className="leading-relaxed text-[11.5px] text-emerald-800">
                Runs strictly via official Meta OAuth & Graph Messaging APIs. No scraping, no password sharing, zero account risk.
              </p>
            </div>
          </aside>

          {/* Right Column: Active Studio View */}
          <main className="space-y-6">

            {/* STEP 1: Connect Account */}
            {activeStep === 0 && (
              <section className="rounded-xl border border-black/10 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-black/10 bg-[#fffaf7] p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-[var(--arc)]">
                      <Link2 className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[var(--arc)]">Step 1 of 4</span>
                        <span className="h-1 w-1 rounded-full bg-gray-300" />
                        <span className="text-xs text-[var(--slate)]">Account Authorization</span>
                      </div>
                      <h2 className="text-xl font-bold tracking-tight text-[var(--ink)] sm:text-2xl">
                        Instagram Account Connection
                      </h2>
                    </div>
                  </div>
                </div>

                <div className="p-5 sm:p-6 space-y-6">
                  {connectedAccount ? (
                    <div className="space-y-6">
                      {/* Connected Showcase Card */}
                      <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-5 sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-400 bg-emerald-100">
                                {connectedAccount.profile_picture_url ? (
                                  <img
                                    src={connectedAccount.profile_picture_url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Instagram className="h-7 w-7 text-emerald-700" />
                                )}
                              </span>
                              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                                <Check className="h-3 w-3 stroke-[3]" />
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-[var(--ink)]">
                                  @{connectedAccount.instagram_username || "instagram_user"}
                                </h3>
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                                  Verified Connected
                                </span>
                              </div>
                              <p className="text-xs text-[var(--slate)]">
                                {connectedAccount.page_name || "Instagram Professional Account"} • ID: {connectedAccount.instagram_business_account_id || connectedAccount.id}
                              </p>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            asChild
                            className="bg-white hover:bg-gray-50 border-black/10 text-xs self-start sm:self-auto"
                          >
                            <Link to="/dashboard/instapilot/connect">
                              <span>Switch Account</span>
                              <ExternalLink className="h-3.5 w-3.5 ml-1" />
                            </Link>
                          </Button>
                        </div>

                        {/* Integration checklist */}
                        <div className="mt-5 grid gap-3 sm:grid-cols-3 pt-4 border-t border-emerald-200/60">
                          <div className="flex items-start gap-2.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-xs font-semibold text-emerald-950 block">Official Graph API</span>
                              <span className="text-[11px] text-emerald-800">Meta OAuth verified</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-xs font-semibold text-emerald-950 block">Inbound DM Webhooks</span>
                              <span className="text-[11px] text-emerald-800">Instant real-time triggers</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-xs font-semibold text-emerald-950 block">Safe Rate Limits</span>
                              <span className="text-[11px] text-emerald-800">Anti-ban token safety</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Proceed CTA */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                        <p className="text-xs text-[var(--slate)]">
                          Your Instagram account is ready. Proceed to configure your bot's identity and replies.
                        </p>
                        <Button
                          type="button"
                          onClick={() => {
                            setUserSetStep(true);
                            setActiveStep(1);
                          }}
                          className="w-full sm:w-auto gap-2 bg-[var(--arc)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#d95f27] shadow-sm"
                        >
                          <span>Proceed to Step 2: Bot Persona</span>
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="rounded-xl border border-dashed border-black/20 bg-[#faf8f5] p-6 text-center space-y-3">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 text-white shadow-md">
                          <Instagram className="h-8 w-8" />
                        </div>
                        <h3 className="text-lg font-bold text-[var(--ink)]">
                          Connect your Instagram Professional Account
                        </h3>
                        <p className="mx-auto max-w-lg text-sm text-[var(--slate)]">
                          Connect the Instagram account associated with your Facebook Business Page. InstaPilot listens to incoming DMs and triggers smart automated responses.
                        </p>

                        {!connectedAccount && hasPostingInstagram && accountsBusy ? (
                          <div className="pt-2">
                            <SyncSkeleton />
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                            {hasPostingInstagram && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => syncFromSocialPilot()}
                                disabled={syncing}
                                className="gap-2 bg-white"
                              >
                                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                                <span>{syncing ? "Syncing..." : "Sync from Social Pilot"}</span>
                              </Button>
                            )}
                            <Button
                              asChild
                              className="gap-2 bg-[var(--arc)] px-6 text-white hover:bg-[#d95f27]"
                            >
                              <Link to="/dashboard/instapilot/connect">
                                <Instagram className="h-4 w-4" />
                                <span>Connect Instagram Account</span>
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* STEP 2: Bot Persona & Rules */}
            {activeStep === 1 && (
              <div className="space-y-6">
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
                    setActiveStep(2);
                    toast.success("Bot saved! Moving to Knowledge Base configuration.");
                  }}
                />

                {selectedBot?.id && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-4 shadow-sm">
                    <p className="text-xs text-[var(--slate)]">
                      Bot persona saved. Ready to feed your business FAQs and training data?
                    </p>
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
                )}
              </div>
            )}

            {/* STEP 3: Knowledge Base */}
            {activeStep === 2 && (
              <div className="space-y-6">
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

            {/* STEP 4: Test & Go Live */}
            {activeStep === 3 && (
              <div className="space-y-6">
                <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
                  <div className="border-b border-black/10 bg-[#fffaf7] p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                          <TestTube2 className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-emerald-700">Step 4 of 4</span>
                            <span className="h-1 w-1 rounded-full bg-gray-300" />
                            <span className="text-xs text-[var(--slate)]">Verification & Launch</span>
                          </div>
                          <h2 className="text-xl font-bold tracking-tight text-[var(--ink)] sm:text-2xl">
                            Test & Activate Bot
                          </h2>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-3.5 py-1 text-xs font-bold ${
                          selectedBot?.is_active
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-gray-100 text-[var(--slate)] border border-black/5"
                        }`}
                      >
                        {selectedBot?.is_active ? "● Live & Replying" : "○ Paused / Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="p-5 sm:p-6">
                    <p className="text-sm text-[var(--slate)]">
                      Simulate actual customer conversations in real-time. Once your test responses look sharp, activate your bot live!
                    </p>
                  </div>
                </section>

                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                  {/* Simulator */}
                  <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
                    <div className="border-b border-black/10 bg-gray-50/70 px-4 py-3 text-xs font-semibold text-[var(--ink)] flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-[var(--arc)]" />
                        Live DM Simulator
                      </span>
                      <span className="text-[11px] text-[var(--slate)]">Powered by your Knowledge Base</span>
                    </div>
                    <div className="p-3">
                      <TestChat
                        botId={selectedBot?.id}
                        systemPrompt={selectedBot?.system_prompt}
                        compact={false}
                        showHeader={false}
                      />
                    </div>
                  </div>

                  {/* Go Live Deck */}
                  <div className="space-y-4">
                    <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm space-y-4">
                      <h3 className="font-bold text-[var(--ink)] text-base">Live Activation</h3>
                      <p className="text-xs leading-relaxed text-[var(--slate)]">
                        When active, InstaPilot will autonomously reply to incoming Instagram DMs using your trained knowledge base and prompt instructions.
                      </p>

                      <div className="space-y-2.5 pt-2">
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
                          className={`w-full gap-2 py-6 text-base font-bold shadow-md transition-all ${
                            selectedBot?.is_active
                              ? "bg-amber-600 text-white hover:bg-amber-700"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          <Power className="h-5 w-5" />
                          {selectedBot?.is_active ? "Pause Bot" : "Activate Bot Live"}
                        </Button>

                        <Button
                          asChild
                          variant="outline"
                          className="w-full gap-2 bg-white"
                        >
                          <Link to="/dashboard/instapilot/inbox">
                            <Inbox className="h-4 w-4" />
                            <span>View Social Inbox</span>
                          </Link>
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
          </main>
        </div>
      </div>

      <PreviewDrawer
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        botId={selectedBot?.id}
        systemPrompt={selectedBot?.system_prompt}
      />
    </div>
  );
}

function SyncSkeleton() {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-5">
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
    </div>
  );
}

function PreviewDrawer({
  open,
  onClose,
  botId,
  systemPrompt,
}: {
  open: boolean;
  onClose: () => void;
  botId?: string;
  systemPrompt?: string;
}) {
  return (
    <div className={`fixed inset-0 z-[90] ${open ? "" : "pointer-events-none"}`}>
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        className={`absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-[440px] overflow-y-auto bg-[#f7f5f2] shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white px-5 py-4">
          <div>
            <span className="text-xs font-semibold text-[var(--arc)]">Interactive Preview</span>
            <h2 className="text-lg font-bold text-[var(--ink)]">Test Bot Simulator</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--slate)] transition hover:text-[var(--ink)] hover:bg-gray-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3">
          <TestChat botId={botId} systemPrompt={systemPrompt} compact showHeader={false} />
        </div>
      </aside>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50/80 border border-black/5 p-3 transition hover:bg-white hover:shadow-xs">
      <div className="flex items-center gap-1.5 text-[var(--slate)]">
        {icon}
        <span className="text-[11px] font-medium truncate">{label}</span>
      </div>
      <div className="mt-1.5 text-xl font-bold tracking-tight text-[var(--ink)]">{value}</div>
    </div>
  );
}
