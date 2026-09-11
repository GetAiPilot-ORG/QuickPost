import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  CalendarClock,
  Gauge,
  LayoutGrid,
  Workflow,
  Users,
  Instagram,
  Settings,
  UserRound,
  ChevronDown,
  X,
  Plus,
  Sparkles,
  Lock,
  MessagesSquare,
  Video,
  LogOut,
  HelpCircle,
  CreditCard,
  BarChart3,
  Flame,
} from "lucide-react";
import { useDialog } from "../context/DialogContext";
import logo from "/logo.png";
import InstagramBusinessSetupModal from "./InstagramBusinessSetupModal";
import BlueskyConnectModal from "./BlueskyConnectModal";
import PinterestConnectModal from "./PinterestConnectModal";
import LinkedInConnectModal from "./LinkedInConnectModal";
import MastodonConnectModal from "./MastodonConnectModal";
import FacebookSetupModal from "./FacebookSetupModal";
import apiClient from "../utils/apiClient";
import { startAutoDMInstagramOAuth } from "../services/autodm/supabaseClient";
import { countConnectedTargets } from "../utils/connectedAccounts";

// Helper to determine if the user is on the free plan
function isFree(plan) {
  if (!plan) return true;
  return plan.toLowerCase() === 'free';
}

const platformDetails = {
  facebook: {
    name: "Facebook",
    icon: (
      <img
        src="/icons/facebook-round-color-icon.svg"
        style={{ width: 20, height: 20 }}
        alt=""
      />
    ),
  },
  instagram: {
    name: "Instagram",
    icon: (
      <img
        src="/icons/ig-instagram-icon.svg"
        style={{ width: 20, height: 20 }}
        alt=""
      />
    ),
  },
  x: {
    name: "X",
    icon: (
      <img
        src="/icons/x-social-media-round-icon.svg"
        style={{ width: 20, height: 20 }}
        alt=""
      />
    ),
  },
  linkedin: {
    name: "LinkedIn",
    icon: (
      <img
        src="/icons/linkedin-icon.svg"
        style={{ width: 20, height: 20 }}
        alt=""
      />
    ),
  },
  youtube: {
    name: "YouTube",
    icon: (
      <img
        src="/icons/youtube-color-icon.svg"
        style={{ width: 20, height: 20 }}
        alt=""
      />
    ),
  },
  pinterest: {
    name: "Pinterest",
    icon: (
      <img
        src="/icons/pinterest-round-color-icon.svg"
        style={{ width: 20, height: 20 }}
        alt=""
      />
    ),
  },
  threads: {
    name: "Threads",
    icon: (
      <img
        src="/icons/threads-icon.svg"
        style={{ width: 20, height: 20 }}
        alt=""
      />
    ),
  },
  mastodon: {
    name: "Mastodon",
    icon: (
      <img
        src="/icons/mastodon-round-icon.svg"
        style={{ width: 20, height: 20 }}
        alt=""
      />
    ),
  },
  bluesky: {
    name: "Bluesky",
    icon: (
      <img
        src="/icons/bluesky-circle-color-icon.svg"
        style={{ width: 20, height: 20 }}
        alt=""
      />
    ),
  },
  googleBusiness: {
    name: "Google Business",
    icon: (
      <img
        src="/icons/google-icon.svg"
        style={{ width: 20, height: 20 }}
        alt=""
      />
    ),
  },
  reddit: {
    name: "Reddit",
    icon: (
      <img
        src="/icons/reddit-icon.svg"
        style={{ width: 20, height: 20 }}
        alt=""
      />
    ),
  },
};

const getPlatformId = (target) => {
  if (target.providerId) return target.providerId;
  if (target.id && target.id.startsWith("instagram")) return "instagram";
  return target.id;
};

/* ── tiny SVG orbital arc decoration ── */
const OrbitalArc = () => (
  <svg
    className="orbital-arc"
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      overflow: "visible",
    }}
    aria-hidden="true"
  >
    <path d="M 20 60 Q 120 20 220 80" />
  </svg>
);

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedDashboardPlatform =
    location.pathname.startsWith("/dashboard")
      ? new URLSearchParams(location.search).get("platform")
      : null;

  const { user, connectedAccounts, refreshAccounts, logout, loading, profileLoading } = useAuth();
  const { confirm, alert } = useDialog();
  const [expandedPlatforms, setExpandedPlatforms] = useState({});
  const [showChannelsPopover, setShowChannelsPopover] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState({ top: 0, left: 0 });
  const plusButtonRef = React.useRef(null);
  const [showBusinessSetupModal, setShowBusinessSetupModal] = useState(false);
  const [showBlueskyModal, setShowBlueskyModal] = useState(false);
  const [showPinterestModal, setShowPinterestModal] = useState(false);
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);
  const [showMastodonModal, setShowMastodonModal] = useState(false);
  const [showFacebookModal, setShowFacebookModal] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState(null);
  const [disconnectingPlatform, setDisconnectingPlatform] = useState(null);
  const connectedOpen = true;
  const [autoDMOpen, setAutoDMOpen] = useState(
    location.pathname.startsWith("/dashboard/auto-dm"),
  );
  const [imgError, setImgError] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const handleLogout = async () => {
    const confirmed = await confirm("Logout", "Are you sure you want to log out?", {
      intent: "logout",
      confirmText: "Logout",
      cancelText: "Stay logged in",
    });
    if (!confirmed) return;
    logout();
    navigate("/login");
  };

  const handleConnectInstagram = () => setShowBusinessSetupModal(true);
  const handleOpenPopover = () => {
    if (plusButtonRef.current) {
      const rect = plusButtonRef.current.getBoundingClientRect();
      setPopoverCoords({
        top: rect.top - 10,
        left: rect.left + rect.width + 12,
      });
    }
    setShowChannelsPopover(true);
  };
  const handleProceedToConnect = async () => {
    setShowBusinessSetupModal(false);
    setConnectingPlatform("instagram");
    try {
      const redirectTo = await startAutoDMInstagramOAuth(window.location.origin);
      window.location.assign(redirectTo);
    } catch (error) {
      setConnectingPlatform(null);
      alert("Error", error?.message || "Failed to start Instagram login.", {
        intent: "danger",
      });
    }
  };
  const handleConnectFacebook = () => {
    const token = localStorage.getItem("quickpost_token");
    if (!token) {
      alert("Error", "Authentication token missing. Please log in again.", {
        intent: "danger",
      });
      return;
    }
    setShowFacebookModal(true);
  };
  const canConnectNewPlatform = async (platformId) => {
    const limit = user?.entitlements?.limits?.social_accounts ?? Infinity;
    const platformAccounts = connectedAccounts?.[`${platformId}Accounts`] || [];
    const alreadyConnected = Boolean(connectedAccounts?.[platformId]?.connected || platformAccounts.length);
    if (alreadyConnected || countConnectedTargets(connectedAccounts) < limit) return true;

    await alert(
      "Upgrade Required",
      `You have reached your limit of ${limit} social account${limit === 1 ? "" : "s"} on the ${user?.entitlements?.plan?.name || "Free"} plan. Please upgrade to connect more channels.`,
      { intent: "warning" },
    );
    return false;
  };
  const handleConnectThreads = () => {
    const token = localStorage.getItem("quickpost_token");
    if (!token) {
      alert("Error", "Authentication token missing. Please log in again.", {
        intent: "danger",
      });
      return;
    }
    canConnectNewPlatform("threads").then((allowed) => {
      if (!allowed) return;
      const apiUrl = import.meta.env.VITE_API_URL || "";
      window.location.href = `${apiUrl}/api/auth/threads?token=${token}`;
    });
  };
  const handleConnectX = () => {
    const token = localStorage.getItem("quickpost_token");
    if (!token) {
      alert("Error", "Authentication token missing. Please log in again.", {
        intent: "danger",
      });
      return;
    }
    canConnectNewPlatform("x").then((allowed) => {
      if (!allowed) return;
      const apiUrl = import.meta.env.VITE_API_URL || "";
      setConnectingPlatform("x");
      window.location.href = `${apiUrl}/api/auth/x?token=${token}`;
    });
  };
  const handleConnectReddit = () => {
    const token = localStorage.getItem("quickpost_token");
    if (!token) {
      alert("Error", "Authentication token missing. Please log in again.", {
        intent: "danger",
      });
      return;
    }
    const apiUrl = import.meta.env.VITE_API_URL || "";
    setConnectingPlatform("reddit");
    window.location.href = `${apiUrl}/api/auth/reddit?token=${token}`;
  };
  const handleConnectYouTube = () => {
    const token = localStorage.getItem("quickpost_token");
    if (!token) {
      alert("Error", "Authentication token missing. Please log in again.", {
        intent: "danger",
      });
      return;
    }
    const apiUrl = import.meta.env.VITE_API_URL || "";
    window.location.href = `${apiUrl}/api/auth/youtube?token=${token}`;
  };
  const handleConnectGoogleBusiness = () => {
    const token = localStorage.getItem("quickpost_token");
    if (!token) {
      alert("Error", "Authentication token missing. Please log in again.", {
        intent: "danger",
      });
      return;
    }
    const apiUrl = import.meta.env.VITE_API_URL || "";
    window.location.href = `${apiUrl}/api/auth/googleBusiness?token=${token}`;
  };

  const handleConnectPinterest = () => {
    const token = localStorage.getItem("quickpost_token");
    if (!token) {
      alert("Error", "Authentication token missing. Please log in again.", {
        intent: "danger",
      });
      return;
    }
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    window.location.href = `${apiUrl}/api/auth/pinterest?token=${token}`;
  };
  const handleDisconnect = async (platform) => {
    const message = platform === "instagram"
      ? `Are you sure you want to disconnect your ${platform} account? This will stop all scheduled posts and pause any active automations. Your automations will be restored when you reconnect.`
      : `Are you sure you want to disconnect your ${platform} account? This will stop all scheduled posts to this channel.`;
    const confirmed = await confirm(
      "Disconnect Account",
      message,
      {
        intent: "danger",
        confirmText: "Disconnect",
        cancelText: "Keep Connected",
      },
    );
    if (!confirmed) return;
    setDisconnectingPlatform(platform);
    try {
      const response = await apiClient.delete(
        `/api/auth/disconnect/${platform}`,
      );
      const data = response.data;
      if (data.success) {
        await refreshAccounts();
        alert("Success", `Successfully disconnected from ${platform}`, {
          intent: "primary",
        });
      } else {
        alert("Error", `Failed to disconnect: ${data.error}`, {
          intent: "danger",
        });
      }
    } catch (error) {
      alert("Error", "Failed to disconnect account. Please try again.", {
        intent: "danger",
      });
    } finally {
      setDisconnectingPlatform(null);
    }
  };

  const platforms = [
    {
      id: "facebook",
      name: "Facebook",
      connected: connectedAccounts.facebook?.connected,
      icon: (
        <img
          src="/icons/facebook-round-color-icon.svg"
          style={{ width: 20, height: 20 }}
          alt=""
        />
      ),
      onConnect: handleConnectFacebook,
      allowMultiple: true,
    },
    ...(connectedAccounts.instagramAccounts?.length > 0
      ? connectedAccounts.instagramAccounts.map(acc => ({
        id: `instagram:${acc.id}`,
        name: acc.username || "Instagram",
        connected: true,
        icon: acc.profilePicture ? (
          <img
            src={acc.profilePicture}
            style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }}
            alt=""
          />
        ) : (
          <img
            src="/icons/ig-instagram-icon.svg"
            style={{ width: 20, height: 20 }}
            alt=""
          />
        ),
        onConnect: handleConnectInstagram,
      }))
      : [
        {
          id: "instagram",
          name: "Instagram",
          connected: false,
          icon: (
            <img
              src="/icons/ig-instagram-icon.svg"
              style={{ width: 20, height: 20 }}
              alt=""
            />
          ),
          onConnect: handleConnectInstagram,
        }
      ]),
    ...(connectedAccounts.instagramAccounts?.length > 0
      ? [
        {
          id: "instagram_connect",
          name: "Instagram",
          connected: false,
          icon: (
            <img
              src="/icons/ig-instagram-icon.svg"
              style={{ width: 20, height: 20 }}
              alt=""
            />
          ),
          onConnect: handleConnectInstagram,
        }
      ]
      : []),
    {
      id: "x",
      name: "X",
      connected: connectedAccounts.x?.connected,
      icon: (
        <img
          src="/icons/x-social-media-round-icon.svg"
          style={{ width: 20, height: 20 }}
          alt=""
        />
      ),
      onConnect: () =>
        alert("Coming Soon", "X integration coming soon!", {
          intent: "warning",
        }),
      disabled: true,
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      connected: connectedAccounts.linkedin?.connected,
      icon: (
        <img
          src="/icons/linkedin-icon.svg"
          style={{ width: 20, height: 20 }}
          alt=""
        />
      ),
      onConnect: () => setShowLinkedInModal(true),
    },
    {
      id: "youtube",
      name: "YouTube",
      connected: connectedAccounts.youtube?.connected,
      icon: (
        <img
          src="/icons/youtube-color-icon.svg"
          style={{ width: 20, height: 20 }}
          alt=""
        />
      ),
      onConnect: handleConnectYouTube,
      allowMultiple: true,
    },
    {
      id: "pinterest",
      name: "Pinterest",
      connected: connectedAccounts.pinterest?.connected,
      icon: (
        <img
          src="/icons/pinterest-round-color-icon.svg"
          style={{ width: 20, height: 20 }}
          alt=""
        />
      ),
      onConnect: handleConnectPinterest,
    },
    {
      id: "threads",
      name: "Threads",
      connected: connectedAccounts.threads?.connected,
      icon: (
        <img
          src="/icons/threads-icon.svg"
          style={{ width: 20, height: 20 }}
          alt=""
        />
      ),
      onConnect: handleConnectThreads,
      allowMultiple: true,
    },
    {
      id: "mastodon",
      name: "Mastodon",
      connected: connectedAccounts.mastodon?.connected,
      icon: (
        <img
          src="/icons/mastodon-round-icon.svg"
          style={{ width: 20, height: 20 }}
          alt=""
        />
      ),
      onConnect: () => setShowMastodonModal(true),
    },
    {
      id: "bluesky",
      name: "Bluesky",
      connected: connectedAccounts.bluesky?.connected,
      icon: (
        <img
          src="/icons/bluesky-circle-color-icon.svg"
          style={{ width: 20, height: 20 }}
          alt=""
        />
      ),
      onConnect: () => setShowBlueskyModal(true),
      allowMultiple: true,
    },
    {
      id: "googleBusiness",
      name: "Google Business",
      connected: connectedAccounts.googleBusiness?.connected,
      icon: (
        <img
          src="/icons/google-icon.svg"
          style={{ width: 20, height: 20 }}
          alt=""
        />
      ),
      onConnect: () =>
        alert("Coming Soon", "Google Business integration coming soon!", {
          intent: "warning",
        }),
      disabled: true,
    },
    {
      id: "reddit",
      name: "Reddit",
      connected: connectedAccounts.reddit?.connected,
      icon: (
        <img
          src="/icons/reddit-icon.svg"
          style={{ width: 20, height: 20 }}
          alt=""
        />
      ),
      onConnect: () =>
        alert("Coming Soon", "Reddit integration coming soon!", {
          intent: "warning",
        }),
      disabled: true,
    },
  ];

  const connectedTargets = platforms.flatMap((platform) => {
    if (platform.id === "instagram_connect" || !platform.connected) return [];
    const accounts = connectedAccounts[`${platform.id}Accounts`] || [];
    if (!accounts.length) return [platform];

    return accounts.map((account) => ({
      ...platform,
      id: `${platform.id}:${account.id}`,
      providerId: platform.id,
      name: account.username || account.account_id || platform.name,
      icon: account.profilePicture ? (
        <img
          src={account.profilePicture}
          style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }}
          alt=""
        />
      ) : platform.icon,
    }));
  });

  const groupedConnected = React.useMemo(() => {
    const groups = {};
    connectedTargets.forEach((target) => {
      const pid = getPlatformId(target);
      if (!groups[pid]) {
        groups[pid] = [];
      }
      groups[pid].push(target);
    });
    return groups;
  }, [connectedTargets]);


  const isActive = (path) => {
    if (path === "/dashboard/auto-dm") {
      return location.pathname.startsWith("/dashboard/auto-dm");
    }
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  const autoDMSubnav = [
    { to: "/dashboard/auto-dm/automations", label: "Automations", icon: <Workflow size={14} /> },
    { to: "/dashboard/auto-dm/contacts", label: "Contacts", icon: <Users size={14} /> },
    { to: "/dashboard/auto-dm/instagram-profile", label: "Profile", icon: <Instagram size={14} /> },
  ];

  return (
    <aside
      className="qp-sidebar flex flex-col custom-scrollbar"
      style={{
        width: 240,
        height: "100%",
        background: "var(--canvas)",
        borderRight: "1px solid #d3cec6",
      }}
    >
      {/* ── Brand ── */}
      <div
        style={{
          height: 64,
          boxSizing: "border-box",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid #d3cec6",
        }}
      >
        <Link
          to="/"
          className="flex items-center gap-3"
          style={{ textDecoration: "none" }}
        >
          <img
            src={logo}
            alt="GAP Social-pilot"
            style={{ height: 36, width: 36, objectFit: "contain" }}
          />
          <span
            style={{
              fontSize: 20,
              fontWeight: 400,
              color: "var(--ink)",
              fontFamily: "var(--font-logo)",
              letterSpacing: "normal",
              lineHeight: 0.9,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                fontFamily: "var(--font)",
                color: "var(--arc)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              GAP
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                fontFamily: "var(--font)",
                color: "var(--ink)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              Social‑pilot
            </span>
          </span>
        </Link>
      </div>

      {/* ── Scrollable body ── */}
      <div
        className="flex-1 overflow-y-auto custom-scrollbar"
        style={{ padding: "8px 12px 0" }}
      >
        {/* ── Primary nav ── */}
        <div style={{ marginBottom: 12 }}>
          {[
            {
              to: "/dashboard",
              label: "Dashboard",
              icon: <Gauge size={16} />,
            },
            {
              to: "/dashboard/analytics",
              label: "All Channels",
              icon: <BarChart3 size={16} />,
            },
            {
              to: "/dashboard/queue",
              label: "Scheduled Queue",
              icon: <CalendarClock size={16} />,
            },
            {
              to: "/dashboard/instapilot",
              label: "GAP InstaPilot",
              icon: <Instagram size={16} />,
            },
            {
              to: "/dashboard/youtube",
              label: "YouTube Studio",
              icon: <Video size={16} />,
            },
            {
              to: "/dashboard/trends",
              label: "Trend Feed",
              icon: <Flame size={16} />,
            },
            {
              to: "/dashboard/inbox",
              label: "Social Inbox",
              icon: <MessagesSquare size={16} />,
            },
            {
              to: "/dashboard/auto-dm",
              label: "GAP AutoDM",
              icon: <Workflow size={16} />,
            },
          ].map(({ to, label, icon }) => {
            const active = isActive(to);
            const isLocked = false;
            const isAutoDM = to === "/dashboard/auto-dm";

            const content = (
              <>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "var(--r-sm)",
                    background: active
                      ? "rgba(255,255,255,0.15)"
                      : "rgba(20,20,19,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {icon}
                </span>
                <span style={{ flex: 1 }}>{label}</span>
                {isLocked && <Lock size={14} style={{ opacity: 0.5 }} />}
              </>
            );

            const style = {
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "6px 10px",
              borderRadius: "var(--r-btn)",
              marginBottom: 1,
              background: active ? "var(--ink)" : "transparent",
              color: active
                ? "var(--canvas)"
                : isLocked
                  ? "var(--dust)"
                  : "var(--slate)",
              fontWeight: 500,
              fontSize: 14,
              textDecoration: "none",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              opacity: isLocked ? 0.6 : 1,
              cursor: isLocked ? "not-allowed" : "pointer",
            };

            if (isLocked) {
              return (
                <div
                  className={`qp-sidebar-nav-item${active ? " is-active" : ""}`}
                  key={to}
                  style={style}
                  onClick={() =>
                    alert("Please upgrade your plan to access this feature.")
                  }
                >
                  {content}
                </div>
              );
            }

            return (
              <React.Fragment key={to}>
                {isAutoDM ? (
                  <div
                    className={`qp-sidebar-nav-item${active ? " is-active" : ""}`}
                    style={{
                      ...style,
                      padding: 0,
                      overflow: "hidden",
                    }}
                  >
                    <Link
                      to={to}
                      onClick={() => {
                        setAutoDMOpen(true);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        minWidth: 0,
                        flex: 1,
                        padding: "6px 0 6px 10px",
                        color: "inherit",
                        textDecoration: "none",
                      }}
                    >
                      {content}
                    </Link>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setAutoDMOpen((open) => {
                          const nextOpen = !open;
                          return nextOpen;
                        });
                      }}
                      aria-label={autoDMOpen ? "Collapse GAP AutoDM menu" : "Expand GAP AutoDM menu"}
                      aria-expanded={autoDMOpen}
                      className="sidebar-parent-toggle"
                    >
                      <ChevronDown
                        size={14}
                        style={{
                          transform: autoDMOpen ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                      />
                    </button>
                  </div>
                ) : (
                  <Link
                    to={to}
                    className={`qp-sidebar-nav-item${active ? " is-active" : ""}`}
                    style={style}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "rgba(20,20,19,0.05)";
                        e.currentTarget.style.color = "var(--ink)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--slate)";
                      }
                    }}
                  >
                    {content}
                  </Link>
                )}

                {isAutoDM && autoDMOpen && (
                  <div className="sidebar-subnav">
                    {autoDMSubnav.map((item) => {
                      const itemActive = item.exact
                        ? location.pathname === item.to
                        : location.pathname.startsWith(item.to);

                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className={`sidebar-subnav-link${itemActive ? " active" : ""}`}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── Connected platforms ── */}
        <div style={{ marginTop: 8 }}>
          {(() => {
            const connectedPlatforms = connectedTargets;
            const visibleIcons = connectedPlatforms.slice(0, 3);
            const extraCount = Math.max(0, connectedPlatforms.length - 3);

            return (
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 12px",
                  borderRadius: "var(--r-btn)",
                  background: "var(--side-surface)",
                  border: "1px solid var(--side-hairline)",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--side-ink)", marginLeft: 4 }}
                >
                  Connected
                </span>
                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <button
                    ref={plusButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenPopover();
                    }}
                    title="Connect channels"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "rgba(20, 20, 19, 0.05)",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "background 0.2s",
                      marginRight: 2,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(20, 20, 19, 0.12)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(20, 20, 19, 0.05)";
                    }}
                  >
                    <Plus size={12} style={{ color: "var(--side-ink)" }} />
                  </button>
                  {connectedPlatforms.length > 0 && (
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "var(--side-fin)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {connectedPlatforms.length}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <AnimatePresence>
            {connectedOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  overflow: "hidden",
                }}
              >
                {Object.entries(groupedConnected).map(([platformId, targets]) => {
                  const details = platformDetails[platformId] || {
                    name: platformId.charAt(0).toUpperCase() + platformId.slice(1),
                    icon: <Share2 size={16} />,
                  };
                  const isExpanded = expandedPlatforms[platformId] !== false; // default to expanded/true

                  // Check if any target in this platform is selected
                  const isAnySelected = targets.some((target) => {
                    const dashboardPlatform = target.id;
                    return (
                      (selectedDashboardPlatform === platformId ||
                        selectedDashboardPlatform === dashboardPlatform) &&
                      location.pathname.startsWith("/dashboard/analytics")
                    );
                  });

                  return (
                    <div key={platformId} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {/* Parent platform item */}
                      <div
                        onClick={() => {
                          setExpandedPlatforms((prev) => ({
                            ...prev,
                            [platformId]: prev[platformId] === false ? true : false,
                          }));
                          navigate(`/dashboard/analytics?platform=${platformId}`);
                        }}
                        className={`qp-sidebar-connected-parent-item ${isAnySelected ? "qp-sidebar-connected-parent-item-active" : ""}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "6px 10px",
                          borderRadius: "var(--r-btn)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <div
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: "6px",
                              background: "var(--side-surface)",
                              border: "1px solid var(--side-hairline)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {details.icon}
                          </div>
                        </div>

                        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "var(--side-ink)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {details.name}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "var(--side-muted)",
                              background: "var(--side-surface-2)",
                              padding: "1px 6px",
                              borderRadius: "10px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {targets.length}
                          </span>
                        </div>

                        <ChevronDown
                          size={14}
                          style={{
                            color: "var(--side-muted)",
                            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s",
                          }}
                        />
                      </div>

                      {/* Children list */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="qp-sidebar-connected-children"
                          >
                            {targets.map((target) => {
                              const dashboardPlatform = target.id;
                              const isSelected =
                                selectedDashboardPlatform === dashboardPlatform &&
                                location.pathname.startsWith("/dashboard/analytics");
                              return (
                                <div
                                  key={target.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/dashboard/analytics?platform=${dashboardPlatform}`);
                                  }}
                                  className="qp-sidebar-connected-item group"
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "6px 8px",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    transition: "background 0.15s",
                                    background: isSelected
                                      ? "var(--side-surface-2)"
                                      : "transparent",
                                  }}
                                >
                                  <div style={{ position: "relative", flexShrink: 0 }}>
                                    <div
                                      style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: "50%",
                                        background: "var(--side-surface)",
                                        border: "1px solid var(--side-hairline)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        overflow: "hidden",
                                      }}
                                    >
                                      {target.icon}
                                    </div>
                                    <span
                                      style={{
                                        position: "absolute",
                                        bottom: -1,
                                        right: -1,
                                        width: 6,
                                        height: 6,
                                        background: "#22c55e",
                                        borderRadius: "50%",
                                        border: "1px solid var(--side-canvas)",
                                      }}
                                    />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 500,
                                        color: "var(--side-ink)",
                                        lineHeight: 1.2,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {connectedAccounts[target.id]?.username ||
                                        target.name}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 9,
                                        color: "var(--side-muted)",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      Active
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Footer ── */}
      <div
        className="qp-sidebar-footer"
        style={{
          padding: "10px",
          borderTop: "1px solid rgba(20,20,19,0.08)",
        }}
      >
        {loading || profileLoading ? (
          <div className="qp-sidebar-account-details-skeleton">
            <div className="qp-sidebar-skeleton-avatar qp-shimmer-loading" />
            <div className="qp-sidebar-skeleton-text-group">
              <div className="qp-sidebar-skeleton-line name qp-shimmer-loading" />
              <div className="qp-sidebar-skeleton-line sub qp-shimmer-loading" />
            </div>
            <div className="qp-sidebar-skeleton-pill qp-shimmer-loading" />
          </div>
        ) : user ? (
          <div className={`qp-sidebar-account-details ${accountMenuOpen ? "is-open" : ""}`}>
            <button
              type="button"
              className="qp-sidebar-account-summary"
              aria-expanded={accountMenuOpen}
              onClick={() => setAccountMenuOpen((open) => !open)}
            >
              <div
                className="qp-sidebar-account-avatar"
                style={{
                  background:
                    user.picture && !imgError ? "transparent" : "var(--ink)",
                  color: "var(--canvas)",
                }}
              >
                {user.picture && !imgError ? (
                  <img
                    src={user.picture}
                    alt=""
                    onError={() => setImgError(true)}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  (user.name || user.email || "U")[0].toUpperCase()
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="qp-sidebar-account-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.organization_name || user.name || "My Organization"}
                  </span>
                  {user.plan && (
                    <span className={`qp-sidebar-plan-pill ${isFree(user.plan) ? "is-free" : "is-pro"}`}>
                      {user.plan || "Free"}
                    </span>
                  )}
                </div>
                <div className="qp-sidebar-account-subtitle" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.plan || "Free"} plan - {countConnectedTargets(connectedAccounts)} channels
                </div>
              </div>
              <ChevronDown size={14} className="qp-sidebar-account-chevron" />
            </button>
            <div className="qp-sidebar-account-panel">
              <div className="qp-sidebar-account-menu">
                {[
                  { to: "/dashboard/profile", label: "Profile", icon: <UserRound size={15} /> },
                  { to: "/dashboard", label: "Channels", icon: <LayoutGrid size={15} /> },
                  { to: "/dashboard/billing", label: "Plans and Billing", icon: <CreditCard size={15} /> },
                ].map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="qp-sidebar-account-link"
                  >
                    {item.icon}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                  </Link>
                ))}
                <a
                  href="mailto:support@gapsocialpilot.com"
                  className="qp-sidebar-account-link"
                >
                  <HelpCircle size={15} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Help & Support</span>
                </a>
                {isFree(user?.plan) && (
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/billing")}
                    className="qp-sidebar-account-upgrade"
                  >
                    <Sparkles size={15} />
                    Upgrade plan
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="qp-sidebar-account-link qp-sidebar-account-logout"
                >
                  <LogOut size={15} />
                  Log out
                </button>
              </div>
            </div>
          </div>
        ) : null}

      </div>

      {/* ── Connection Modals ── */}
      {createPortal(
        <>
          <InstagramBusinessSetupModal
            isOpen={showBusinessSetupModal}
            onClose={() => setShowBusinessSetupModal(false)}
            onProceed={handleProceedToConnect}
          />
          <BlueskyConnectModal
            isOpen={showBlueskyModal}
            onClose={() => setShowBlueskyModal(false)}
            onSuccess={refreshAccounts}
          />
          <PinterestConnectModal
            isOpen={showPinterestModal}
            onClose={() => setShowPinterestModal(false)}
            onSuccess={refreshAccounts}
          />
          <LinkedInConnectModal
            isOpen={showLinkedInModal}
            onClose={() => setShowLinkedInModal(false)}
            onSuccess={refreshAccounts}
          />
          <MastodonConnectModal
            isOpen={showMastodonModal}
            onClose={() => setShowMastodonModal(false)}
            onSuccess={refreshAccounts}
          />
          <FacebookSetupModal
            isOpen={showFacebookModal}
            onClose={() => setShowFacebookModal(false)}
            onProceed={() => {
              setShowFacebookModal(false);
              const token = localStorage.getItem("quickpost_token");
              if (!token) return;
              const apiUrl = import.meta.env.VITE_API_URL || "";
              window.location.href = `${apiUrl}/api/auth/facebook?token=${token}`;
            }}
          />

          <AnimatePresence>
            {showChannelsPopover && (
              <>
                {/* Popover overlay background click handler */}
                <div
                  onClick={() => setShowChannelsPopover(false)}
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    width: "100vw",
                    height: "100vh",
                    zIndex: 9998,
                    background: "transparent",
                  }}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, x: -10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95, x: -10 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  style={{
                    position: "fixed",
                    top: popoverCoords.top,
                    left: popoverCoords.left,
                    zIndex: 9999,
                    width: 260,
                    background: "rgba(255, 255, 255, 0.85)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    border: "1px solid var(--side-hairline)",
                    borderRadius: "12px",
                    padding: "16px",
                    boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.08), 0 8px 12px -6px rgba(0, 0, 0, 0.04)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--side-ink)" }}>
                      Connect Channels
                    </div>
                    <div style={{ fontSize: 11, color: "var(--side-muted)", marginTop: 2 }}>
                      Select a platform to link your account.
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 8,
                    }}
                  >
                    {platforms
                      .filter((p) => !p.connected || p.allowMultiple)
                      .map((platform) => (
                        <button
                          className="qp-sidebar-channel-button"
                          key={platform.id}
                          onClick={(e) => {
                            setShowChannelsPopover(false);
                            const limit = user?.entitlements?.limits?.social_accounts || 1;
                            const connectedCount = countConnectedTargets(connectedAccounts);
                            if (connectedCount >= limit) {
                              e.preventDefault();
                              alert("Upgrade Required", `You have reached your limit of ${limit} social account${limit === 1 ? '' : 's'} on the ${user?.entitlements?.plan?.name || 'Free'} plan. Please upgrade to connect more channels.`, { intent: "warning" });
                              return;
                            }
                            platform.onConnect();
                          }}
                          title={`Connect ${platform.name}`}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: "var(--r-btn)",
                            background: "var(--side-surface)",
                            border: "1px dashed rgba(20,20,19,0.2)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            opacity: platform.disabled ? 0.4 : 1,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "var(--side-ink)";
                            e.currentTarget.style.background = "var(--side-surface-2)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "rgba(20,20,19,0.2)";
                            e.currentTarget.style.background = "var(--side-surface)";
                          }}
                        >
                          <div
                            style={{
                              transition: "all 0.2s",
                              transform: "scale(1)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "scale(1.1)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                          >
                            {platform.icon}
                          </div>
                        </button>
                      ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>,
        document.body,
      )}
    </aside>
  );
}

export default Sidebar;
