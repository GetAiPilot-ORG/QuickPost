import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, ArrowUpRight, Info, AlertCircle, Download, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import apiClient from '../utils/apiClient';

// GAP Social-pilot billing is independent from Hub product names.
function hasPaidPlan(plan) {
  if (!plan) return false;
  const p = plan.toLowerCase();
  return p !== 'free' && p !== '';
}

function normalizePlanId(plan) {
  const p = String(plan || '').toLowerCase().trim();
  if (['growth', 'sgrowth', 'enterprise', '1999', '2999'].includes(p)) return 'sgrowth';
  if (['starter', 'slite', 'pro', '999'].includes(p)) return 'slite';
  return p || 'free';
}

function normalizeBillingMonths(subscription) {
  const months = Number(subscription?.interval_months);
  if ([1, 3, 6, 12].includes(months)) return months;
  return subscription?.billing_interval === 'year' ? 12 : 1;
}

function BillingPlanSkeletonCard() {
  const line = (width, height = 12) => (
    <span
      className="billing-plan-skeleton-shimmer"
      style={{ display: "block", width, height, borderRadius: 999 }}
    />
  );

  return (
    <div
      aria-hidden="true"
      style={{
        borderRadius: 16,
        border: "1px solid #d3cec6",
        background: "#ffffff",
        padding: "32px 24px",
        minHeight: 520,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        {line("42%", 28)}
        {line("96px", 26)}
      </div>
      {line("84%")}
      <div style={{ height: 8 }} />
      {line("58%")}
      <div style={{ height: 34 }} />
      {line("48%", 46)}
      <div style={{ height: 18 }} />
      {line("72%")}
      <div style={{ height: 28 }} />
      {line("100%", 50)}
      <div style={{ height: 34 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        {Array.from({ length: 6 }).map((_, index) => line(index % 2 ? "74%" : "92%"))}
      </div>
      <div style={{ marginTop: "auto", borderRadius: 12, background: "#f8f8f8", padding: 20 }}>
        {line("62%")}
        <div style={{ height: 14 }} />
        {line("78%")}
      </div>
    </div>
  );
}

const PLANS_TEMPLATE = [
  {
    name: 'Free',
    id: 'free',
    price: { 1: 0, 3: 0, 6: 0, 12: 0 },
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
    price: { 1: null, 3: null, 6: null, 12: null },
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
    price: { 1: null, 3: null, 6: null, 12: null },
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
    cta: 'Upgrade to Growth',
    cardBg: '#ffffff',
    btnBg: '#1a1a1a',
    btnBorder: 'none',
    btnText: '#ffffff',
  }
];

export default function BillingPage({ embedded = false }) {
  const { user } = useAuth();
  const [billing, setBilling] = useState(1);
  const [upgrading, setUpgrading] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [invoiceError, setInvoiceError] = useState('');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentPlanName = user?.entitlements?.plan?.name || 'Free';
  const currentPlanId = normalizePlanId(user?.entitlements?.plan?.id || currentPlanName);
  const currentBillingMonths = normalizeBillingMonths(user?.entitlements?.subscription);
  const isPaid = hasPaidPlan(currentPlanName);
  
  React.useEffect(() => {
    console.log('🔍 [BILLING] Current user info:', user);
    console.log('🔍 [BILLING] Current entitlements:', user?.entitlements);
    console.log('🔍 [BILLING] Subscription details:', user?.entitlements?.subscription);
  }, [user]);

  React.useEffect(() => { window.scrollTo(0, 0); }, []);

  React.useEffect(() => {
    let alive = true;
    apiClient.get('/api/billing/invoices')
      .then(({ data }) => {
        if (alive) setInvoices(data?.invoices || []);
      })
      .catch((err) => {
        if (!alive) return;
        if (err.response?.status === 404) {
          setInvoices([]);
          return;
        }
        setInvoiceError(err.response?.data?.message || err.message || 'Unable to load invoices');
      });
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    let alive = true;
    apiClient.get('/api/billing/plans')
      .then(({ data }) => {
        if (!alive) return;
        if (data.success && data.plans) {
          const merged = data.plans.map(dp => {
            const staticPlan = PLANS_TEMPLATE.find(sp => sp.id === dp.id);
            if (!staticPlan) return null;
            const priceMap = {
              1: dp.prices && dp.prices.hasOwnProperty('month') ? dp.prices.month : staticPlan.price?.[1],
              3: dp.prices && dp.prices.hasOwnProperty('quarterly') ? dp.prices.quarterly : staticPlan.price?.[3],
              6: dp.prices && dp.prices.hasOwnProperty('six_months') ? dp.prices.six_months : staticPlan.price?.[6],
              12: dp.prices && dp.prices.hasOwnProperty('year') ? dp.prices.year : staticPlan.price?.[12]
            };
            return {
              ...staticPlan,
              ...dp,
              price: priceMap
            };
          }).filter(Boolean);
          setPlans(merged);
        }
      })
      .catch((err) => {
        if (!alive) return;
        console.error('Failed to load pricing:', err);
        setError('Pricing temporarily unavailable');
        setPlans(PLANS_TEMPLATE.map(sp => ({
          ...sp,
          price: { 1: sp.id === 'free' ? 0 : null, 3: sp.id === 'free' ? 0 : null, 6: sp.id === 'free' ? 0 : null, 12: sp.id === 'free' ? 0 : null }
        })));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const formatAmount = (amount) => {
    const value = Number(amount || 0);
    return `₹${Math.round(value / 100).toLocaleString('en-IN')}`;
  };

  const formatDate = (value) => {
    if (!value) return 'Not available';
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  };

  const getBillingText = (months) => {
    if (months === 1) return 'billed monthly';
    if (months === 3) return 'billed quarterly';
    if (months === 6) return 'billed bi-annually';
    if (months === 12) return 'billed annually';
    return '';
  };

  const visiblePlans = (loading ? PLANS_TEMPLATE : plans).filter((plan) => {
    if (isPaid && plan.id === 'free') return false;
    return true;
  });

  const handleUpgrade = async (plan) => {
    if ((currentPlanId === plan.id && currentBillingMonths === billing) || plan.id === 'free') {
      return;
    }

    const currentPrice = plan.price?.[billing];
    if (currentPrice === null || currentPrice === undefined) {
      alert('This plan or billing interval is currently unavailable.');
      return;
    }

    try {
      setUpgrading(plan.id);
      console.log(`💳 [PAYMENT INITIATED] Plan: ${plan.name} | Interval: ${billing} month(s) | Amount to be charged: ₹${currentPrice * billing}`);
      
      const { data, error } = await supabase.functions.invoke('create-payment-link', {
        body: {
          planId: plan.id,
          interval: billing,
          userId: user.userId,
          customerName: user.name,
          customerEmail: user.email,
        },
      });

      if (error) throw error;
      if (data.success && data.payment_link) {
        window.location.href = data.payment_link;
      } else {
        throw new Error(data.error || 'Failed to create payment link');
      }
    } catch (err) {
      console.error('Upgrade error:', err);
      alert(err.message || 'Something went wrong. Please try again.');
    } finally {
      setUpgrading(null);
    }
  };

  return (
    <div style={{ padding: embedded ? 0 : '32px', maxWidth: embedded ? 'none' : 1100, margin: '0 auto', fontFamily: 'var(--font)' }}>
      {/* Header */}
      {!embedded && <div style={{ marginBottom: 40, position: 'relative', minHeight: 82 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          Billing & Plans
        </h1>
        <p style={{ fontSize: 14, color: 'var(--slate)', margin: 0 }}>
          Manage your subscription and billing details.
        </p>
        <video
          src="/assets/piggy-bank.webm"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -28,
            right: 0,
            width: 260,
            height: 150,
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      </div>}

      {/* Current Plan Banner */}
      <div style={{ 
        background: 'var(--canvas-lifted)', 
        border: '1px solid rgba(20,20,19,0.08)',
        borderRadius: 'var(--r-hero)',
        padding: '24px',
        marginBottom: embedded ? 20 : 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 20
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--slate)', marginBottom: 4 }}>
            Current Plan
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)' }}>
            {currentPlanName} Plan
          </div>
        </div>
        {isPaid && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--slate)', background: 'var(--canvas)', padding: '8px 12px', borderRadius: 'var(--r-btn)', border: '1px solid rgba(20,20,19,0.05)' }}>
            <AlertCircle size={14} />
            Subscription managed via getaipilot.in
          </div>
        )}
      </div>

      <section style={{
        background: 'var(--canvas-lifted)',
        border: '1px solid var(--dust)',
        borderRadius: 'var(--r-hero)',
        padding: 24,
        marginBottom: embedded ? 24 : 36,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 500, margin: '0 0 6px' }}>Invoices</h2>
            <p style={{ fontSize: 14, color: 'var(--slate)', margin: 0 }}>Paid GAP Social-pilot billing records and receipt downloads.</p>
          </div>
        </div>

        {invoiceError ? (
          <p style={{ margin: 0, color: 'var(--danger)', fontSize: 13 }}>{invoiceError}</p>
        ) : invoices.length === 0 ? (
          isPaid ? (
            <div style={{ 
              border: '1px dashed var(--dust)', 
              borderRadius: 8, 
              padding: 24, 
              color: 'var(--slate)', 
              fontSize: 14, 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 12, 
              alignItems: 'flex-start' 
            }}>
              <div>
                Your subscription is active and managed via <strong>getaipilot.in</strong>. 
                All transaction receipts, billing history, and invoices are located in your GetAiPilot Account Center.
              </div>
              <a 
                href="https://getaipilot.in" 
                target="_blank" 
                rel="noreferrer" 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--ink)',
                  color: 'var(--canvas)',
                  padding: '8px 16px',
                  borderRadius: 'var(--r-btn)',
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = 0.9}
                onMouseLeave={(e) => e.currentTarget.style.opacity = 1}
              >
                Go to GetAiPilot
              </a>
            </div>
          ) : (
            <div style={{ border: '1px dashed var(--dust)', borderRadius: 8, padding: 24, color: 'var(--slate)', fontSize: 14 }}>
              No invoices found yet. Paid invoices will appear here after Razorpay confirms payment.
            </div>
          )
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {invoices.map((invoice) => (
              <div key={invoice.id || invoice.paymentId} style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: 14,
                alignItems: 'center',
                border: '1px solid var(--dust)',
                borderRadius: 8,
                padding: 14,
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 8, background: '#ebe7e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', flexShrink: 0 }}>
                    <FileText size={17} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
                      {invoice.plan} · {formatAmount(invoice.amount)}
                    </strong>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--slate)', marginTop: 2 }}>
                      {formatDate(invoice.createdAt)} · {invoice.status}
                    </span>
                  </div>
                </div>
                {invoice.downloadUrl ? (
                  <a className="btn-ghost" href={invoice.downloadUrl} target="_blank" rel="noreferrer" download>
                    <Download size={14} /> Download
                  </a>
                ) : (
                  <button className="btn-ghost" disabled title="Invoice URL is not available for this payment yet">
                    <Download size={14} /> Download
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Billing toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          background: "#f6f5f3",
          borderRadius: 9999,
          padding: 6,
          border: "1px solid #e5e5e5",
          gap: 4,
          flexWrap: "wrap",
          justifyContent: "center"
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
                background: billing === months ? "#ffffff" : "transparent",
                color: billing === months ? "#1a1a1a" : "#666",
                boxShadow: billing === months ? "0 2px 8px rgba(0,0,0,0.04)" : "none",
                border: "none",
                borderRadius: 9999,
                padding: "8px 20px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: 8,
                letterSpacing: "-0.01em"
              }}
            >
              {label}
              {months === 12 && (
                <span style={{
                  background: billing === months ? '#ecfdf5' : '#e5e5e5',
                  color: billing === months ? '#059669' : '#666',
                  padding: "2px 8px",
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  Save 20%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Pricing cards */}
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
        @keyframes billing-plan-skeleton-sweep {
          0% { background-position: 120% 0; }
          100% { background-position: -120% 0; }
        }
        .billing-plan-skeleton-shimmer {
          background: linear-gradient(90deg, rgba(20,20,19,0.06) 25%, rgba(20,20,19,0.12) 38%, rgba(20,20,19,0.06) 63%);
          background-size: 240% 100%;
          animation: billing-plan-skeleton-sweep 1.15s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .billing-plan-skeleton-shimmer { animation: none; }
        }
      `}</style>
      <div style={{ maxWidth: visiblePlans.length === 2 ? 740 : 1150, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 20, alignItems: 'stretch' }}>
        {loading ? (
          visiblePlans.map((plan) => <BillingPlanSkeletonCard key={plan.id} />)
        ) : visiblePlans.map((plan, i) => {
            const isCurrentPlan = currentPlanId === plan.id && currentBillingMonths === billing;
            const currentPrice = plan.price?.[billing];
            const basePrice = plan.price?.[1];
            const isCheckoutDisabled = plan.id !== 'free' && (currentPrice === null || currentPrice === undefined);
            const hasDiscount = billing > 1 && basePrice > currentPrice && currentPrice > 0;
            
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                style={{
                  borderRadius: 16,
                  border: isCurrentPlan ? '2px solid #059669' : "1px solid #4a3a3a",
                  background: plan.cardBg,
                  padding: "32px 24px",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <h3 style={{ fontSize: 24, fontWeight: 500, color: "#1a1a1a", margin: 0, letterSpacing: "-0.02em" }}>
                    {plan.name}
                  </h3>
                  {isCurrentPlan ? (
                    <div style={{
                      background: "#059669",
                      borderRadius: 16,
                      padding: "4px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#ffffff",
                      whiteSpace: "nowrap"
                    }}>
                      Current Plan
                    </div>
                  ) : plan.badge && (
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
                <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-end", gap: 8 }}>
                  {currentPrice !== null && currentPrice !== undefined ? (
                    <>
                      {hasDiscount && (
                        <span style={{ fontSize: 24, color: "#999", textDecoration: "line-through", fontWeight: 500, paddingBottom: 4 }}>
                          ₹{Math.round(basePrice)}
                        </span>
                      )}
                      <span style={{ fontSize: 42, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.04em", lineHeight: 1 }}>
                        ₹{Math.round(currentPrice)}
                      </span>
                      {currentPrice > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", marginLeft: 4, paddingBottom: 2 }}>
                          <span style={{ fontSize: 12, color: "#1a1a1a", fontWeight: 600 }}>/month</span>
                          <span style={{ fontSize: 11, color: "#666" }}>{getBillingText(billing)}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 24, fontWeight: 600, color: '#1a1a1a' }}>
                      Unavailable
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 13, color: "#4a4a4a", marginBottom: 24, fontWeight: 500 }}>
                  {plan.creditsText}
                </div>

                {/* CTA */}
                <button
                  onClick={() => handleUpgrade(plan)}
                  disabled={upgrading === plan.id || isCurrentPlan || isCheckoutDisabled}
                  style={{
                    width: "100%",
                    padding: "14px 20px",
                    borderRadius: 12,
                    border: isCurrentPlan ? '1px solid #059669' : plan.btnBorder,
                    background: isCurrentPlan ? 'transparent' : plan.btnBg,
                    color: isCurrentPlan ? '#059669' : plan.btnText,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: (isCurrentPlan || isCheckoutDisabled) ? "not-allowed" : "pointer",
                    transition: "opacity 0.2s",
                    marginBottom: 32,
                    opacity: upgrading === plan.id || isCurrentPlan || isCheckoutDisabled ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isCheckoutDisabled && !isCurrentPlan) e.currentTarget.style.opacity = 0.9;
                  }}
                  onMouseLeave={(e) => {
                    if (!isCheckoutDisabled && !isCurrentPlan) e.currentTarget.style.opacity = 1;
                  }}
                >
                  {isCheckoutDisabled ? 'Unavailable' : (upgrading === plan.id ? "Processing..." : (isCurrentPlan ? 'Current Plan' : plan.cta))}
                </button>

                {/* Features list */}
                <div style={{ paddingBottom: 24 }}>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                    {plan.includedFeatures.map((f) => (
                      <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "#1a1a1a" }}>
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, flexShrink: 0 }}>
                          <Check size={16} strokeWidth={2.5} />
                        </span>
                        <span style={{ flex: 1 }}>{f}</span>
                        <Info size={14} color="#b3b3b3" style={{ flexShrink: 0 }} />
                      </li>
                    ))}
                    {plan.excludedFeatures.map((f) => (
                      <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "#999" }}>
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, flexShrink: 0 }}>
                          <X size={16} strokeWidth={2} />
                        </span>
                        <span style={{ flex: 1 }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Unlimited Box */}
                {plan.unlimitedFeatures && plan.unlimitedFeatures.length > 0 && (
                  <div style={{
                    background: plan.cardBg === '#ffffff' ? '#f8f8f8' : '#efebe5',
                    borderRadius: 12,
                    padding: "20px",
                    marginTop: "auto",
                    position: "relative"
                  }}>
                    <ArrowUpRight size={18} color="#1a1a1a" style={{ position: "absolute", top: 16, right: 16 }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>
                      UNLIMITED, ALL YEAR
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
                      Save credits on 30+ models
                    </div>
                    
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                      {plan.unlimitedFeatures.map(uf => (
                        <li key={uf.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#1a1a1a" }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 12, height: 12, background: "#e5e5e5", borderRadius: "50%" }}></div>
                            {uf.label}
                          </span>
                          <span style={{ 
                            background: "#fae8c8", 
                            color: "#966f33", 
                            padding: "4px 8px", 
                            borderRadius: 12, 
                            fontSize: 10, 
                            fontWeight: 700 
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
                    background: plan.cardBg === '#ffffff' ? '#f8f8f8' : 'rgba(239, 235, 229, 0.5)',
                    borderRadius: 12,
                    padding: "20px",
                    marginTop: "auto",
                    minHeight: 120,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#999", marginBottom: 12, textAlign: "left", width: "100%" }}>
                      UNLIMITED, ALL YEAR
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                      <li style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#b3b3b3" }}>
                        <X size={14} strokeWidth={2} />
                        <span>Advanced features limited</span>
                      </li>
                      <li style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#b3b3b3" }}>
                        <X size={14} strokeWidth={2} />
                        <span>Basic support only</span>
                      </li>
                    </ul>
                  </div>
                )}
              </motion.div>
            )
          })}
      </div>
    </div>
  );
}
