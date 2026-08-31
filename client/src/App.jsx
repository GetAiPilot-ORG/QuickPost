/* ═══════════════════════════════════════════════════════════════════
   App.jsx — Full replacement with lazy loading + ErrorBoundary
   Replace: client/src/App.jsx
═══════════════════════════════════════════════════════════════════ */

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { DialogProvider } from './context/DialogContext';
import { UploadJobProvider } from './context/UploadJobContext';
import { AutoDMProvider } from './context/AutoDMContext';
import ErrorBoundary from './components/ErrorBoundary';
import UploadManagerPanel from './components/UploadManagerPanel';
import ComplianceBanner from './components/ComplianceBanner';
import ContentProtection from './components/ContentProtection';
import { useAuth } from './context/AuthContext';

// ── Synchronous imports (auth-critical path) ──
import AuthPage from './components/AuthPage';
import AuthCallback from './components/AuthCallback';
import SSOPage from './pages/SSOPage';
import DashboardLayout from './components/DashboardLayout';
import { NotFoundPage } from './components/ui/404-page-not-found';

// ── Lazy imports (loaded on demand) ──
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const DashboardOverview = lazy(() => import('./components/DashboardOverview'));
const Analytics = lazy(() => import('./components/Analytics'));
const BroadcastForm = lazy(() => import('./components/BroadcastForm'));
const History = lazy(() => import('./pages/History'));
const ScheduledQueue = lazy(() => import('./pages/ScheduledQueue'));
const Onboarding = lazy(() => import('./components/Onboarding'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'));
const InstagramBots = lazy(() => import('./pages/InstagramBots'));
const InstagramConnect = lazy(() => import('./pages/InstagramConnect'));
const InstagramInbox = lazy(() => import('./pages/InstagramInbox'));
const YouTubeManagerPage = lazy(() => import('./pages/YouTubeManagerPage'));
const TrendFeedPage = lazy(() => import('./pages/TrendFeedPage'));
const SocialInboxPage = lazy(() => import('./pages/SocialInboxPage'));

// ── AutoDM workspace ──
const AutoDMLayout = lazy(() => import('./pages/auto-dm/AutoDMLayout'));
const AutoDMHomePage = lazy(() => import('./pages/auto-dm/AutoDMHomePage'));
const AutoDMAutomationsPage = lazy(() => import('./pages/auto-dm/AutoDMAutomationsPage'));
const AutomationEditorPage = lazy(() => import('./pages/auto-dm/AutomationEditorPage'));
const AutoDMContactsPage = lazy(() => import('./pages/auto-dm/AutoDMContactsPage'));
const AutoDMInstagramProfilePage = lazy(() => import('./pages/auto-dm/AutoDMInstagramProfilePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ConnectInstagramPage = lazy(() => import('./pages/connect/ConnectInstagramPage'));
const ConnectSuccessPage = lazy(() => import('./pages/connect/ConnectSuccessPage'));
const SelectAccountsPage = lazy(() => import('./pages/connect/SelectAccountsPage'));

// ── Page loader ──
const PageLoader = () => (
  <div
    style={{
      minHeight: '100vh',
      background: 'var(--canvas)',
      padding: '88px 24px 40px',
    }}
  >
    <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 18 }}>
      <div className="skeleton-shimmer" style={{ height: 132, borderRadius: 8 }} />
      <div className="skeleton-shimmer" style={{ height: 88, borderRadius: 8 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div className="skeleton-shimmer" style={{ height: 220, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ height: 220, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ height: 220, borderRadius: 8 }} />
      </div>
    </div>
  </div>
);

function AppContent() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <PageLoader />;

  return (
    <Routes>
      // Public
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />

      <Route
        path="/login"
        element={
          isAuthenticated
            ? localStorage.getItem('qp_onboarding_done')
              ? <Navigate to="/dashboard" replace />
              : <Navigate to="/onboarding" replace />
            : <AuthPage />
        }
      />

      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/social-sso" element={<SSOPage />} />
      <Route
        path="/onboarding"
        element={isAuthenticated ? <Onboarding /> : <Navigate to="/login" replace />}
      />
      <Route path="/connect" element={isAuthenticated ? <ConnectInstagramPage /> : <Navigate to="/login" replace />} />
      <Route path="/connect/success" element={isAuthenticated ? <ConnectSuccessPage /> : <Navigate to="/login" replace />} />
      <Route path="/connect/select" element={isAuthenticated ? <SelectAccountsPage /> : <Navigate to="/login" replace />} />

      // Protected dashboard
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardOverview />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="compose" element={<BroadcastForm />} />
        <Route path="history" element={<History />} />
        <Route path="queue" element={<ScheduledQueue />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="payment-success" element={<PaymentSuccessPage />} />
        <Route path="instapilot" element={<InstagramBots />} />
        <Route path="instapilot/connect" element={<InstagramConnect />} />
        <Route path="instapilot/inbox" element={<InstagramInbox />} />
        <Route path="youtube" element={<YouTubeManagerPage />} />
        <Route path="trends" element={<TrendFeedPage />} />
        <Route path="inbox" element={<SocialInboxPage />} />
        <Route path="profile" element={<AutoDMProvider><ProfilePage /></AutoDMProvider>} />

        {/* AutoDM workspace — has its own full-screen layout */}
        <Route path="auto-dm" element={<AutoDMLayout />}>
          <Route index element={<AutoDMHomePage />} />
          <Route path="automations" element={<AutoDMAutomationsPage />} />
          <Route path="automations/new" element={<AutomationEditorPage />} />
          <Route path="automations/:id" element={<AutomationEditorPage />} />
          <Route path="contacts" element={<AutoDMContactsPage />} />
          <Route path="instagram-profile" element={<AutoDMInstagramProfilePage />} />
        </Route>
      </Route>

      // 404
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

import MaintenanceGuard from './components/MaintenanceGuard';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <DialogProvider>
          <UploadJobProvider>
            <BrowserRouter>
              <MaintenanceGuard productKey="social_pilot">
                <Suspense fallback={<PageLoader />}>
                  <AppContent />
                </Suspense>
                <Toaster position="top-right" />
                <UploadManagerPanel />
                <ComplianceBanner />
                <ContentProtection />
              </MaintenanceGuard>
            </BrowserRouter>
          </UploadJobProvider>
        </DialogProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
