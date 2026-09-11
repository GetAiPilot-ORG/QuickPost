import React, { useState, useEffect } from "react";
import { Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { CircleDollarSign, X } from "lucide-react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useAuth } from "../context/AuthContext";
import ProtectedRoute from "./ProtectedRoute";
import ConnectChannelsModal from "./ConnectChannelsModal";

function isFreePlan(user) {
  const planId = user?.entitlements?.plan?.id || user?.plan || "free";
  return String(planId).toLowerCase() === "free";
}

function SkeletonBlock({ style }) {
  return (
    <div
      className="skeleton-shimmer"
      style={{
        borderRadius: 8,
        background:
          "linear-gradient(90deg, rgba(17,17,17,0.035) 25%, rgba(17,17,17,0.07) 37%, rgba(17,17,17,0.035) 63%)",
        backgroundSize: "400% 100%",
        ...style,
      }}
    />
  );
}

function DashboardShellSkeleton({ isDesktop }) {
  const cardHeights = [280, 180, 340, 220, 260, 210];

  return (
    <div
      aria-busy="true"
      aria-label="Loading workspace"
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--canvas, #f5f1ec)",
        color: "var(--ink, #111)",
        overflow: "hidden",
      }}
    >
      {isDesktop && (
        <aside
          style={{
            width: 240,
            flexShrink: 0,
            borderRight: "1px solid var(--dust, #d3cec6)",
            background: "var(--canvas, #f5f1ec)",
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
            <SkeletonBlock style={{ width: 34, height: 34 }} />
            <div style={{ flex: 1 }}>
              <SkeletonBlock style={{ width: 92, height: 11, marginBottom: 7 }} />
              <SkeletonBlock style={{ width: 124, height: 15 }} />
            </div>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <SkeletonBlock style={{ width: 28, height: 28 }} />
                <SkeletonBlock style={{ width: item === 0 ? 138 : 118, height: 13 }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 26 }}>
            <SkeletonBlock style={{ height: 38, marginBottom: 14 }} />
            {[0, 1, 2, 3].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
                <SkeletonBlock style={{ width: 28, height: 28, borderRadius: "50%" }} />
                <SkeletonBlock style={{ width: item % 2 ? 92 : 118, height: 12 }} />
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", left: 12, bottom: 12, width: 216 }}>
            <SkeletonBlock style={{ height: 58 }} />
          </div>
        </aside>
      )}

      <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            height: 64,
            flexShrink: 0,
            borderBottom: "1px solid var(--dust, #d3cec6)",
            background: "var(--canvas, #f5f1ec)",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 10,
            padding: "0 16px",
          }}
        >
          <SkeletonBlock style={{ width: 36, height: 36 }} />
          <SkeletonBlock style={{ width: 92, height: 36 }} />
          <SkeletonBlock style={{ width: 136, height: 36 }} />
        </header>

        <main style={{ flex: 1, overflow: "hidden" }}>
          <div
            style={{
              padding: isDesktop ? "42px 32px 0" : "28px 18px 0",
              borderBottom: "1px solid var(--dust, #d3cec6)",
              background: "var(--canvas-lifted, #fff)",
            }}
          >
            <SkeletonBlock style={{ width: 84, height: 14, marginBottom: 14 }} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center" }}>
              <SkeletonBlock style={{ width: "min(360px, 62vw)", height: 56 }} />
              {isDesktop && <SkeletonBlock style={{ width: 128, height: 42 }} />}
            </div>
            <div style={{ display: "flex", gap: 28, marginTop: 38 }}>
              {[92, 70, 74, 74].map((width, index) => (
                <SkeletonBlock key={index} style={{ width, height: 14 }} />
              ))}
            </div>
          </div>

          <div style={{ padding: isDesktop ? "30px 32px" : 18 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isDesktop
                  ? "repeat(4, minmax(180px, 1fr))"
                  : "repeat(2, minmax(0, 1fr))",
                gap: 18,
              }}
            >
              {cardHeights.map((height, index) => (
                <div
                  key={index}
                  style={{
                    minHeight: height,
                    border: "1px solid var(--dust, #d3cec6)",
                    borderRadius: 8,
                    background: "var(--canvas-lifted, #fff)",
                    overflow: "hidden",
                  }}
                >
                  <SkeletonBlock style={{ height: Math.max(92, height - 70), borderRadius: 0 }} />
                  <div style={{ padding: 16 }}>
                    <SkeletonBlock style={{ width: "74%", height: 12, marginBottom: 10 }} />
                    <SkeletonBlock style={{ width: "52%", height: 12, marginBottom: 10 }} />
                    <SkeletonBlock style={{ width: "34%", height: 12 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </section>
    </div>
  );
}

const DashboardLayout = () => {
  const { isAuthenticated, loading, profileLoading, refreshAccounts, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [hideUpgradeBanner, setHideUpgradeBanner] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const showDashboardChrome = true;
  const showUpgradeBanner = showDashboardChrome && !hideUpgradeBanner && !profileLoading && isFreePlan(user);
  const bannerHeight = showUpgradeBanner ? 52 : 0;

  useEffect(() => {
    const onResize = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      if (desktop) setSidebarOpen(false); // auto-close mobile drawer on desktop
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const success = new URLSearchParams(location.search).get("success");
    if (success?.endsWith("_connected")) refreshAccounts();
  }, [isAuthenticated, location.search, refreshAccounts]);

  // ── Wait for Supabase to restore session before deciding ──
  if (loading) {
    return <DashboardShellSkeleton isDesktop={isDesktop} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!localStorage.getItem("qp_onboarding_done")) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--canvas)",
        overflow: "hidden",
      }}
    >
      {/* Skip to content — accessibility */}
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          top: -40,
          left: 16,
          zIndex: 9999,
          padding: '8px 16px',
          background: 'var(--ink)',
          color: 'var(--canvas)',
          borderRadius: '0 0 8px 8px',
          fontSize: 13,
          fontWeight: 700,
          textDecoration: 'none',
          transition: 'top 0.2s',
        }}
        onFocus={e => e.currentTarget.style.top = '0'}
        onBlur={e => e.currentTarget.style.top = '-40px'}
      >
        Skip to main content
      </a>
      {/* Mobile overlay */}
      {showDashboardChrome && !isDesktop && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20,20,19,0.4)",
            zIndex: 49,
            backdropFilter: "blur(4px)",
          }}
        />
      )}

      {/* Sidebar — hidden on Trends page, fixed on desktop, drawer on mobile */}
      {showDashboardChrome && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            bottom: 0,
            zIndex: 50,
            transform:
              isDesktop || sidebarOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            width: 240,
            boxShadow:
              !isDesktop && sidebarOpen ? "20px 0 60px rgba(0,0,0,0.1)" : "none",
          }}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <div
        style={{
          flex: 1,
          marginLeft: isDesktop && showDashboardChrome ? 240 : 0,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          transition: "margin-left 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          height: "100vh",
        }}
      >
        {/* Header — passes mobile toggle */}
        <Header
          onMenuClick={() => setSidebarOpen((o) => !o)}
          sidebarOpen={sidebarOpen}
          isDesktop={isDesktop}
          topOffset={bannerHeight}
        />

        {showUpgradeBanner && (
          <div
            role="region"
            aria-label="Upgrade plan"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              left: isDesktop && showDashboardChrome ? 240 : 0,
              minHeight: 52,
              zIndex: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              padding: isDesktop ? "8px 24px" : "8px 14px",
              background: "#ffffff",
              color: "var(--ink, #111)",
              borderBottom: "1px solid var(--dust, #d3cec6)",
              transition: "left 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 auto" }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "rgba(255, 86, 0, 0.12)",
                  color: "var(--arc, #ff5600)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <CircleDollarSign size={16} strokeWidth={2.5} />
              </span>
              <strong
                style={{
                  fontSize: 14,
                  fontWeight: 650,
                  lineHeight: 1.4,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: "var(--ink, #111)",
                }}
              >
                Free plan limits are active. <span style={{ color: "rgba(17, 17, 17, 0.6)", fontWeight: 500, display: isDesktop ? "inline" : "none" }}>Upgrade when you need more channels and automations.</span>
              </strong>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: isDesktop ? 16 : 10, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => navigate("/pricing")}
                style={{
                  height: 32,
                  padding: "0 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--arc, #ff5600)",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 650,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  boxShadow: "0 1px 3px rgba(255, 86, 0, 0.2)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 3px 6px rgba(255, 86, 0, 0.25)";
                  e.currentTarget.style.filter = "brightness(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(255, 86, 0, 0.2)";
                  e.currentTarget.style.filter = "brightness(1)";
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 1px 2px rgba(255, 86, 0, 0.2)";
                }}
              >
                Upgrade plan
              </button>
              
              {isDesktop && (
                <button
                  type="button"
                  onClick={() => navigate("/pricing")}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "rgba(17, 17, 17, 0.6)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "0 4px",
                    whiteSpace: "nowrap",
                    transition: "color 0.2s ease",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "var(--ink, #111)"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "rgba(17, 17, 17, 0.6)"}
                >
                  View pricing
                </button>
              )}
              
              <div style={{ width: 1, height: 20, background: "var(--dust, #d3cec6)", marginLeft: 2, marginRight: 2 }} />

              <button
                type="button"
                aria-label="Dismiss upgrade banner"
                onClick={() => setHideUpgradeBanner(true)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: "none",
                  background: "transparent",
                  color: "rgba(17, 17, 17, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--ink, #111)";
                  e.currentTarget.style.background = "rgba(17, 17, 17, 0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(17, 17, 17, 0.4)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}

        {/* Page content below header */}
        <main
          id="main-content"
          className="custom-scrollbar"
          style={{
            flex: 1,
            marginTop: 56 + bannerHeight,
            overflowY: "auto",
            overflowX: "hidden",
            padding: 0,
            WebkitOverflowScrolling: "touch",
          }}
        >
          <ProtectedRoute>
            <Outlet />
          </ProtectedRoute>
          <ConnectChannelsModal />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
