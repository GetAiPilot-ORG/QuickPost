import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bot,
  Inbox,
  Instagram,
  RefreshCw,
  RotateCcw,
  TestTube2,
  X,
} from "lucide-react";
import BotBuilderForm from "@/components/instagram/BotBuilderForm";
import KnowledgeBaseUploader from "@/components/instagram/KnowledgeBaseUploader";
import TestChat from "@/components/instagram/TestChat";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useInstagramAccounts } from "@/hooks/useInstagramAccounts";
import { useInstagramBots } from "@/hooks/useInstagramBots";

export default function InstagramBots() {
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.has("mode") || searchParams.has("edit");

  const { connectedAccounts } = useAuth();
  const hasPostingInstagram = Boolean(connectedAccounts.instagram?.connected);
  const { accounts, loading: accountsLoading, syncing, refresh: refreshAccounts, syncFromSocialPilot } = useInstagramAccounts({
    autoSync: hasPostingInstagram,
  });
  const { bots, loading, error, refresh: refreshBots } = useInstagramBots();
  const [selectedBotId, setSelectedBotId] = useState<string | undefined>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"persona" | "knowledge">("persona");

  useEffect(() => {
    if (!selectedBotId && bots[0]?.id) setSelectedBotId(bots[0].id);
  }, [bots, selectedBotId]);

  const selectedBot = useMemo(() => bots.find((bot) => bot.id === selectedBotId), [bots, selectedBotId]);
  const connectedAccount = accounts.find((account) => account.is_connected);
  const accountsBusy = accountsLoading || syncing;
  const knowledgeCount = (selectedBot as any)?.knowledge_count || (selectedBot as any)?.sources_count || 0;

  if (loading && !isEditMode) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#f7f5f2]">
        <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-white px-6 py-4 shadow-sm text-sm font-semibold text-[var(--ink)]">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--arc)] border-t-transparent" />
          <span>Loading InstaPilot bot...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f8f7f5] px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">

        {/* 1. Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-black/[0.08] pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Instagram DM AI Bot
            </h1>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              {connectedAccount ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 font-medium text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  @{connectedAccount.instagram_username || "instagram"}
                </span>
              ) : (
                <span className="text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/70">
                  No Instagram account linked
                </span>
              )}

              {selectedBot?.is_active && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 border border-black/5 px-2.5 py-0.5 font-medium text-gray-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Bot live
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="gap-2 bg-white border-black/10 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-black shadow-xs h-9"
            >
              <TestTube2 className="h-3.5 w-3.5 text-gray-500" />
              <span>Test Simulator</span>
            </Button>
            <Button
              variant="outline"
              asChild
              className="gap-2 bg-white border-black/10 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-black shadow-xs h-9"
            >
              <Link to="/dashboard/instapilot/inbox">
                <Inbox className="h-3.5 w-3.5 text-gray-500" />
                <span>Social Inbox</span>
              </Link>
            </Button>
          </div>
        </header>

        {/* 2. Sleek 2-Tab Navigation */}
        <div className="flex border-b border-black/[0.08]">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("persona")}
              className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "persona"
                  ? "border-black text-gray-950 font-bold"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <Bot className="h-4 w-4" />
              <span>Persona & Behavior</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("knowledge")}
              className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === "knowledge"
                  ? "border-black text-gray-950 font-bold"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Knowledge Base</span>
              {knowledgeCount > 0 ? (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                  {knowledgeCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
            {error}
          </div>
        )}

        {/* 3. Studio Content */}
        <main className="space-y-6">
          {activeTab === "persona" && (
            <BotBuilderForm
              key={selectedBot?.id || "new"}
              accounts={accounts}
              accountsBusy={accountsBusy}
              selectedBot={selectedBot}
              onSaved={(savedBot) => {
                if (savedBot?.id) setSelectedBotId(savedBot.id);
                refreshAccounts();
                refreshBots();
              }}
            />
          )}

          {activeTab === "knowledge" && (
            <div className="space-y-4">
              <KnowledgeBaseUploader botId={selectedBot?.id} />
              
              <div className="flex items-center justify-between rounded-xl border border-black/[0.08] bg-white p-4 shadow-xs">
                <span className="text-xs text-gray-500">
                  Knowledge indexed is automatically queried by InstaPilot when answering customer DMs.
                </span>
                <Button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="gap-2 bg-[var(--arc)] text-xs font-semibold text-white hover:bg-[#d95f27] h-9"
                >
                  <TestTube2 className="h-3.5 w-3.5" />
                  <span>Test in Simulator</span>
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>

      <PreviewDrawer
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        botId={selectedBot?.id}
        systemPrompt={selectedBot?.system_prompt}
        account={connectedAccount}
      />
    </div>
  );
}

function SyncSkeleton() {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <div className="space-y-2">
        <div className="h-4 w-60 animate-pulse rounded bg-black/[0.06]" />
        <div className="h-3 w-80 animate-pulse rounded bg-black/[0.04]" />
      </div>
    </div>
  );
}

function PreviewDrawer({
  open,
  onClose,
  botId,
  systemPrompt,
  account,
}: {
  open: boolean;
  onClose: () => void;
  botId?: string;
  systemPrompt?: string;
  account?: any;
}) {
  const [resetKey, setResetKey] = useState(0);

  return (
    <div className={`fixed inset-0 z-[90] ${open ? "" : "pointer-events-none"}`}>
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-[480px] bg-white shadow-2xl transition-transform duration-300 ease-out flex flex-col z-10 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Authentic Instagram Direct Header */}
        <div className="flex items-center justify-between border-b border-black/[0.08] px-4 py-3 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-gray-50 text-gray-800 shadow-2xs">
                {account?.profile_picture_url ? (
                  <img src={account.profile_picture_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Instagram className="h-5 w-5 text-gray-600" />
                )}
              </span>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-gray-900 leading-tight">
                  @{account?.instagram_username || "instagram_user"}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 leading-tight mt-0.5">
                Active now • DM Simulation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setResetKey((k) => k + 1)}
              title="Reset conversation"
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:text-black hover:bg-gray-100"
              aria-label="Reset conversation"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:text-black hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <TestChat
            key={resetKey}
            botId={botId}
            systemPrompt={systemPrompt}
            fullHeight={true}
            showHeader={false}
          />
        </div>
      </aside>
    </div>
  );
}
