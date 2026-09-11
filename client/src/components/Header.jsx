import React, { useState } from "react";
import { Menu, Unplug, LogOut, X, ChevronDown, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useDialog } from "../context/DialogContext";
import apiClient from "../utils/apiClient";

const PLATFORM_ICONS = {
  instagram: "/icons/ig-instagram-icon.svg",
  facebook: "/icons/facebook-round-color-icon.svg",
  youtube: "/icons/youtube-color-icon.svg",
  linkedin: "/icons/linkedin-icon.svg",
  threads: "/icons/threads-icon.svg",
  mastodon: "/icons/mastodon-round-icon.svg",
  bluesky: "/icons/bluesky-circle-color-icon.svg",
  reddit: "/icons/reddit-icon.svg",
  x: "/icons/x-social-media-round-icon.svg",
  pinterest: "/icons/pinterest-round-color-icon.svg",
  googleBusiness: "/icons/google-icon.svg",
};

function Header({ onMenuClick, sidebarOpen, isDesktop, topOffset = 0 }) {
  const { user, logout, connectedAccounts, refreshAccounts } = useAuth();
  const { confirm, alert } = useDialog();
  const navigate = useNavigate();
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [expandedPlatforms, setExpandedPlatforms] = useState({});
  const [disconnectingPlatform, setDisconnectingPlatform] = useState(null);

  const isEditorPage = location.pathname.includes('/dashboard/auto-dm/automations/') && location.pathname !== '/dashboard/auto-dm/automations';

  if (!user) return null;

  const handleLogout = async () => {
    const confirmed = await confirm(
      "Logout",
      "Are you sure you want to log out?",
      {
        intent: "logout",
        confirmText: "Logout",
        cancelText: "Stay logged in",
      },
    );
    if (confirmed) {
      logout();
      navigate("/login");
    }
  };

  const multiAccountProviders = [
    "facebook",
    "youtube",
    "linkedin",
    "threads",
    "mastodon",
    "bluesky",
    "reddit",
    "x",
    "pinterest",
    "googleBusiness",
  ];
  const connectedRows = [
    ...(connectedAccounts.instagramAccounts || []).map((account) => ({
      id: `instagram:${account.id}`,
      provider: "instagram",
      accountId: account.id,
      label: "Instagram",
      username: account.username,
      profilePicture: account.profilePicture,
    })),
    ...multiAccountProviders.flatMap((provider) =>
      (connectedAccounts?.[`${provider}Accounts`] || []).map((account) => ({
        id: `${provider}:${account.id}`,
        provider,
        accountId: account.id,
        label: provider,
        username: account.username,
        profilePicture: account.profilePicture,
      })),
    ),
    ...Object.entries(connectedAccounts || {})
      .filter(([id, data]) =>
        id !== "instagram" &&
        id !== "instagramAccounts" &&
        !id.endsWith("Accounts") &&
        !multiAccountProviders.includes(id) &&
        data?.connected
      )
      .map(([id, data]) => ({
        id,
        provider: id,
        accountId: null,
        label: id,
        username: data.username,
        profilePicture: data.profilePicture,
      })),
  ];

  const groupedAccounts = React.useMemo(() => {
    const groups = {};
    connectedRows.forEach((row) => {
      const provider = row.provider;
      if (!groups[provider]) {
        groups[provider] = [];
      }
      groups[provider].push(row);
    });
    return groups;
  }, [connectedRows]);

  const handleDisconnect = async (platform, accountId = null) => {
    const message = platform === "instagram"
      ? `Are you sure you want to disconnect your ${platform} account? This will pause any active automations. Your automations will be restored when you reconnect.`
      : `Are you sure you want to disconnect your ${platform} account?`;
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
    const busyKey = accountId || platform;
    setDisconnectingPlatform(busyKey);
    try {
      const response = await apiClient.delete(
        `/api/auth/disconnect/${platform}${accountId ? `?accountId=${accountId}` : ""}`,
      );
      if (response.data.success) {
        await refreshAccounts();
        alert("Success", `Disconnected from ${platform}`, { intent: "primary" });
      }
    } catch (error) {
      alert("Error", "Failed to disconnect account.", { intent: "danger" });
    } finally {
      setDisconnectingPlatform(null);
    }
  };

  const handleSettingsClick = () => {
    navigate("/dashboard/profile");
  };

  return (
    <header
      className="qp-header"
      style={{
        position: "fixed",
        top: topOffset,
        right: 0,
        left: isDesktop ? 240 : 0,
        zIndex: 39,
        height: 64,
        background: "rgba(245, 241, 236, 0.94)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #d3cec6",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isDesktop ? "0 24px" : "0 16px",
        fontFamily: "var(--font-body)",
        transition: "left 0.3s cubic-bezier(0.16, 1, 0.3, 1), top 0.2s ease",
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div id="header-left-portal"></div>
        {/* Mobile menu toggle */}
        {!isDesktop && (
          <button
            className="qp-header-icon-button"
            onClick={onMenuClick}
            aria-label="Toggle Menu"
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--r-btn)",
              border: "1px solid rgba(20,20,19,0.08)",
              background: "var(--white)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink)",
              transition: "all 0.2s",
            }}
          >
            <Menu size={18} />
          </button>
        )}
      </div>

      {/* Right: Actions + user pill */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div id="header-actions-portal" style={{ display: "flex", alignItems: "center", gap: 12 }}></div>
        {!isEditorPage && (
          <>
            <div style={{ display: "flex", gap: 6 }}>
          <button
            className="qp-header-icon-button"
            onClick={handleSettingsClick}
            title="Profile Settings"
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--slate)",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(20,20,19,0.05)"; e.currentTarget.style.color = "var(--ink)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--slate)"; }}
          >
            <UserRound size={18} />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 h-9 bg-red-50 hover:bg-red-500 text-red-600 hover:text-white font-semibold rounded-lg transition-all duration-200 border border-red-200 hover:border-red-500 shadow-sm"
            aria-label="Logout"
            title="Logout"
          >
            <LogOut size={16} strokeWidth={2.5} />
            <span className="text-[13px] tracking-wide">Logout</span>
          </button>
        </div>

          </>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && createPortal(
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" style={{ maxWidth: 460, borderRadius: "12px", padding: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(20,20,19,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>Connected Accounts</h2>
              <button onClick={() => setShowSettings(false)} style={{ border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", background: "rgba(20,20,19,0.04)" }}><X size={16} /></button>
            </div>
            
            <div 
              className="no-scrollbar"
              style={{ 
                padding: "20px 24px 24px",
                maxHeight: "440px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {connectedRows.length === 0 ? (
                <div style={{ padding: "32px 0", textAlign: "center", color: "var(--slate)", fontSize: 13 }}>
                  No channels connected yet. Click the plus button in the sidebar to link a social profile.
                </div>
              ) : (
                Object.entries(groupedAccounts).map(([provider, rows]) => {
                  const isExpanded = expandedPlatforms[provider] !== false; // Default to true
                  
                  return (
                    <div key={provider} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {/* Parent platform header row */}
                      <div
                        onClick={() => {
                          setExpandedPlatforms((prev) => ({
                            ...prev,
                            [provider]: prev[provider] === false ? true : false,
                          }));
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 14px",
                          borderRadius: "var(--r-btn)",
                          background: "var(--side-surface-2)",
                          border: "1px solid var(--side-hairline)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ width: 24, height: 24, borderRadius: "6px", background: "var(--white)", border: "1px solid var(--side-hairline)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {PLATFORM_ICONS[provider] ? (
                            <img
                              src={PLATFORM_ICONS[provider]}
                              alt=""
                              style={{ width: 16, height: 16, objectFit: "contain" }}
                            />
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 800 }}>{provider[0].toUpperCase()}</span>
                          )}
                        </div>
                        
                        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--side-ink)", textTransform: "capitalize" }}>
                            {provider}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              color: "var(--side-muted)",
                              background: "rgba(20, 20, 19, 0.06)",
                              padding: "1px 5px",
                              borderRadius: "8px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {rows.length}
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

                      {/* Nested expanded account rows */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            style={{
                              paddingLeft: 12,
                              marginLeft: 12,
                              borderLeft: "1.5px solid var(--side-hairline)",
                              marginTop: 2,
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              overflow: "hidden",
                            }}
                          >
                            {rows.map((row) => (
                              <div
                                key={row.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                  padding: "8px 12px",
                                  borderRadius: "8px",
                                  background: "var(--white)",
                                  border: "1px solid rgba(20,20,19,0.06)",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                                }}
                              >
                                {/* Photo Container with shadow, double borders, and green dot indicator */}
                                <div style={{ position: "relative", flexShrink: 0 }}>
                                  <div
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: "50%",
                                      background: "var(--white)",
                                      border: "1px solid var(--side-hairline)",
                                      boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {row.profilePicture ? (
                                      <img
                                        src={row.profilePicture}
                                        alt=""
                                        style={{ width: "100%", height: "100%", objectFit: "cover", border: "1.5px solid var(--white)", borderRadius: "50%" }}
                                      />
                                    ) : PLATFORM_ICONS[row.provider] ? (
                                      <img
                                        src={PLATFORM_ICONS[row.provider]}
                                        alt=""
                                        style={{ width: 16, height: 16, objectFit: "contain" }}
                                      />
                                    ) : (
                                      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--slate)", textTransform: "uppercase" }}>
                                        {row.label.slice(0, 1)}
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    style={{
                                      position: "absolute",
                                      bottom: -1,
                                      right: -1,
                                      width: 7,
                                      height: 7,
                                      background: "#22c55e",
                                      borderRadius: "50%",
                                      border: "1.5px solid var(--white)",
                                      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                    }}
                                  />
                                </div>
                                
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: "var(--side-ink)",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {row.username ? `@${row.username}` : "Connected Profile"}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 9,
                                      color: "var(--side-muted)",
                                      textTransform: "uppercase",
                                      fontWeight: 700,
                                      letterSpacing: "0.02em",
                                    }}
                                  >
                                    Active Channel
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleDisconnect(row.provider, row.accountId)}
                                  disabled={disconnectingPlatform === (row.accountId || row.provider)}
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "5px 12px",
                                    borderRadius: "6px",
                                    border: "1.5px solid #ef4444",
                                    color: "#ef4444",
                                    background: "none",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "#fef2f2";
                                    e.currentTarget.style.borderColor = "#dc2626";
                                    e.currentTarget.style.color = "#dc2626";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "none";
                                    e.currentTarget.style.borderColor = "#ef4444";
                                    e.currentTarget.style.color = "#ef4444";
                                  }}
                                >
                                  {disconnectingPlatform === (row.accountId || row.provider) ? "..." : "Disconnect"}
                                </button>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}

export default Header;
