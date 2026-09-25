import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAutoDM } from '../../context/AutoDMContext';
import { useAuth } from '../../context/AuthContext';
import InfoHelp from '../../components/InfoHelp';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  ChevronDown,
  Eye,
  MessageSquare,
  MousePointer,
  Plus,
  Reply,
  Send,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

const quickActions = [
  { title: 'Auto DM from Comments', description: 'Send DMs to users who comment on your posts', icon: MessageSquare, href: '/dashboard/auto-dm/automations/new?trigger=comment_on_post', badge: 'POPULAR' },
  { title: 'Grow Followers', description: 'Increase followers with automated engagement', icon: TrendingUp, href: '/dashboard/auto-dm/automations/new?trigger=dm_received', badge: 'TRENDING' },
  { title: 'Generate Leads', description: 'Capture leads from your Instagram DMs', icon: Users, href: '/dashboard/auto-dm/automations/new?type=lead' },
  { title: 'Auto-reply DMs', description: 'Never miss a message with auto responses', icon: Reply, href: '/dashboard/auto-dm/automations/new?trigger=dm_received' },
];

const dateOptions = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

function Metric({ label, value, icon: Icon, loading, info }) {
  return (
    <div className="autodm-home-metric">
      <Icon size={20} />
      <p className="inline-flex items-center gap-1">
        {label}
        {info && <InfoHelp text={info} />}
      </p>
      {loading ? <span className="skeleton-shimmer" /> : <strong>{value.toLocaleString()}</strong>}
    </div>
  );
}

export default function AutoDMHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    activeAccount,
    autodmAccounts,
    loading: statusLoading,
    hasSocialInstagramConnection,
    autoDMStorageReady,
    autoDMStorageError,
    importInstagram,
    fetchDailyMetrics,
    loadAutomations,
    automations,
    automationsLoading,
  } = useAutoDM();

  const [days, setDays] = useState('7');
  const [dateOpen, setDateOpen] = useState(false);
  const [metrics, setMetrics] = useState({ messages_sent: 0, messages_seen: 0, total_clicks: 0, followers_gained: 0 });
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (!activeAccount?.id) return;
      setMetricsLoading(true);
      try {
        const rows = await fetchDailyMetrics(parseInt(days));
        setMetrics(rows.reduce((acc, row) => ({
          messages_sent: acc.messages_sent + (row.messages_sent || 0),
          messages_seen: acc.messages_seen + (row.messages_seen || 0),
          total_clicks: acc.total_clicks + (row.total_clicks || 0),
          followers_gained: acc.followers_gained + (row.followers_gained || 0),
        }), { messages_sent: 0, messages_seen: 0, total_clicks: 0, followers_gained: 0 }));
      } finally {
        setMetricsLoading(false);
      }
    };
    load();
  }, [activeAccount?.id, days]);

  useEffect(() => {
    if (activeAccount?.id) loadAutomations();
  }, [activeAccount?.id]);

  const handleImport = async () => {
    setImporting(true);
    setImportError(null);
    try {
      await importInstagram();
    } catch (error) {
      setImportError(error.response?.data?.error || error.message);
    } finally {
      setImporting(false);
    }
  };

  if (!statusLoading && autodmAccounts.length === 0) {
    return (
      <section className="autodm-setup-card">
        <img src="https://illustrations.popsy.co/amber/web-design.svg" alt="Setup Automation" className="h-40 object-contain mx-auto mb-2" />
        <h1>Set Up GAP AutoDM</h1>
        <p>Link Instagram once from Social Pilot. The same official connection powers AutoDM, autoposting, and InstaPilot.</p>
        {importError || autoDMStorageError ? (
          <div className="autodm-warning"><AlertCircle size={16} />{importError || autoDMStorageError}</div>
        ) : null}
        <button
          onClick={hasSocialInstagramConnection ? handleImport : () => navigate('/dashboard')}
          disabled={importing || (hasSocialInstagramConnection && !autoDMStorageReady)}
          className="btn-arc"
        >
          {importing ? 'Syncing Instagram...' : hasSocialInstagramConnection ? 'Sync Instagram from Social Pilot' : 'Connect Instagram in Social Pilot'}
          <ArrowRight size={16} />
        </button>
      </section>
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="autodm-home">
      <header className="autodm-page-title relative overflow-hidden">
        <div className="relative z-10">
          <p>Dashboard</p>
          <h1>Welcome back, {firstName}</h1>
          <span>Here's what's happening with your Instagram automation</span>
        </div>
        <img src="https://illustrations.popsy.co/amber/graphic-design.svg" className="absolute right-32 top-1/2 -translate-y-1/2 h-28 opacity-20 sm:opacity-100 object-contain pointer-events-none" alt="" />
        <button className="autodm-create-btn relative z-10" onClick={() => navigate('/dashboard/auto-dm/automations/new')}>
          <Plus size={16} /> Create New
        </button>
      </header>

      <section>
        <h2 className="autodm-section-heading">Quick Actions</h2>
        <div className="autodm-quick-grid">
          {quickActions.map(({ title, description, icon: Icon, href, badge }) => (
            <button key={title} className="autodm-quick-card" onClick={() => navigate(href)}>
              <span><Icon size={20} /></span>
              {badge ? <em>{badge}</em> : null}
              <strong>{title}</strong>
              <p>{description}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="autodm-section-bar">
          <h2 className="autodm-section-heading">Metrics</h2>
          <div className="autodm-date-menu">
            <button className="btn-ghost" onClick={() => setDateOpen((open) => !open)}>
              <Calendar size={15} /> {dateOptions.find((option) => option.value === days)?.label} <ChevronDown size={14} />
            </button>
            {dateOpen ? (
              <div>
                {dateOptions.map((option) => (
                  <button key={option.value} onClick={() => { setDays(option.value); setDateOpen(false); }}>{option.label}</button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="autodm-metrics-card">
          <Metric label="Messages Sent" value={metrics.messages_sent} icon={Send} loading={metricsLoading} info="Total automated direct messages successfully delivered to users" />
          <Metric label="Messages Seen" value={metrics.messages_seen} icon={Eye} loading={metricsLoading} info="Direct messages confirmed opened or read by recipients" />
          <Metric label="Total Clicks" value={metrics.total_clicks} icon={MousePointer} loading={metricsLoading} info="Total link clicks and button taps on cards sent inside AutoDM conversations" />
          <Metric label="Followers Gained" value={metrics.followers_gained} icon={Users} loading={metricsLoading} info="New Instagram followers acquired directly through follow-gate DM flows" />
        </div>
      </section>

      <section className="autodm-two-col">
        <div className="autodm-ref-card">
          <h3>Recent Automations</h3>
          {automationsLoading ? <div className="skeleton-shimmer" style={{ height: 80 }} /> : automations.length === 0 ? (
            <div className="autodm-empty compact">
              <img src="https://illustrations.popsy.co/amber/product-launch.svg" className="h-20 object-contain mx-auto mb-2" alt="No Automations" />
              <p>No automations yet</p>
            </div>
          ) : automations.slice(0, 4).map((automation) => (
            <button className="autodm-mini-row" key={automation.id} onClick={() => navigate(`/dashboard/auto-dm/automations/${automation.id}`)}>
              <span className={automation.is_active ? 'active' : ''} />
              <strong>{automation.name}</strong>
              <small>{automation.trigger_type?.replace(/_/g, ' ')}</small>
            </button>
          ))}
        </div>
        <div className="autodm-ref-card">
          <h3>Getting Started</h3>
          {[
            ['1', 'Create your first automation', 'Set up auto-replies for comments on your posts or reels'],
            ['2', 'Define your keywords', 'Choose trigger words like "link", "info", or "price"'],
            ['3', 'Build your response flow', 'Create engaging DM sequences with buttons and forms'],
          ].map(([step, title, text]) => (
            <div className="autodm-step" key={step}>
              <span>{step}</span>
              <p><strong>{title}</strong><small>{text}</small></p>
            </div>
          ))}
          <div className="autodm-good-box"><ShieldCheck size={15} /> Official Meta APIs only.</div>
        </div>
      </section>
    </div>
  );
}
