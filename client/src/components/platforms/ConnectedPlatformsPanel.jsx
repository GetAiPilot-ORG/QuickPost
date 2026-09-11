import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Info,
  RefreshCw,
  ShieldCheck,
  Unlink,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useDialog } from "../../context/DialogContext";
import apiClient from "../../utils/apiClient";
import { countConnectedTargets } from "../../utils/connectedAccounts";
import FacebookSetupModal from "../FacebookSetupModal";

const PLATFORM_META = [
  {
    id: "instagram",
    name: "Instagram",
    icon: "/icons/ig-instagram-icon.svg",
    prerequisite:
      "Instagram Professional account Facebook Page/Business se linked hona chahiye. Same connection Auto Posting, AutoDM aur InstaPilot use karte hain.",
    connectLabel: "Connect Instagram",
    oauth: true,
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "/icons/facebook-round-color-icon.svg",
    prerequisite:
      "Facebook Page access required hai. Instagram connect karne ke liye linked Page zaruri hota hai.",
    connectLabel: "Connect Facebook",
    oauth: true,
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: "/icons/youtube-color-icon.svg",
    prerequisite: "YouTube channel access aur posting permission required hai.",
    connectLabel: "Connect YouTube",
    oauth: true,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "/icons/linkedin-icon.svg",
    prerequisite: "LinkedIn profile or Page permission required hai.",
    connectLabel: "Open connector",
  },
  {
    id: "threads",
    name: "Threads",
    icon: "/icons/threads-icon.svg",
    prerequisite: "Threads profile authorization required hai. Multiple Threads accounts ko separately connect kar sakte hain.",
    connectLabel: "Connect Threads",
    oauth: true,
  },
  {
    id: "pinterest",
    name: "Pinterest",
    icon: "/icons/pinterest-round-color-icon.svg",
    prerequisite: "Pinterest business/profile account aur board access required hai.",
    connectLabel: "Open connector",
  },
  {
    id: "bluesky",
    name: "Bluesky",
    icon: "/icons/bluesky-circle-color-icon.svg",
    prerequisite: "Bluesky handle aur app password required hota hai.",
    connectLabel: "Open connector",
  },
  {
    id: "mastodon",
    name: "Mastodon",
    icon: "/icons/mastodon-round-icon.svg",
    prerequisite: "Mastodon server URL aur account authorization required hai.",
    connectLabel: "Open connector",
  },
];

function getStatus(platform, account, autoDMState) {
  const connected = Boolean(account?.connected);
  if (platform.id === "instagram" && connected && autoDMState?.autoDMStorageError) {
    return {
      label: "Sync Issue",
      tone: "warning",
      help: "Posting connection active hai, lekin AutoDM storage sync ko server config chahiye.",
    };
  }
  if (connected) {
    return { label: "Connected", tone: "success", help: "Ready to use across connected features." };
  }
  if (platform.id === "instagram" || platform.id === "facebook") {
    return { label: "Action Required", tone: "warning", help: "Connect once to unlock dependent Instagram features." };
  }
  return { label: "Not Connected", tone: "neutral", help: "Connect when you want to use this platform." };
}

function statusClass(tone) {
  if (tone === "success") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (tone === "warning") return "bg-amber-50 text-amber-800 border-amber-200";
  if (tone === "danger") return "bg-red-50 text-red-700 border-red-200";
  return "bg-black/[0.04] text-[var(--slate)] border-black/10";
}

function PlatformIcon({ platform }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white">
      <img src={platform.icon} alt="" className="h-6 w-6 object-contain" />
    </div>
  );
}

export default function ConnectedPlatformsPanel({
  autoDMState,
  compact = false,
  showBillingSummary = false,
}) {
  const { connectedAccounts, refreshAccounts, user } = useAuth();
  const { confirm, alert } = useDialog();
  const [busy, setBusy] = useState(null);
  const [showFacebookModal, setShowFacebookModal] = useState(false);

  const connectedCount = useMemo(() => countConnectedTargets(connectedAccounts), [connectedAccounts]);

  const { connectedPlatforms, unconnectedPlatforms } = useMemo(() => {
    const connected = [];
    const unconnected = [];
    PLATFORM_META.forEach((platform) => {
      const account = connectedAccounts?.[platform.id] || {};
      const platformAccounts = platform.id === "instagram"
        ? connectedAccounts?.instagramAccounts || []
        : connectedAccounts?.[`${platform.id}Accounts`] || [];
      const isConnected = Boolean(account.connected || platformAccounts.length);
      if (isConnected) {
        connected.push(platform);
      } else {
        unconnected.push(platform);
      }
    });
    return { connectedPlatforms: connected, unconnectedPlatforms: unconnected };
  }, [connectedAccounts]);

  const connectPlatform = async (platform) => {
    const limit = user?.entitlements?.limits?.social_accounts || 1;
    if (connectedCount >= limit) {
      await alert(
        "Upgrade Required",
        `You have reached your limit of ${limit} social account${limit === 1 ? '' : 's'} on the ${user?.entitlements?.plan?.name || 'Free'} plan. Please upgrade to connect more channels.`,
        { intent: "warning" }
      );
      return;
    }

    const token = localStorage.getItem("quickpost_token");
    if (platform.oauth) {
      if (!token) {
        await alert("Login required", "Please login again, then connect the platform.", { intent: "warning" });
        return;
      }
      if (platform.id === "facebook") {
        setShowFacebookModal(true);
        return;
      }
      window.location.href = `/api/auth/${platform.id}?token=${token}`;
      return;
    }
    await alert(
      `${platform.name} connector`,
      "Dashboard ke Connect Channels popup se is platform ko connect karein. Is panel mein status aur disconnect centralized rahega.",
      { intent: "primary" },
    );
  };

  const disconnectPlatform = async (platform, accountId = null) => {
    const isInstagramPlatform = platform.id === "instagram";
    const body = isInstagramPlatform
      ? `${platform.name} disconnect karne par related posting, AutoDM, ya bot features pause ho jayenge. Aapke automations safe rahenge aur reconnect karne par restore ho jayenge.`
      : `${platform.name} disconnect karne par related posting, AutoDM, ya bot features pause ho sakte hain.`;
    const ok = await confirm(
      `Disconnect ${platform.name}?`,
      body,
      { intent: "warning", confirmText: "Disconnect", cancelText: "Keep connected" },
    );
    if (!ok) return;
    setBusy(accountId || platform.id);
    try {
      const url = accountId ? `/api/auth/disconnect/${platform.id}?accountId=${accountId}` : `/api/auth/disconnect/${platform.id}`;
      await apiClient.delete(url);
      await refreshAccounts();
    } catch (err) {
      await alert("Disconnect failed", err.response?.data?.error || err.message || "Please try again.", {
        intent: "danger",
      });
    } finally {
      setBusy(null);
    }
  };

  const syncInstagramToAutoDM = async () => {
    if (!autoDMState?.importInstagram) return;
    setBusy("instagram-sync");
    try {
      await autoDMState.importInstagram();
    } catch (err) {
      await alert("Instagram sync failed", err.response?.data?.error || err.message || "Please check server setup.", {
        intent: "warning",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-[22px] border border-black/10 bg-[var(--canvas-lifted)] shadow-sm">
      <div className="flex flex-col gap-4 border-b border-black/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Connected Platforms</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
            One connection, all features
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--slate)]">
            Auto Posting, GAP AutoDM aur InstaPilot same official platform connections use karte hain.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            Official Meta APIs
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-bold text-[var(--ink)]">
            {connectedCount} connected
          </span>
        </div>
      </div>

      {showBillingSummary ? (
        <div className="grid gap-3 border-b border-black/10 p-5 md:grid-cols-3">
          <div className="rounded-2xl border border-black/10 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <CreditCard className="h-4 w-4 text-[var(--arc)]" />
              Current plan
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)]">{user?.plan || "Free"}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--slate)]">Billing state controls platform limits and feature access.</p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Platform access
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)]">{connectedCount}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--slate)]">Connected platforms visible to posting, AutoDM and bots.</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-950">
              <Info className="h-4 w-4 text-blue-700" />
              Sync rule
            </div>
            <p className="mt-2 text-sm leading-6 text-blue-950">
              Instagram ko ek baar connect karo. InstaPilot aur AutoDM automatically same account pick karenge.
            </p>
          </div>
        </div>
      ) : null}

      <div className={`grid gap-3 p-5 ${compact ? "md:grid-cols-2" : "lg:grid-cols-2"}`}>
        {connectedPlatforms.length === 0 ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-center">
            <span className="text-4xl mb-3">👋</span>
            <h3 className="text-base font-semibold text-gray-900">No channels connected yet</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm">Use the quick connect bar below to link your first social channel.</p>
          </div>
        ) : (
          connectedPlatforms.map((platform) => {
            const account = connectedAccounts?.[platform.id] || {};
            const platformAccounts = platform.id === "instagram"
              ? connectedAccounts?.instagramAccounts || []
              : connectedAccounts?.[`${platform.id}Accounts`] || [];
            const status = getStatus(platform, platformAccounts.length ? { ...platformAccounts[0], connected: true } : account, autoDMState);
            const isConnected = Boolean(account.connected || platformAccounts.length);
            const isInstagram = platform.id === "instagram";
            const canSyncAutoDM =
              isInstagram &&
              isConnected &&
              autoDMState?.hasSocialInstagramConnection &&
              autoDMState?.autoDMStorageReady !== false &&
              typeof autoDMState?.importInstagram === "function";

            return (
              <article key={platform.id} className="rounded-2xl border border-black/10 bg-white p-4">
                <div className="flex gap-3">
                  <PlatformIcon platform={platform} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-semibold tracking-[-0.02em] text-[var(--ink)]">{platform.name}</h3>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(status.tone)}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--slate)]">{status.help}</p>
                    <p className="mt-3 rounded-2xl border border-black/10 bg-[#f7f5f2] p-3 text-xs leading-5 text-[var(--slate)]">
                      {platform.prerequisite}
                    </p>
                    {isInstagram && autoDMState?.autoDMStorageError ? (
                      <div className="mt-3 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{autoDMState.autoDMStorageError}</span>
                      </div>
                    ) : null}
                    {platformAccounts.length > 0 && (
                      <div className="mt-4 flex flex-col gap-2 border-t border-black/5 pt-4">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Connected Accounts</span>
                        {platformAccounts.map((acc) => (
                          <div key={acc.id} className="flex items-center justify-between rounded-lg border border-black/5 bg-white p-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {acc.profilePicture ? (
                                <img src={acc.profilePicture} alt="" className="h-6 w-6 shrink-0 rounded-full bg-gray-100 object-cover" />
                              ) : (
                                <div className="h-6 w-6 shrink-0 rounded-full bg-gray-100" />
                              )}
                              <span className="truncate text-sm font-medium text-[var(--ink)]">{acc.username || acc.account_id || acc.accountId}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => disconnectPlatform(platform, acc.id)}
                              disabled={busy === acc.id}
                              className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                            >
                              {busy === acc.id ? "Disconnecting..." : "Disconnect"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {isConnected ? (
                    <>
                        <button
                          type="button"
                          onClick={() => disconnectPlatform(platform)}
                          disabled={busy === platform.id}
                          className="inline-flex h-10 items-center gap-2 rounded-full border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          <Unlink className="h-4 w-4" />
                          {busy === platform.id ? "Disconnecting..." : (platformAccounts.length > 1 ? "Disconnect All" : "Disconnect")}
                        </button>
                      {canSyncAutoDM ? (
                        <button
                          type="button"
                          onClick={syncInstagramToAutoDM}
                          disabled={busy === "instagram-sync"}
                          className="inline-flex h-10 items-center gap-2 rounded-full border border-black/10 bg-[#f7f5f2] px-4 text-sm font-semibold text-[var(--ink)] transition hover:bg-white disabled:opacity-50"
                        >
                          <RefreshCw className={`h-4 w-4 ${busy === "instagram-sync" ? "animate-spin" : ""}`} />
                          {busy === "instagram-sync" ? "Syncing..." : "Sync AutoDM"}
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => connectPlatform(platform)}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-sm font-semibold text-[var(--ink)] shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {platform.connectLabel}
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {unconnectedPlatforms.length > 0 && (
        <div className="p-5 border-t border-black/5 bg-[#fcfbf9]/60 rounded-b-[22px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.2em] mb-1">Connect More Platforms</h4>
            <p className="text-xs text-[#666666]">Click an icon to quickly authorize and link a new channel.</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            {unconnectedPlatforms.map((platform) => (
              <button
                key={platform.id}
                type="button"
                onClick={() => connectPlatform(platform)}
                className="w-11 h-11 rounded-full border border-black/10 hover:border-black/25 bg-white hover:bg-gray-50 flex items-center justify-center shadow-sm relative group transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                title={platform.connectLabel}
              >
                <img src={platform.icon} alt={platform.name} className="w-5.5 h-5.5 object-contain" />
                <span className="absolute -top-8 scale-0 group-hover:scale-100 transition-all duration-150 bg-[#1a1a1a] text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-25 pointer-events-none uppercase tracking-wider">
                  {platform.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {showFacebookModal && (
        <FacebookSetupModal
          isOpen={showFacebookModal}
          onClose={() => setShowFacebookModal(false)}
          onProceed={() => {
            setShowFacebookModal(false);
            const token = localStorage.getItem("quickpost_token");
            const apiUrl = import.meta.env.VITE_API_URL || "";
            if (token) window.location.href = `${apiUrl}/api/auth/facebook?token=${token}`;
          }}
        />
      )}
    </section>
  );
}
