import React, { useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Hero,
  Features,
  HowItWorks,
  AboutSection,
  Pricing,
  SocialProof,
  CTASection,
  LandingNav,
} from "../features/landing";
import FAQ from "../features/landing/components/FAQ";
import { FloatingPaths } from "../components/ui/BackgroundPaths";
import SmoothScroll from "../components/ui/SmoothScroll";
import "../styles/landing.css";

export default function LandingPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      }
    }
  }, [location.hash]);

  return (
    <SmoothScroll>
      <div
        style={{
          minHeight: "100vh",
          background: "var(--canvas)",
          fontFamily: "var(--font)",
          position: "relative",
        }}
      >
        <LandingNav />

        {/* Shared Background Container for Hero & Features */}
        <div style={{ position: "relative", width: "100%" }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 0,
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            <FloatingPaths position={1} />
          </div>

          <div style={{ position: "relative", zIndex: 1 }}>
            <Hero />
            <Features />
          </div>
        </div>

        <HowItWorks />
        <AboutSection />
        <Pricing />
        <SocialProof />
        <FAQ />
        <CTASection />

        {/* Footer */}
        <footer
          style={{
            background: "var(--canvas)",
            borderTop: "1px solid rgba(20,20,19,0.08)",
            padding: "32px 32px",
          }}
        >
          <div
            className="landing-container"
            style={{
              maxWidth: 1280,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div
                style={{ fontSize: 13, fontWeight: 450, color: "var(--slate)" }}
              >
                © 2025 GAP Social-pilot. All rights reserved.
              </div>

              {isAuthenticated && user && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    background: "rgba(20,20,19,0.03)",
                    borderRadius: "10px",
                    border: "1px solid rgba(20,20,19,0.05)",
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#22c55e",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--slate)",
                    }}
                  >
                    Logged in as:{" "}
                    <span style={{ color: "var(--ink)" }}>{user.email}</span>
                  </span>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                {[
                  { label: "Docs & Guide", to: "/dashboard/docs" },
                  { label: "Privacy Policy", to: "/privacy" },
                  { label: "Terms of Service", to: "/terms" },
                ].map(({ label, to }) => (
                  <Link
                    key={label}
                    to={to}
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--slate)",
                      textDecoration: "none",
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "var(--ink)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "var(--slate)")
                    }
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </div>
    </SmoothScroll>
  );
}
