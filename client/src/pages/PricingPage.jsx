import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronDown,
  Building2,
  Globe,
  Shield,
  Zap,
  Check,
} from "lucide-react";
import LandingNav from "../features/landing/components/LandingNav";
import Pricing from "../features/landing/components/Pricing";
import { useAuth } from "../context/AuthContext";
import "../styles/landing.css";
import { CTASection } from "../features/landing";

import FAQ from "../features/landing/components/FAQ";

export default function PricingPage() {
  const navigate = useNavigate();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const { user, isAuthenticated } = useAuth();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--canvas)",
        fontFamily: "var(--font)",
      }}
    >
      <LandingNav />

      {/* ── Pricing Hero ── */}
      <section
        style={{
          paddingTop: "clamp(80px, 15vh, 120px)",
          paddingBottom: "40px",
          paddingHorizontal: "24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1
              style={{
                fontSize: "clamp(48px, 8vw, 72px)",
                fontWeight: 600,
                color: "var(--ink)",
                letterSpacing: "-0.04em",
                lineHeight: 1.05,
                margin: "0 0 24px",
              }}
            >
              Simple, honest pricing.
            </h1>
            <p
              style={{
                fontSize: "clamp(18px, 2.5vw, 22px)",
                fontWeight: 450,
                color: "var(--slate)",
                lineHeight: 1.5,
                maxWidth: 580,
                margin: "0 auto 48px",
              }}
            >
              Start free, scale when you're ready. No hidden fees, no surprises.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Trusted By ── */}
      <section style={{ paddingBottom: "64px", textAlign: "center" }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--slate-light)",
            }}
          >
            Trusted by 10,000+ creators
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "clamp(24px, 5vw, 48px)",
              opacity: 0.6,
              flexWrap: "wrap",
            }}
          >
            {/* Minimalist fake logos */}
            {["Acme Corp", "GlobalScale", "Nexus", "Vertex", "Lumina"].map(
              (name) => (
                <span
                  key={name}
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: "var(--slate)",
                  }}
                >
                  {name}
                </span>
              ),
            )}
          </div>
        </motion.div>
      </section>

      {/* The beautiful polished pricing component */}
      <div style={{ paddingBottom: 20 }}>
        <Pricing hideHeader />
      </div>

      {/* ── Feature Comparison Table ── */}
      <section
        style={{
          padding: "clamp(40px, 8vh, 80px) 24px",
          background: "var(--canvas)",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            style={{ textAlign: "center", marginBottom: 48 }}
          >
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 40px)",
                fontWeight: 600,
                color: "var(--ink)",
                letterSpacing: "-0.03em",
                margin: "0 0 16px",
              }}
            >
              Compare features
            </h2>
            <p
              style={{
                fontSize: 16,
                color: "var(--slate)",
                maxWidth: 500,
                margin: "0 auto",
              }}
            >
              Detailed breakdown of everything included in each tier.
            </p>
          </motion.div>

          <div
            style={{
              position: "relative",
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              paddingBottom: 64,
              paddingTop: 16,
            }}
          >
            <style>{`
              .pricing-compare-table { width: 100%; min-width: 800px; border-collapse: separate; border-spacing: 0; text-align: left; }
              
              /* Headers */
              .pricing-compare-table th { 
                position: sticky; top: 0; z-index: 10;
                background: rgba(245, 241, 236, 0.95);
                backdrop-filter: blur(12px);
                padding: 24px;
                border-bottom: 1px solid rgba(20,20,19,0.08);
                font-size: 16px; font-weight: 600; color: var(--ink);
              }
              .pricing-compare-table th:first-child { font-size: 13px; color: var(--slate); font-weight: 500; }
              
              /* Body Cells */
              .pricing-compare-table td { 
                padding: 24px; 
                border-bottom: 1px solid rgba(20,20,19,0.05); 
                font-size: 15px; color: var(--slate); 
                transition: background 0.2s ease;
              }
              .pricing-compare-table tr:hover td:not(.highlight-col) { background: rgba(20,20,19,0.02); }
              .pricing-compare-table td.feature-name { color: var(--ink); font-weight: 500; }
              
              /* Section Rows */
              .pricing-compare-table tr.section-row td {
                padding: 56px 24px 16px;
                border-bottom: 1px solid rgba(20,20,19,0.08);
              }
              .pricing-compare-table td.section-header { 
                font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink);
              }
              
              /* THE WHITE PILLAR HIGHLIGHT */
              .pricing-compare-table th.highlight-col {
                position: sticky; z-index: 11;
                background: #ffffff;
                border-top-left-radius: 20px;
                border-top-right-radius: 20px;
                border-bottom: none;
                border-left: 1px solid rgba(20,20,19,0.03);
                border-right: 1px solid rgba(20,20,19,0.03);
                border-top: 1px solid rgba(20,20,19,0.03);
                box-shadow: 0 -12px 40px rgba(0,0,0,0.03);
              }
              .pricing-compare-table td.highlight-col {
                position: relative; z-index: 1;
                background: #ffffff;
                color: var(--ink);
                font-weight: 500;
                border-left: 1px solid rgba(20,20,19,0.03);
                border-right: 1px solid rgba(20,20,19,0.03);
                border-bottom: 1px solid rgba(20,20,19,0.03);
                box-shadow: -12px 0 40px rgba(0,0,0,0.015), 12px 0 40px rgba(0,0,0,0.015);
              }
              .pricing-compare-table tr.section-row td.highlight-col {
                border-bottom: 1px solid rgba(20,20,19,0.06);
              }
              .pricing-compare-table tr:last-child td.highlight-col {
                border-bottom-left-radius: 20px;
                border-bottom-right-radius: 20px;
                border-bottom: 1px solid rgba(20,20,19,0.03);
                padding-bottom: 32px;
                box-shadow: -12px 0 40px rgba(0,0,0,0.015), 12px 0 40px rgba(0,0,0,0.015), 0 12px 40px rgba(0,0,0,0.03);
              }
              
              /* Check icon */
              .feat-check {
                display: inline-flex; align-items: center; justify-content: center;
                width: 26px; height: 26px; border-radius: 50%;
                background: rgba(20,20,19,0.04); color: var(--slate);
              }
              .feat-check.active {
                background: rgba(5, 150, 105, 0.12); color: #059669;
              }
              .feat-dash { color: rgba(20,20,19,0.15); font-weight: 400; }
            `}</style>
            <table className="pricing-compare-table">
              <thead>
                <tr>
                  <th style={{ width: "34%" }}>Features</th>
                  <th style={{ width: "22%" }}>Free</th>
                  <th className="highlight-col" style={{ width: "22%" }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      Starter
                      <span
                        style={{
                          fontSize: 10,
                          padding: "4px 10px",
                          background: "var(--ink)",
                          color: "#fff",
                          borderRadius: 999,
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                        }}
                      >
                        RECOMMENDED
                      </span>
                    </div>
                  </th>
                  <th style={{ width: "22%" }}>Growth</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { section: "Publishing" },
                  {
                    feature: "Connected Social Accounts",
                    free: "3",
                    slite: "10",
                    sgrowth: "Unlimited",
                  },
                  {
                    feature: "Posts per month",
                    free: "10 / channel",
                    slite: "Unlimited",
                    sgrowth: "Unlimited",
                  },
                  {
                    feature: "Automated Publishing",
                    free: true,
                    slite: true,
                    sgrowth: true,
                  },
                  {
                    feature: "Bulk Upload",
                    free: false,
                    slite: true,
                    sgrowth: true,
                  },
                  {
                    feature: "Custom Timezones",
                    free: false,
                    slite: true,
                    sgrowth: true,
                  },
                  { section: "Analytics" },
                  {
                    feature: "Basic Reporting",
                    free: true,
                    slite: true,
                    sgrowth: true,
                  },
                  {
                    feature: "Engagement Metrics",
                    free: false,
                    slite: true,
                    sgrowth: true,
                  },
                  {
                    feature: "Custom Export (CSV/PDF)",
                    free: false,
                    slite: false,
                    sgrowth: true,
                  },
                  { section: "Team & Support" },
                  {
                    feature: "Team Members",
                    free: "1",
                    slite: "Up to 5",
                    sgrowth: "Unlimited",
                  },
                  {
                    feature: "Approval Workflows",
                    free: false,
                    slite: false,
                    sgrowth: true,
                  },
                  {
                    feature: "Support Level",
                    free: "Community",
                    slite: "Priority Email",
                    sgrowth: "24/7 Dedicated",
                  },
                ].map((row, i) =>
                  row.section ? (
                    <tr key={`sec-${i}`} className="section-row">
                      <td className="section-header">{row.section}</td>
                      <td></td>
                      <td className="highlight-col"></td>
                      <td></td>
                    </tr>
                  ) : (
                    <tr key={`row-${i}`}>
                      <td className="feature-name">{row.feature}</td>
                      <td>
                        {row.free === true ? (
                          <div className="feat-check active">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        ) : row.free === false ? (
                          <span className="feat-dash">—</span>
                        ) : (
                          row.free
                        )}
                      </td>
                      <td className="highlight-col">
                        {row.slite === true ? (
                          <div className="feat-check active">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        ) : row.slite === false ? (
                          <span className="feat-dash">—</span>
                        ) : (
                          row.slite
                        )}
                      </td>
                      <td>
                        {row.sgrowth === true ? (
                          <div className="feat-check active">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        ) : row.sgrowth === false ? (
                          <span className="feat-dash">—</span>
                        ) : (
                          row.sgrowth
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── All plans include ── */}
      <section
        style={{
          padding: "clamp(40px, 6vh, 64px) 24px",
          background: "var(--canvas-lifted)",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            style={{ textAlign: "center", marginBottom: 40 }}
          >
            <div
              className="eyebrow"
              style={{ justifyContent: "center", marginBottom: 16 }}
            >
              Every plan
            </div>
            <h2
              style={{
                fontSize: "clamp(24px, 3.5vw, 36px)",
                fontWeight: 600,
                color: "var(--ink)",
                letterSpacing: "-0.03em",
                margin: 0,
              }}
            >
              What's always included
            </h2>
          </motion.div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 20,
            }}
          >
            {[
              {
                icon: <Globe size={20} />,
                label: "11+ platforms",
                sub: "Instagram, YouTube, TikTok & more",
              },
              {
                icon: <Shield size={20} />,
                label: "Secure OAuth",
                sub: "Read-only credentials, never stored",
              },
              {
                icon: <Zap size={20} />,
                label: "Background jobs",
                sub: "Upload manager tracks every post",
              },
              {
                icon: <Globe size={20} />,
                label: "Timezone sync",
                sub: "Schedule posts in any timezone",
              },
              {
                icon: <Check size={20} />,
                label: "Live preview",
                sub: "See how each post looks per platform",
              },
              {
                icon: <Shield size={20} />,
                label: "No watermarks",
                sub: "Your content, your brand",
              },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                style={{
                  background: "var(--white)",
                  borderRadius: "12px",
                  border: "1px solid rgba(20,20,19,0.06)",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  boxShadow: "0 1px 2px rgba(20,20,19,0.02)",
                }}
              >
                <div style={{ color: "var(--ink)", opacity: 0.8 }}>
                  {item.icon}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--ink)",
                      letterSpacing: "-0.01em",
                      marginBottom: 4,
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 450,
                      color: "var(--slate)",
                      lineHeight: 1.45,
                    }}
                  >
                    {item.sub}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <FAQ />
      {/* ── CTA ── */}
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
  );
}
