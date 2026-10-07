import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, ArrowUpRight, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import apiClient from "../../../utils/apiClient";

const HUB_PRICING_URL = 'https://uklxlappjcuvdqjvecfh.supabase.co/functions/v1/get-pricing?category=social&currency=INR';

const calculateIntervalPrices = (baseMonthly) => ({
  1: baseMonthly,
  3: Math.round(baseMonthly * 3 * 0.90) / 3,
  6: Math.round(baseMonthly * 6 * 0.80) / 6,
  12: Math.round(baseMonthly * 12 * 0.70) / 12,
});

const DEFAULT_PRICES = {
  free: { 1: 0, 3: 0, 6: 0, 12: 0 },
  slite: calculateIntervalPrices(999),
  sgrowth: calculateIntervalPrices(1999),
};

function PricingSkeletonCard({ tone = 'light' }) {
  const line = (width, height = 12) => (
    <span
      className="pricing-skeleton-shimmer"
      style={{
        display: "block",
        width,
        height,
        borderRadius: 999,
      }}
    />
  );

  return (
    <div
      aria-hidden="true"
      style={{
        borderRadius: 12,
        border: "1px solid #e5e5e5",
        background: tone === "soft" ? "#efebe5" : "#ffffff",
        padding: "32px 24px",
        minHeight: 640,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        {line("38%", 26)}
        {line("88px", 24)}
      </div>
      {line("82%")}
      <div style={{ height: 8 }} />
      {line("56%")}
      <div style={{ height: 34 }} />
      {line("44%", 52)}
      <div style={{ height: 18 }} />
      {line("68%")}
      <div style={{ height: 26 }} />
      {line("100%", 46)}
      <div style={{ height: 34 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {Array.from({ length: 7 }).map((_, index) => line(index % 3 === 0 ? "92%" : index % 3 === 1 ? "78%" : "64%"))}
      </div>
      <div style={{ marginTop: "auto", borderRadius: 12, background: "rgba(239,235,229,0.55)", padding: 20 }}>
        {line("58%")}
        <div style={{ height: 14 }} />
        {line("72%")}
        <div style={{ height: 20 }} />
        {line("86%")}
      </div>
    </div>
  );
}

const PLANS_TEMPLATE = [
  {
    name: 'Free',
    id: 'free',
    price: DEFAULT_PRICES.free,
    description: 'Perfect for getting started with basic scheduling.',
    creditsText: 'Basic access to core tools',
    includedFeatures: [
      '3 connected social accounts',
      '10 scheduled posts per channel',
      '1 active trigger word',
      '50 automated replies / month',
      'GAP Social-pilot Branding Watermark',
    ],
    excludedFeatures: [
      'Unlimited monthly posts',
      'Instagram Auto-DM accounts',
      'Hinglish & Hindi trigger matching',
      'Approval workflows',
      'Team members',
    ],
    unlimitedFeatures: [],
    cta: 'Current Plan',
    cardBg: '#f6f5f3',
    btnBg: '#ffffff',
    btnBorder: '1px solid #d1d1d1',
    btnText: '#1a1a1a',
  },
  {
    name: 'Starter',
    id: 'slite',
    price: DEFAULT_PRICES.slite,
    description: 'For creators who broadcast seriously across every platform.',
    creditsText: 'Includes priority features + unlimited posts',
    badge: 'Most popular',
    includedFeatures: [
      '10 connected social accounts',
      'Unlimited monthly posts',
      'Up to 10 Instagram Auto-DM accounts',
      'Unlimited trigger words & replies',
      'Hinglish & Hindi trigger matching',
      'Unlimited contacts',
      'Priority email support',
    ],
    excludedFeatures: [
      'Approval workflows',
      '10 team members',
      'Developer API access',
    ],
    unlimitedFeatures: [
      { label: 'Monthly posts', badge: '∞ ALL YEAR' },
      { label: 'Trigger words & replies', badge: '∞ ALL YEAR' },
      { label: 'Contacts', badge: '∞ ALL YEAR' },
    ],
    cta: 'Upgrade to Starter',
    cardBg: '#ffffff',
    btnBg: '#1a1a1a',
    btnBorder: 'none',
    btnText: '#ffffff',
  },
  {
    name: 'Growth',
    id: 'sgrowth',
    price: DEFAULT_PRICES.sgrowth,
    description: 'For teams, agencies, and heavy automation users.',
    creditsText: 'Full access for scaling content production',
    badge: 'Expert choice',
    includedFeatures: [
      '30 connected social accounts',
      'Up to 30 Instagram Auto-DM accounts',
      'Unlimited posts, replies & contacts',
      'Hinglish & Hindi trigger matching',
      'Approval workflows',
      '10 team members',
      'Developer API access',
    ],
    excludedFeatures: [],
    unlimitedFeatures: [
      { label: 'Posts, replies & contacts', badge: '∞ ALL YEAR' },
      { label: 'Custom integrations', badge: '∞ ALL YEAR' },
      { label: 'Team members', badge: '∞ ALL YEAR' },
    ],
    cta: 'Get Growth',
    cardBg: '#ffffff',
    btnBg: '#1a1a1a',
    btnBorder: 'none',
    btnText: '#ffffff',
  }
];

export default function Pricing({ hideHeader = false }) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [billing, setBilling] = useState(1);
  const [upgrading, setUpgrading] = useState(null);
  const [plans, setPlans] = useState(PLANS_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    let alive = true;
    async function fetchPlans() {
      let rawPlans = null;

      // 1. Try apiClient / backend route
      try {
        const res = await apiClient.get('/api/billing/plans', { timeout: 3500 });
        if (res.data?.success && Array.isArray(res.data.plans)) {
          rawPlans = res.data.plans;
        }
      } catch (err) {
        console.warn('Backend /api/billing/plans unreachable, attempting direct Hub fallback...', err.message);
      }

      // 2. If backend route failed, query authoritative Hub Supabase Edge Function directly
      if (!rawPlans) {
        try {
          const res = await fetch(HUB_PRICING_URL, { headers: { 'Content-Type': 'application/json' } });
          if (res.ok) {
            const data = await res.json();
            if (data?.currency === 'INR' && Array.isArray(data.plans)) {
              const starter = data.plans.find(p => p.plan_name === 'social_pilot_starter');
              const growth = data.plans.find(p => p.plan_name === 'social_pilot_growth');
              rawPlans = [
                { id: 'free', prices: { month: 0, quarterly: 0, six_months: 0, year: 0 } },
                { id: 'slite', prices: starter ? calculateIntervalPrices(starter.amount / 100) : DEFAULT_PRICES.slite },
                { id: 'sgrowth', prices: growth ? calculateIntervalPrices(growth.amount / 100) : DEFAULT_PRICES.sgrowth },
              ];
            }
          }
        } catch (hubErr) {
          console.warn('Hub edge function fetch failed, using fallback defaults:', hubErr.message);
        }
      }

      if (!alive) return;

      const merged = PLANS_TEMPLATE.map(sp => {
        const dp = rawPlans?.find(p => p.id === sp.id);
        const priceMap = {
          1: dp?.prices?.month ?? dp?.prices?.[1] ?? sp.price[1],
          3: dp?.prices?.quarterly ?? dp?.prices?.[3] ?? sp.price[3],
          6: dp?.prices?.six_months ?? dp?.prices?.[6] ?? sp.price[6],
          12: dp?.prices?.year ?? dp?.prices?.[12] ?? sp.price[12]
        };
        return {
          ...sp,
          ...(dp || {}),
          price: priceMap
        };
      });

      setPlans(merged);
      setError(null);
      setLoading(false);
    }
    fetchPlans();
    return () => { alive = false; };
  }, []);

  const handleUpgrade = async (plan) => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (plan.id === "free") {
      navigate("/dashboard");
      return;
    }

    const currentPrice = plan.price?.[billing];
    if (currentPrice === null || currentPrice === undefined) {
      alert('This plan or billing interval is currently unavailable.');
      return;
    }

    try {
      setUpgrading(plan.id);

      const { data, error } = await supabase.functions.invoke('create-payment-link', {
        body: {
          planId: plan.id,
          interval: billing,
          userId: user.userId,
          customerName: user.name,
          customerEmail: user.email,
        },}
      );

      if (error) throw error;
      if (data.success && data.payment_link) {
        window.location.href = data.payment_link;
      } else {
        throw new Error(data.error || "Failed to create payment link");
      }
    } catch (err) {
      console.error("Upgrade error:", err);
      alert(err.message || "Something went wrong. Please try again.");
    } finally {
      setUpgrading(null);
    }
  };

  const getBillingText = (months) => {
    if (months === 1) return 'billed monthly';
    if (months === 3) return 'billed quarterly';
    if (months === 6) return 'billed bi-annually';
    if (months === 12) return 'billed annually';
    return '';
  };

  return (
    <section
      id="pricing"
      className="landing-section"
      style={{ padding: "80px 24px", background: "#fdfdfa", fontFamily: "var(--font)" }}
    >
      <div
        className="landing-container"
        style={{ maxWidth: 1200, margin: "0 auto" }}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{
            textAlign: "center",
            marginBottom: 48,
          }}
        >
          {!hideHeader && (
            <h2
              style={{
                fontSize: "clamp(32px, 5vw, 42px)",
                fontWeight: 600,
                color: "#3d0c0c",
                letterSpacing: "-0.03em",
                margin: "0 0 40px",
                lineHeight: 1.1,
              }}
            >
              Plans that cover your needs
            </h2>
          )}

          {/* Toggle Area */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 48,
            maxWidth: 1150,
            margin: "0 auto 48px",
            flexWrap: "wrap",
            gap: 20
          }}>
            {/* Left side: dummy Individual/Teams toggle */}
            <div style={{
              display: "flex",
              alignItems: "center",
              background: "#ffffff",
              borderRadius: 9999,
              padding: 4,
              border: "1px solid #e5e5e5",
            }}>
            </div>

            {/* Right side: Billing toggle */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 16
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                background: "#ffffff",
                borderRadius: 9999,
                padding: 4,
                border: "1px solid #e5e5e5",
              }}>
                {[
                  { months: 1, label: 'Monthly' },
                  { months: 3, label: 'Quarterly' },
                  { months: 6, label: 'Half-Yearly' },
                  { months: 12, label: 'Annually' }
                ].map(({ months, label }) => (
                  <button
                    key={months}
                    onClick={() => setBilling(months)}
                    style={{
                      background: billing === months ? "#1a1a1a" : "transparent",
                      color: billing === months ? "#ffffff" : "#666",
                      border: "none",
                      borderRadius: 9999,
                      padding: "8px 20px",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 13, color: "#666" }}>Save 20% with annual</span>
            </div>
          </div>
        </motion.div>

        {error && (
          <div style={{
            textAlign: 'center', color: '#ff4444', background: 'rgba(255,68,68,0.1)',
            padding: '12px 24px', borderRadius: 8, marginBottom: 24,
            fontSize: 14, fontWeight: 600, maxWidth: 1100, margin: '0 auto 24px'
          }}>
            ⚠️ {error}. Paid checkouts are disabled.
          </div>
        )}

        <style>{`
          @keyframes pricing-skeleton-sweep {
            0% { background-position: 120% 0; }
            100% { background-position: -120% 0; }
          }
          .pricing-skeleton-shimmer {
            background: linear-gradient(90deg, rgba(20,20,19,0.06) 25%, rgba(20,20,19,0.12) 38%, rgba(20,20,19,0.06) 63%);
            background-size: 240% 100%;
            animation: pricing-skeleton-sweep 1.15s ease-in-out infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .pricing-skeleton-shimmer { animation: none; }
          }
        `}</style>

        {/* Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: 20,
          alignItems: 'stretch',
          maxWidth: 1150,
          margin: '0 auto',
        }}>
          {loading ? (
            PLANS_TEMPLATE.map((plan) => (
              <PricingSkeletonCard key={plan.id} tone={plan.id === "free" ? "soft" : "light"} />
            ))
          ) : plans.map((plan, i) => {
            const currentPrice = plan.price?.[billing];
            const basePrice = plan.price?.[1];
            const isCheckoutDisabled = plan.id !== 'free' && (currentPrice === null || currentPrice === undefined);
            const hasDiscount = billing > 1 && basePrice > currentPrice && currentPrice > 0;

            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                style={{
                  borderRadius: 12,
                  border: plan.name === 'Pro' ? '1px solid #3d0c0c' : plan.name === 'Enterprise' ? '1px solid #1a1a1a' : '1px solid #e5e5e5',
                  background: plan.name === 'Free' ? '#efebe5' : plan.name === 'Pro' ? '#ffffff' : '#f8f8f8',
                  padding: "32px 24px",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <h3 style={{ fontSize: 24, fontWeight: 400, color: "#1a1a1a", margin: 0 }}>
                    {plan.name}
                  </h3>
                  {plan.badge && (
                    <div style={{
                      border: "1px solid #1a1a1a",
                      borderRadius: 16,
                      padding: "4px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#1a1a1a",
                      whiteSpace: "nowrap"
                    }}>
                      {plan.badge}
                    </div>
                  )}
                </div>

                <p style={{ fontSize: 13, color: "#4a4a4a", margin: "0 0 24px", minHeight: 40, lineHeight: 1.5 }}>
                  {plan.description}
                </p>

                {/* Pricing */}
                <div style={{ marginBottom: 12, display: "flex", alignItems: "baseline", gap: 8 }}>
                  {currentPrice !== null && currentPrice !== undefined ? (
                    <>
                      {hasDiscount && (
                        <span style={{ fontSize: 24, color: "#b3b3b3", textDecoration: "line-through", fontWeight: 400 }}>
                          ₹{Math.round(basePrice)}
                        </span>
                      )}
                      <span style={{ fontSize: 44, fontWeight: 500, color: "#1a1a1a", letterSpacing: "-0.03em", lineHeight: 1 }}>
                        ₹{Math.round(currentPrice)}
                      </span>
                      {currentPrice > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", marginLeft: 4 }}>
                          <span style={{ fontSize: 13, color: "#1a1a1a", fontWeight: 500 }}>/month</span>
                          <span style={{ fontSize: 11, color: "#1a1a1a" }}>{getBillingText(billing)}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 24, fontWeight: 500, color: '#ff4444' }}>
                      Unavailable
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 12, color: "#1a1a1a", marginBottom: 24, fontWeight: 400 }}>
                  {plan.creditsText}
                </div>

                {/* CTA */}
                <button
                  onClick={() => handleUpgrade(plan)}
                  disabled={upgrading === plan.id || isCheckoutDisabled}
                  style={{
                    width: "100%",
                    padding: "12px 20px",
                    borderRadius: 8,
                    border: plan.name === 'Free' ? '1px solid #1a1a1a' : 'none',
                    background: plan.name === 'Free' ? 'transparent' : plan.name === 'Pro' ? '#3d0c0c' : '#1a1a1a',
                    color: plan.name === 'Free' ? '#1a1a1a' : '#ffffff',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: isCheckoutDisabled ? "not-allowed" : "pointer",
                    transition: "opacity 0.2s",
                    marginBottom: 32,
                    opacity: upgrading === plan.id || isCheckoutDisabled ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isCheckoutDisabled) e.currentTarget.style.opacity = 0.9;
                  }}
                  onMouseLeave={(e) => {
                    if (!isCheckoutDisabled) e.currentTarget.style.opacity = 1;
                  }}
                >
                  {isCheckoutDisabled ? 'Unavailable' : (upgrading === plan.id ? "Processing..." : plan.cta)}
                </button>
                     
                     {/* <CTASection /> */}
                {/* Features list */}
                <div style={{ paddingBottom: 24, flex: 1 }}>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                    {plan.includedFeatures.map((f) => (
                      <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#1a1a1a" }}>
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, flexShrink: 0, marginTop: 2 }}>
                          <Check size={14} strokeWidth={2} />
                        </span>
                        <span style={{ flex: 1, lineHeight: 1.4 }}>{f}</span>
                        <Info size={12} color="#b3b3b3" style={{ flexShrink: 0, marginTop: 3 }} />
                      </li>
                    ))}
                    {plan.excludedFeatures.map((f) => (
                      <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#a3a3a3" }}>
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, flexShrink: 0, marginTop: 2 }}>
                          <X size={14} strokeWidth={2} />
                        </span>
                        <span style={{ flex: 1, lineHeight: 1.4 }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Unlimited Box */}
                {plan.unlimitedFeatures && plan.unlimitedFeatures.length > 0 && (
                  <div style={{
                    background: plan.name === 'Pro' ? '#f8f8f8' : '#efebe5',
                    borderRadius: 12,
                    padding: "20px",
                    marginTop: "auto",
                    position: "relative"
                  }}>
                    <ArrowUpRight size={18} color="#1a1a1a" style={{ position: "absolute", top: 16, right: 16 }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>
                      UNLIMITED, ALL YEAR
                    </div>
                    <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
                      Save credits on 30+ models
                    </div>
                    
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                      {plan.unlimitedFeatures.map(uf => (
                        <li key={uf.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#1a1a1a" }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 14, height: 14, background: "#e5e5e5", borderRadius: "50%" }}></div>
                            {uf.label}
                          </span>
                          <span style={{ 
                            background: "#fae8c8", 
                            color: "#966f33", 
                            padding: "4px 10px", 
                            borderRadius: 12, 
                            fontSize: 10, 
                            fontWeight: 700,
                            letterSpacing: "0.02em"
                          }}>
                            {uf.badge}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(!plan.unlimitedFeatures || plan.unlimitedFeatures.length === 0) && (
                  <div style={{
                    background: 'rgba(239, 235, 229, 0.4)',
                    borderRadius: 12,
                    padding: "20px",
                    marginTop: "auto",
                    minHeight: 120,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#a3a3a3", marginBottom: 4 }}>
                      UNLIMITED, ALL YEAR
                    </div>
                    <div style={{ fontSize: 13, color: "#b3b3b3", marginBottom: 16 }}>
                      Save credits on 30+ models
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                      <li style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#b3b3b3" }}>
                        <X size={14} strokeWidth={2} />
                        <span>Advanced features limited</span>
                      </li>
                      <li style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#b3b3b3" }}>
                        <X size={14} strokeWidth={2} />
                        <span>Basic support only</span>
                      </li>
                    </ul>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
        
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#666" }}>
          Prices exclude VAT and local taxes
        </div>
      </div>
    </section>
  );
}

