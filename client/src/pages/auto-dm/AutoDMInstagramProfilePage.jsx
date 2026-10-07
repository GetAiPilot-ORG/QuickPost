import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Camera,
  ExternalLink,
  Film,
  Grid3X3,
  Heart,
  Image as ImageIcon,
  Instagram,
  MessageCircle,
  RefreshCw,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react';
import { useAutoDM } from '../../context/AutoDMContext';
import AutoDMAccountSwitcher from './AutoDMAccountSwitcher';

function compactNumber(value) {
  if (value == null) return '-';
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function fullNumber(value) {
  if (value == null) return '-';
  return new Intl.NumberFormat('en').format(value);
}

function isReel(item) {
  return item.media_type === 'VIDEO' || item.media_type === 'REELS';
}

function StatCard({ icon: Icon, label, value, detail }) {
  return (
    <article className="autodm-analytics-card">
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
        <small>{detail}</small>
      </div>
      <span>
        <Icon size={18} />
      </span>
    </article>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="autodm-mini-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function MediaGrid({ items, loading, emptyLabel, error, onReconnect }) {
  if (loading) {
    return (
      <div className="autodm-media-grid">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="skeleton-shimmer autodm-media-skeleton" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="autodm-empty card">
        <AlertTriangle size={32} style={{ color: '#d93025' }} />
        <h3>Failed to load posts</h3>
        <p>{error}</p>
        <button type="button" className="btn-arc mt-2" onClick={onReconnect}>
          Reconnect Instagram
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="autodm-empty autodm-media-empty">
        <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRXkC8FxQJVxv0Id2hnbcva7i3TdIcc6Hxlzk8R1v8YgM_Te-4rPlU7BxkR&s=10" alt="No Media" className="h-32 object-contain mx-auto mb-4" />
        <p>{emptyLabel}</p>
        <span>Refresh after posting content on Instagram.</span>
      </div>
    );
  }

  return (
    <div className="autodm-media-grid">
      {items.map((item) => (
        <a
          key={item.id}
          className="autodm-media-tile"
          href={item.permalink || '#'}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open Instagram media"
        >
          <img src={item.thumbnail_url || item.media_url} alt={item.caption || 'Instagram media'} />
          {isReel(item) ? <Film className="autodm-media-type" size={16} /> : null}
          {item.media_type === 'CAROUSEL_ALBUM' ? <Grid3X3 className="autodm-media-type" size={16} /> : null}
          <div className="autodm-media-overlay">
            <span>
              <Heart size={14} />
              {fullNumber(item.like_count || 0)}
            </span>
            <span>
              <MessageCircle size={14} />
              {fullNumber(item.comments_count || 0)}
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}

export default function AutoDMInstagramProfilePage() {
  const {
    activeAccount,
    autodmAccounts,
    setActiveAccount,
    hasSocialInstagramConnection,
    importInstagram,
    fetchInstagramMedia,
    startOAuth
  } = useAutoDM();

  const [media, setMedia] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [activeTab, setActiveTab] = useState('posts');

  const username = activeAccount?.username || activeAccount?.instagram_username || '';
  const displayName = activeAccount?.full_name || username;

  const posts = useMemo(() => media.filter((item) => !isReel(item)), [media]);
  const reels = useMemo(() => media.filter((item) => isReel(item)), [media]);
  const totals = useMemo(() => {
    const likes = media.reduce((sum, item) => sum + (item.like_count || 0), 0);
    const comments = media.reduce((sum, item) => sum + (item.comments_count || 0), 0);
    const topPost = [...media].sort(
      (a, b) => (b.like_count || 0) + (b.comments_count || 0) - ((a.like_count || 0) + (a.comments_count || 0))
    )[0];

    return { likes, comments, engagement: likes + comments, topPost };
  }, [media]);

  useEffect(() => {
    if (activeAccount?.id) loadMedia();
  }, [activeAccount?.id]);

  const loadMedia = async () => {
    setMediaLoading(true);
    setMediaError(null);
    try {
      const data = await fetchInstagramMedia(60);
      setMedia(data);
    } catch (error) {
      console.error('[AutoDM] Instagram media load error:', error);
      setMediaError(error.response?.data?.error || error.message || 'Failed to load media');
      setMedia([]);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setImportError(null);
    try {
      await importInstagram();
    } catch (error) {
      setImportError(error.response?.data?.error || error.message || 'Unable to import Instagram account');
    } finally {
      setImporting(false);
    }
  };

  const handleReconnect = async () => {
    try {
      const url = await startOAuth();
      if (url) window.location.href = url;
    } catch (err) {
      console.error('Failed to reconnect:', err);
    }
  };

  if (!activeAccount) {
    return (
      <div className="autodm-page">
        <section className="card-shadow autodm-connect-state">
          <img src="https://img.magnific.com/free-vector/cancel-culture-abstract-concept-vector-illustration-cancel-person-community-social-media-platform-internet-criticism-public-figure-celebrity-group-shaming-boycott-abstract-metaphor_335657-1926.jpg?semt=ais_hybrid&w=740&q=80" alt="No Instagram Account" className="h-40 object-contain mx-auto mb-6" />
          <h1>No Instagram Account</h1>
          <p>
            {hasSocialInstagramConnection
              ? 'Import your Instagram account to see profile, posts, and reels here.'
              : 'Connect Instagram in Social Pilot, then import it here.'}
          </p>
          {importError ? (
            <div className="autodm-inline-error">
              <AlertCircle size={15} />
              {importError}
            </div>
          ) : null}
          {hasSocialInstagramConnection ? (
            <button type="button" className="btn-arc" onClick={handleImport} disabled={importing}>
              {importing ? 'Importing...' : 'Import Instagram Account'}
            </button>
          ) : null}
        </section>
      </div>
    );
  }

  const profileUrl = `https://instagram.com/${username}`;
  const activeMedia = activeTab === 'reels' ? reels : activeTab === 'all' ? media : posts;

  return (
    <div className="autodm-page">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <AutoDMAccountSwitcher />
      </div>
      <section className="card-shadow autodm-profile-hero">
        <div className="autodm-profile-avatar">
          {activeAccount.profile_picture_url ? (
            <img src={activeAccount.profile_picture_url} alt="" />
          ) : (
            <span>{username?.[0]?.toUpperCase() || 'I'}</span>
          )}
        </div>

        <div className="autodm-profile-copy">
          <p className="eyebrow">Instagram Profile</p>
          <div className="autodm-profile-title">
            <h1>@{username}</h1>
            <span className="badge badge-arc">{activeAccount.account_type || 'BUSINESS'}</span>
          </div>
          <p>{displayName}</p>
          <small>Profile data is synced from your connected Instagram professional account.</small>
        </div>

        <div className="autodm-profile-actions">
          <button type="button" className="btn-ghost" onClick={() => window.open(profileUrl, '_blank')}>
            <ExternalLink size={15} />
            Open Instagram
          </button>
          <button type="button" className="btn-arc" onClick={loadMedia} disabled={mediaLoading}>
            <RefreshCw size={15} className={mediaLoading ? 'is-spinning' : ''} />
            Refresh
          </button>
        </div>
      </section>


      <section className="autodm-section">
        <div className="autodm-section-heading">
          <div>
            <p className="eyebrow">Growth Dashboard</p>
            <h2>Professional insights</h2>
          </div>
        </div>

        <div className="autodm-analytics-grid">
          <StatCard icon={TrendingUp} label="Reach" value="-" detail="No Meta insight yet" />
          <StatCard icon={BarChart3} label="Views" value="-" detail="No Meta insight yet" />
          <StatCard icon={Heart} label="Engagement" value={compactNumber(totals.engagement)} detail={`${fullNumber(totals.likes)} likes, ${fullNumber(totals.comments)} comments`} />
          <StatCard icon={Users} label="Followers" value={compactNumber(activeAccount.followers_count)} detail={`${fullNumber(activeAccount.media_count ?? media.length)} synced posts`} />
        </div>

        <div className="autodm-profile-panels">
          <article className="card autodm-profile-panel">
            <header>
              <div>
                <h3>Account overview</h3>
                <p>Profile and content totals</p>
              </div>
              <BarChart3 size={18} />
            </header>
            <div className="autodm-mini-grid">
              <MiniStat label="Posts" value={fullNumber(activeAccount.media_count ?? media.length)} />
              <MiniStat label="Followers" value={compactNumber(activeAccount.followers_count)} />
              <MiniStat label="Following" value="-" />
            </div>
          </article>

          <article className="card autodm-profile-panel">
            <header>
              <div>
                <h3>Top content</h3>
                <p>Based on likes and comments</p>
              </div>
              <MessageCircle size={18} />
            </header>
            {totals.topPost ? (
              <div className="autodm-top-post">
                <img src={totals.topPost.thumbnail_url || totals.topPost.media_url} alt={totals.topPost.caption || 'Top Instagram media'} />
                <div>
                  <strong>{totals.topPost.caption || 'Recent Instagram post'}</strong>
                  <p>
                    {fullNumber(totals.topPost.like_count || 0)} likes · {fullNumber(totals.topPost.comments_count || 0)} comments
                  </p>
                </div>
              </div>
            ) : (
              <p className="autodm-muted">No top post available yet.</p>
            )}
          </article>
        </div>
      </section>

      <section className="card autodm-media-card">
        <div className="autodm-media-tabs" role="tablist" aria-label="Instagram media">
          {[
            { id: 'posts', label: 'Posts', icon: Grid3X3 },
            { id: 'reels', label: 'Reels', icon: Film },
            { id: 'all', label: 'All', icon: Camera },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={activeTab === id ? 'is-active' : ''}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <MediaGrid
          items={activeMedia}
          loading={mediaLoading}
          emptyLabel={activeTab === 'reels' ? 'No reels found' : activeTab === 'all' ? 'No media found' : 'No posts found'}
          error={mediaError}
          onReconnect={handleReconnect}
        />
      </section>
    </div>
  );
}
