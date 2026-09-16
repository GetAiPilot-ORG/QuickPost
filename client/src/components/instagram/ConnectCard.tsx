import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, ChevronDown, ExternalLink, Instagram, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { startAutoDMInstagramOAuth } from "@/services/autodm/supabaseClient";
import {
  disconnectInstagramAccount,
  importSocialInstagramAccount,
  subscribeInstagramWebhook,
} from "@/services/instagramApi";

export default function ConnectCard({ accounts, onChanged }: { accounts: any[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const connectedAccounts = accounts.filter((account) => account.is_connected);

  const startMetaOAuth = async () => {
    const token = localStorage.getItem("quickpost_token");
    if (!token) {
      toast.error("Please log in again before connecting Instagram.");
      return;
    }

    try {
      const redirectTo = await startAutoDMInstagramOAuth(window.location.origin);
      window.location.assign(redirectTo);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Failed to start Instagram login");
    }
  };

  const importAccount = async () => {
    setBusy(true);
    try {
      await importSocialInstagramAccount();
      toast.success("Instagram account imported into InstaPilot");
      onChanged();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {connectedAccounts.map(account => (
        <InstagramAccountCard key={account.id} account={account} busy={busy} setBusy={setBusy} onChanged={onChanged} />
      ))}

      {connectedAccounts.length === 0 ? (
        <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
          <div className="flex flex-col gap-5 border-b border-black/10 bg-[#fffaf7] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-orange-50 text-[var(--arc)]">
                  <Instagram className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--arc)]">Instagram setup</p>
                  <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
                    Connect Instagram
                  </h2>
                </div>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--slate)]">
                Connect your Instagram Professional account. It will be used for InstaPilot replies.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={startMetaOAuth} className="gap-2 bg-[var(--arc)] text-white hover:bg-[#d95f27]">
                <ExternalLink className="h-4 w-4" />
                Connect Instagram
              </Button>
              <Button type="button" variant="outline" onClick={importAccount} disabled={busy} className="gap-2 bg-white">
                <RefreshCw className="h-4 w-4" />
                {busy ? "Syncing..." : "Sync"}
              </Button>
            </div>
          </div>
          <div className="p-5">
            <div className="rounded-lg border border-dashed border-black/15 bg-[#f8f6f3] p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--arc)]" />
                <div>
                  <h3 className="font-semibold text-[var(--ink)]">No Instagram account connected yet</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--slate)]">
                    Use Connect Instagram, or Sync if you already connected Instagram for autoposting.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="flex gap-4">
          <Button type="button" onClick={startMetaOAuth} variant="outline" className="gap-2 bg-white">
            <ExternalLink className="h-4 w-4" />
            Connect Another Account
          </Button>
          <Button type="button" variant="outline" onClick={importAccount} disabled={busy} className="gap-2 bg-white">
            <RefreshCw className="h-4 w-4" />
            {busy ? "Syncing..." : "Sync Accounts"}
          </Button>
        </div>
      )}
    </div>
  );
}

function InstagramAccountCard({ account, busy, setBusy, onChanged }: { account: any; busy: boolean; setBusy: (v: boolean) => void; onChanged: () => void }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const webhookReady = account.webhook_status === "active";
  const tokenReady = account.token_status === "active";
  const displayName = account.instagram_username ? `@${account.instagram_username}` : "Instagram account";

  const disconnect = async () => {
    setBusy(true);
    try {
      await disconnectInstagramAccount(account.id);
      toast.success("InstaPilot disconnected");
      onChanged();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Disconnect failed");
    } finally {
      setBusy(false);
    }
  };

  const subscribeWebhooks = async () => {
    setBusy(true);
    try {
      await subscribeInstagramWebhook(account.id);
      toast.success("Instagram webhook subscribed");
      onChanged();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Webhook subscription failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
      <div className="flex flex-col gap-5 border-b border-black/10 bg-[#fffaf7] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-orange-50 text-[var(--arc)] border border-orange-100 shadow-sm">
              {account.profile_picture_url ? (
                <img src={account.profile_picture_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Instagram className="h-5 w-5" />
              )}
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--arc)]">Connected Account</p>
              <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
                {displayName}
              </h2>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--slate)]">
            Your Instagram account is connected. InstaPilot automation is optional and separate from the main Social Inbox.
          </p>
        </div>
      </div>

      <div className="p-5">
        <div className="space-y-4">
          <div className="space-y-3">
            <StatusRow
              good={tokenReady}
              title={tokenReady ? "Instagram is connected" : "Reconnect needed"}
              text={tokenReady ? "Bot Builder can use this account." : "Your connection token needs refresh."}
            />
            <StatusRow
              good={webhookReady}
              title={webhookReady ? "Bot DM automation is ready" : "Bot DM automation needs setup"}
              text={webhookReady ? "InstaPilot can react to incoming DMs." : "The main Social Inbox still works; enable this only when you want InstaPilot to process DMs."}
            />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-black/10 pt-4">
            {!webhookReady ? (
              <Button type="button" onClick={subscribeWebhooks} disabled={busy} className="gap-2 bg-[var(--arc)] text-white hover:bg-[#d95f27]">
                <RefreshCw className="h-4 w-4" />
                Enable bot DM automation
              </Button>
            ) : null}
            <Button type="button" variant="outline" asChild className="bg-white">
              <Link to="/dashboard/instapilot/inbox">Open Inbox</Link>
            </Button>
            <Button type="button" variant="outline" onClick={disconnect} disabled={busy} className="gap-2 border-red-200 bg-white text-red-700 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
              Disconnect
            </Button>
          </div>
        </div>

        <div className="mt-5 border-t border-black/10 pt-4">
          <button
            type="button"
            onClick={() => setAdvancedOpen((current) => !current)}
            className="flex items-center gap-2 text-sm font-semibold text-[var(--slate)] transition hover:text-[var(--ink)]"
          >
            <ChevronDown className={`h-4 w-4 transition ${advancedOpen ? "rotate-180" : ""}`} />
            Advanced details
          </button>
          {advancedOpen ? (
            <div className="mt-4 rounded-lg border border-black/10 bg-[#f8f6f3] p-4">
              <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                <MetaField label="Page ID" value={account.page_id} />
                <MetaField label="IG Business ID" value={account.instagram_business_account_id} />
                <MetaField label="Token" value={account.token_status || "Unknown"} />
                <MetaField label="Expires" value={account.token_expires_at ? new Date(account.token_expires_at).toLocaleDateString() : "Unknown"} />
              </div>
              <p className="mt-4 text-xs leading-5 text-[var(--slate)]">
                InstaPilot replies only to user-initiated Instagram DMs through official Meta APIs.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function StatusRow({ good, title, text }: { good: boolean; title: string; text: string }) {
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${good ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${good ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
        {good ? <CheckCircle2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
      </span>
      <div>
        <div className="font-semibold text-[var(--ink)]">{title}</div>
        <div className="mt-0.5 text-sm text-[var(--slate)]">{text}</div>
      </div>
    </div>
  );
}

function MetaField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--slate)]">{label}</div>
      <div className="mt-1 break-all font-mono text-xs text-[var(--ink)]">{value || "Not available"}</div>
    </div>
  );
}
