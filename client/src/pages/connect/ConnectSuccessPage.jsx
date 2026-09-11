import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  CalendarClock,
  CheckCircle,
  Grid3X3,
  Instagram,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  UserPlus,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchInstagramAccounts, importSocialInstagramAccount } from '../../services/instagramApi';
import { autodmSupabase } from '../../services/autodm/supabaseClient';

function numberLabel(value, fallback = '-') {
  const numeric = Number(value);
  if (value == null || value === '' || Number.isNaN(numeric)) return fallback;
  return new Intl.NumberFormat('en', {
    notation: numeric >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(numeric);
}

function dateLabel(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function StatTile({ icon: Icon, label, value, detail }) {
  return (
    <article style={{
      minHeight: 112,
      border: '1px solid var(--dust)',
      borderRadius: 'var(--r-card)',
      background: '#fff',
      padding: 18,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: 14
    }}>
      <Icon size={18} color="var(--arc)" />
      <div>
        <strong style={{ display: 'block', color: 'var(--ink)', fontSize: 28, fontWeight: 650, lineHeight: 1 }}>
          {value}
        </strong>
        <p style={{ margin: '8px 0 0', color: 'var(--ink)', fontSize: 14, fontWeight: 650 }}>{label}</p>
        {detail ? <small style={{ display: 'block', marginTop: 4, color: 'var(--slate)', fontSize: 12 }}>{detail}</small> : null}
      </div>
    </article>
  );
}

function StatusRow({ icon: Icon, label, value }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '13px 0',
      borderBottom: '1px solid rgba(20,20,19,0.08)'
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color: 'var(--slate)', fontSize: 13 }}>
        <Icon size={16} />
        {label}
      </span>
      <strong style={{ color: 'var(--ink)', fontSize: 13, fontWeight: 650, textAlign: 'right' }}>{value}</strong>
    </div>
  );
}

export default function ConnectSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshAccounts, user } = useAuth();
  
  const [activeInstagramAccount, setActiveInstagramAccount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasCompleted = useRef(false);
  const [loadError, setLoadError] = useState(null);
  const [hasConnectedAccount, setHasConnectedAccount] = useState(false);

  useEffect(() => {
    const hydrateAccounts = async () => {
      try {
        setLoadError(null);
        setHasConnectedAccount(false);

        if (!user?.userId) {
          setLoadError('Please log in again to finish connecting Instagram.');
          return;
        }

        await importSocialInstagramAccount().catch((error) => {
          console.warn('Instagram import after OAuth skipped:', error?.message || error);
        });

        let accounts = [];
        try {
          accounts = await fetchInstagramAccounts();
        } catch (error) {
          console.warn('Instagram accounts API unavailable, using Supabase fallback:', error?.message || error);
          const { data, error: fallbackError } = await autodmSupabase
            .from('instagram_accounts')
            .select('*')
            .eq('user_id', user.userId)
            .eq('is_connected', true)
            .order('updated_at', { ascending: false });

          if (fallbackError) throw fallbackError;
          accounts = data || [];
        }
        const connectedAccounts = (accounts || []).filter(acc => acc.is_connected !== false);

        if (connectedAccounts.length > 0) {
          setActiveInstagramAccount(connectedAccounts[0]);
          setHasConnectedAccount(true);
          await refreshAccounts();
        } else {
          setActiveInstagramAccount(null);
          setLoadError('Instagram connected, but no active account was found. Please reconnect.');
        }
      } catch (e) {
        console.error('Unexpected error hydrating instagram accounts:', e);
        setLoadError('Failed to finish Instagram connection. Please retry.');
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.userId) {
      hydrateAccounts();
    }
  }, [refreshAccounts, user?.userId]);

  useEffect(() => {
    if (isLoading) return;
    if (!hasConnectedAccount) return;
    if (hasCompleted.current) return;
    hasCompleted.current = true;

    const username = activeInstagramAccount?.instagram_username || activeInstagramAccount?.username || searchParams.get('username') || 'your account';
    toast.success(`@${username} connected`);
  }, [isLoading, hasConnectedAccount, activeInstagramAccount, searchParams]);

  const fallbackUsername = searchParams.get('username');
  const username = activeInstagramAccount?.instagram_username || activeInstagramAccount?.username || fallbackUsername || 'your account';
  const displayName = activeInstagramAccount?.name || activeInstagramAccount?.full_name || username;
  const accountType = activeInstagramAccount?.account_type || 'Professional';
  const followingValue = activeInstagramAccount?.following_count;
  const isReady = !isLoading && !loadError && hasConnectedAccount;
  const tokenLabel = activeInstagramAccount?.is_connected === false
    ? 'Disconnected'
    : ['expired', 'needs_reauth'].includes(activeInstagramAccount?.token_status)
      ? activeInstagramAccount.token_status.replace('_', ' ')
      : isReady ? 'Active' : 'Checking';

  return (
    <div className="connect-success-screen">
      <main className="connect-success-card">
        <img
          className="connect-success-art"
          src="/account connect.png"
          alt=""
          aria-hidden="true"
        />

        <header className="connect-success-brand">
          <span className="connect-success-brand-icon">
            <Send size={18} />
          </span>
          <span>
            <small>GAP AutoDM</small>
            <strong>Connection complete</strong>
          </span>
        </header>

        <section className="connect-success-profile">
          <span className="connect-success-avatar">
            {activeInstagramAccount?.profile_picture_url ? (
              <img src={activeInstagramAccount.profile_picture_url} alt={username} />
            ) : (
              <Instagram size={30} />
            )}
          </span>

          <div className="connect-success-copy">
            <div className="connect-success-badges">
              <span className="connect-success-pill">
                <CheckCircle size={15} />
                Connected
              </span>
              <span className="connect-success-type">{accountType}</span>
            </div>
            <h1>Instagram connected</h1>
            <p>
              <strong>@{username}</strong> is ready for AutoDM workflows.
            </p>
          </div>
        </section>

        {loadError ? <p className="connect-success-error">{loadError}</p> : null}

        <section className="connect-success-stats">
          <StatTile
            icon={Users}
            label="Followers"
            value={isLoading ? '-' : numberLabel(activeInstagramAccount?.followers_count)}
            detail="Synced from Meta"
          />
          <StatTile
            icon={Grid3X3}
            label="Posts"
            value={isLoading ? '-' : numberLabel(activeInstagramAccount?.media_count)}
            detail="Published media count"
          />
          <StatTile
            icon={UserPlus}
            label="Following"
            value={isLoading ? '-' : numberLabel(followingValue)}
            detail={followingValue == null ? 'Not available from current sync' : 'Synced from Meta'}
          />
        </section>

        <section className="connect-success-grid">
          <div className="connect-success-panel">
            <h2>Ready now</h2>
            {['AutoDM automations', 'Instagram inbox sync', 'Post based workflows'].map((label) => (
              <span key={label} className="connect-success-ready-item">
                <CheckCircle size={16} />
                {label}
              </span>
            ))}
          </div>

          <div className="connect-success-panel">
            <h2>Connection health</h2>
            <StatusRow icon={ShieldCheck} label="Token" value={tokenLabel} />
            <StatusRow icon={RefreshCw} label="Webhook" value={activeInstagramAccount?.webhook_status || 'Ready'} />
            <StatusRow icon={CalendarClock} label="Last sync" value={isLoading ? 'Checking' : dateLabel(activeInstagramAccount?.updated_at)} />
          </div>
        </section>

        <button
          className="connect-success-cta"
          onClick={() => (loadError ? navigate('/connect', { replace: true }) : navigate('/dashboard/auto-dm'))}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="connect-success-spin" size={16} />
              Loading...
            </>
          ) : loadError ? (
            'Back to Connect'
          ) : (
            'Finish setup'
          )}
        </button>

        <style>{`
          @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
          .connect-success-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--canvas);
            color: var(--ink);
            font-family: var(--font-body);
            padding: 24px;
          }
          .connect-success-card {
            position: relative;
            width: min(760px, 100%);
            border: 1px solid var(--dust);
            border-radius: var(--r-card);
            background: var(--canvas-lifted);
            padding: clamp(22px, 4vw, 34px);
            overflow: hidden;
          }
          .connect-success-card > *:not(.connect-success-art) {
            position: relative;
            z-index: 1;
          }
          .connect-success-art {
            position: absolute;
            top: 34px;
            right: 34px;
            width: 190px;
            opacity: 0.96;
            pointer-events: none;
          }
          .connect-success-brand,
          .connect-success-profile {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .connect-success-brand {
            margin-bottom: 28px;
          }
          .connect-success-brand-icon {
            width: 40px;
            height: 40px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(255,86,0,0.18);
            border-radius: var(--r-btn);
            background: rgba(255,86,0,0.08);
            color: var(--arc);
            flex: 0 0 auto;
          }
          .connect-success-brand small {
            display: block;
            color: var(--slate);
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .connect-success-brand strong {
            display: block;
            margin-top: 4px;
            color: var(--ink);
            font-size: 16px;
            font-weight: 650;
          }
          .connect-success-avatar {
            width: 74px;
            height: 74px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            border: 2px solid rgba(255,86,0,0.42);
            border-radius: 50%;
            background: rgba(255,86,0,0.08);
            color: var(--arc);
            flex: 0 0 auto;
          }
          .connect-success-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .connect-success-copy {
            min-width: 0;
          }
          .connect-success-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 10px;
          }
          .connect-success-pill,
          .connect-success-type {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            min-height: 30px;
            padding: 6px 9px;
            border-radius: var(--r-btn);
            font-size: 12px;
            font-weight: 700;
          }
          .connect-success-pill {
            border: 1px solid rgba(22,163,74,0.22);
            background: rgba(22,163,74,0.07);
            color: #137333;
          }
          .connect-success-type {
            border: 1px solid rgba(20,20,19,0.1);
            color: var(--slate);
          }
          .connect-success-copy h1 {
            margin: 0;
            color: var(--ink);
            font-size: clamp(30px, 5vw, 46px);
            font-weight: 650;
            line-height: 1;
          }
          .connect-success-copy p {
            margin: 10px 0 0;
            color: var(--slate);
            font-size: 15px;
            line-height: 1.55;
          }
          .connect-success-copy p strong {
            color: var(--ink);
          }
          .connect-success-error {
            margin: 18px 0 0;
            color: #b91c1c;
            font-size: 14px;
            font-weight: 650;
          }
          .connect-success-stats {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-top: 28px;
          }
          .connect-success-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(260px, 0.8fr);
            gap: 14px;
            margin-top: 14px;
          }
          .connect-success-panel {
            border: 1px solid var(--dust);
            border-radius: var(--r-card);
            background: #fcfbfa;
            padding: 18px;
          }
          .connect-success-panel h2 {
            margin: 0 0 12px;
            color: var(--ink);
            font-size: 18px;
            font-weight: 650;
          }
          .connect-success-ready-item {
            min-height: 40px;
            display: flex;
            align-items: center;
            gap: 9px;
            padding: 9px 0;
            color: var(--ink);
            font-size: 13px;
            font-weight: 650;
          }
          .connect-success-ready-item svg {
            color: #16a34a;
          }
          .connect-success-cta {
            width: 100%;
            min-height: 46px;
            margin-top: 18px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border: 1px solid var(--ink);
            border-radius: var(--r-btn);
            background: var(--ink);
            color: #fff;
            cursor: pointer;
            font-size: 14px;
            font-weight: 650;
          }
          .connect-success-cta:disabled {
            cursor: default;
            opacity: 0.72;
          }
          .connect-success-spin {
            animation: spin 1s linear infinite;
          }
          @media (max-width: 720px) {
            .connect-success-screen {
              align-items: stretch;
              padding: 12px;
            }
            .connect-success-card {
              padding: 20px;
            }
            .connect-success-art {
              display: none;
            }
            .connect-success-profile {
              align-items: flex-start;
            }
            .connect-success-stats,
            .connect-success-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </main>
    </div>
  );
}
