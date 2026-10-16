import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  AlertCircleIcon,
  Analytics01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Comment01Icon,
  Copy01Icon,
  Delete02Icon,
  Edit02Icon,
  ExternalLinkIcon,
  InstagramIcon,
  Loading03Icon,
  MoreHorizontalIcon,
  RefreshIcon,
  SentIcon,
  Shield01Icon,
  UserAdd01Icon,
  UserCheck01Icon,
  UserGroupIcon,
  UserRemove01Icon,
} from '@hugeicons/core-free-icons';
import { useAutoDM } from '../../context/AutoDMContext';
import AutoDMAccountSwitcher from './AutoDMAccountSwitcher';
import InfoHelp from '../../components/InfoHelp';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
  'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
  'linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%)',
  'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
  'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
];

function getAvatarStyle(identifier) {
  if (!identifier) return { background: AVATAR_GRADIENTS[0] };
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return { background: AVATAR_GRADIENTS[index] };
}

function getAvatarInitial(comment) {
  const name = comment.username || comment.senderId || '';
  const cleaned = name.replace(/^[_.\-\s]+/, '');
  const char = (cleaned || name || '?').charAt(0).toUpperCase();
  return char || '?';
}

function formatRelativeTime(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function formatCommentTime(value) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function triggerLabel(value) {
  return {
    comment_on_post: 'Comments on Post',
    comment_on_reel: 'Comments on Reel',
    dm_received: 'DM Received',
    live_comment: 'Live Comment',
    story_reply: 'Story Reply',
    story_mention: 'Story Mention',
  }[value] || value || 'Automation';
}

function statValue(automation, keys) {
  for (const key of keys) {
    const value = automation?.[key] ?? automation?.analytics?.[key];
    if (value != null) return Number(value) || 0;
  }
  return 0;
}

function AutomationThumb({ automation, isPostDeleted }) {
  const [imgError, setImgError] = useState(false);
  const src = automation.media_thumbnail || automation.media_url || automation.post_thumbnail || automation.thumbnail_url;
  return (
    <div className={`autodm-list-thumb ${isPostDeleted ? 'border-dashed border-gray-300' : ''}`}>
      {src && !imgError ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={isPostDeleted ? 'opacity-50 grayscale' : ''}
        />
      ) : (
        <HugeiconsIcon icon={Comment01Icon} size={18} strokeWidth={1.8} className={isPostDeleted ? 'text-gray-400' : ''} />
      )}
    </div>
  );
}

function ActionMenu({ automation, onEdit, onData, onDuplicate, onDelete }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="autodm-row-actions">
      <button type="button" className="btn-ghost" onClick={onData}>
        <HugeiconsIcon icon={Analytics01Icon} size={14} strokeWidth={1.8} />
        Data
      </button>
      <button type="button" className="autodm-icon-action" onClick={onEdit} aria-label="Edit automation">
        <HugeiconsIcon icon={Edit02Icon} size={16} strokeWidth={1.8} />
      </button>
      <div className="autodm-menu-anchor">
        <button
          type="button"
          className="autodm-icon-action"
          onClick={() => setOpen((value) => !value)}
          aria-label="Automation actions"
          aria-expanded={open}
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} size={18} strokeWidth={1.8} />
        </button>
        {open ? (
          <div className="autodm-menu-popover">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDuplicate();
              }}
            >
              <HugeiconsIcon icon={Copy01Icon} size={14} strokeWidth={1.8} />
              Duplicate
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.8} />
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AnalyticsModal({ automation, analytics, loading, commentRows, commentsLoading, commentsError, onClose, onSync, onEdit }) {
  const comments = analytics?.comments ?? statValue(automation, ['comments', 'comments_count', 'total_comments']);
  const sent =
    analytics?.dmsSent ??
    analytics?.messagesSent ??
    analytics?.dms_sent ??
    statValue(automation, ['dms_sent', 'messages_sent', 'total_messages_sent']);
  const people =
    analytics?.uniqueContacts ??
    analytics?.people ??
    analytics?.unique_people ??
    statValue(automation, ['people', 'contacts_count', 'unique_contacts']);
  const lastUsed = analytics?.lastUsedAt || automation.last_used_at || automation.updated_at || automation.created_at;
  const recentErrors = Array.isArray(analytics?.recentErrors) ? analytics.recentErrors : [];
  const hasIssues = recentErrors.length > 0 || (analytics?.failed || 0) > 0;
  const rawComments = Array.isArray(commentRows) ? commentRows : [];
  const activeAccountUsername = (automation?.account_username || '').toLowerCase().replace(/^@/, '').trim();
  const visibleComments = rawComments.filter((comment) => {
    const username = (comment.username || '').toLowerCase().replace(/^@/, '').trim();
    if (activeAccountUsername && username === activeAccountUsername) return false;
    if (comment.text && (comment.text.includes('Sent it to your DM') || comment.text.includes('Tap SETUP to continue'))) {
      return false;
    }
    return true;
  });

  return (
    <div className="modal-overlay autodm-analytics-overlay" onClick={onClose}>
      <div className="modal-content autodm-analytics-modal" onClick={(event) => event.stopPropagation()}>
        <header className="autodm-analytics-header">
          <AutomationThumb automation={automation} />
          <div className="autodm-analytics-title">
            <div>
              <h2>Automation Analytics</h2>
              <span className={`badge ${automation.is_active ? 'badge-success' : 'badge-slate'}`}>
                {automation.is_active ? 'Active' : 'Paused'}
              </span>
            </div>
            <p>
              <strong>{automation.name || 'Untitled Automation'}</strong>
              {' · '}
              {triggerLabel(automation.trigger_type)}
            </p>
          </div>
          <button type="button" className="autodm-modal-close" onClick={onClose} aria-label="Close analytics">
            <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.8} />
          </button>
        </header>

        <div className="autodm-analytics-body custom-scrollbar">
          {loading ? (
            <div className="autodm-empty">
              <HugeiconsIcon icon={Loading03Icon} className="is-spinning" size={30} strokeWidth={1.8} />
              <p>Loading analytics</p>
            </div>
          ) : (
            <>
              <div className="autodm-analytics-grid">
                <article className="autodm-analytics-card">
                  <div>
                    <strong>{comments}</strong>
                    <p>Comments</p>
                    <small>Matched events</small>
                  </div>
                  <span><HugeiconsIcon icon={Comment01Icon} size={18} strokeWidth={1.8} /></span>
                </article>
                <article className="autodm-analytics-card">
                  <div>
                    <strong>{sent}</strong>
                    <p>DMs Sent</p>
                    <small>Delivered messages</small>
                  </div>
                  <span><HugeiconsIcon icon={SentIcon} size={18} strokeWidth={1.8} /></span>
                </article>
                <article className="autodm-analytics-card">
                  <div>
                    <strong>{people}</strong>
                    <p>People</p>
                    <small>Unique reached</small>
                  </div>
                  <span><HugeiconsIcon icon={UserGroupIcon} size={18} strokeWidth={1.8} /></span>
                </article>
                <article className="autodm-analytics-card">
                  <div>
                    <strong>{formatRelativeTime(lastUsed)}</strong>
                    <p>Last Used</p>
                    <small>Latest activity</small>
                  </div>
                  <span><HugeiconsIcon icon={Clock01Icon} size={18} strokeWidth={1.8} /></span>
                </article>
              </div>

              <div className="autodm-analytics-split">
                <section className="autodm-panel">
                  <div className="autodm-panel-head">
                    <div className="autodm-panel-title-group">
                      <div className="autodm-icon-badge autodm-icon-badge-purple">
                        <HugeiconsIcon icon={Analytics01Icon} size={16} strokeWidth={1.8} />
                      </div>
                      <div>
                        <h3>Delivery Health</h3>
                        <p>Message delivery and follow-up session status.</p>
                      </div>
                    </div>
                    <span className={`autodm-health ${hasIssues ? 'warn' : ''}`}>
                      {hasIssues ? 'Needs attention' : 'Healthy'}
                    </span>
                  </div>
                  <div className="autodm-metrics-row">
                    <div className="autodm-metric-line">
                      <span><HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} strokeWidth={1.8} /></span>
                      <p>Successful</p>
                      <strong>{sent}</strong>
                    </div>
                    <div className="autodm-metric-line">
                      <span><HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={1.8} /></span>
                      <p>Send Failed</p>
                      <strong>{analytics?.failed || 0}</strong>
                    </div>
                    <div className="autodm-metric-line">
                      <span><HugeiconsIcon icon={Clock01Icon} size={16} strokeWidth={1.8} /></span>
                      <p>Awaiting Reply</p>
                      <strong>{analytics?.awaiting_reply || 0}</strong>
                    </div>
                  </div>
                  <div className="autodm-progress">
                    <span style={{ width: `${sent > 0 ? 100 : 0}%` }} />
                  </div>
                  <h3 className="autodm-section-title">Issues</h3>
                  {recentErrors.length > 0 ? (
                    <div className="autodm-issue-list">
                      {recentErrors.map((errorText, index) => (
                        <p key={`${errorText}-${index}`}>{errorText}</p>
                      ))}
                    </div>
                  ) : (
                    <div className="autodm-good-box">No recent processing errors found for this automation.</div>
                  )}

                  <div className="autodm-follow-gate-section">
                    <div className="autodm-panel-head" style={{ marginBottom: 0 }}>
                      <div className="autodm-panel-title-group">
                        <div className="autodm-icon-badge autodm-icon-badge-emerald">
                          <HugeiconsIcon icon={Shield01Icon} size={16} strokeWidth={1.8} />
                        </div>
                        <div>
                          <h3 className="inline-flex items-center gap-1.5">
                            Follow Gate Stats
                            <InfoHelp text="Follower conversion metrics for comments triggering this automation rule" />
                          </h3>
                          <p>Follower interactions for this automation.</p>
                        </div>
                      </div>
                    </div>
                    <div className="autodm-follow-gate-grid">
                      <div className="autodm-gate-card">
                        <div className="autodm-gate-card-icon icon-emerald">
                          <HugeiconsIcon icon={UserCheck01Icon} size={16} strokeWidth={1.8} />
                        </div>
                        <div className="autodm-gate-card-content">
                          <span className="autodm-gate-val">{analytics?.followersCommented || 0}</span>
                          <span className="autodm-gate-label">Followers Commented</span>
                        </div>
                      </div>
                      <div className="autodm-gate-card">
                        <div className="autodm-gate-card-icon icon-amber">
                          <HugeiconsIcon icon={UserRemove01Icon} size={16} strokeWidth={1.8} />
                        </div>
                        <div className="autodm-gate-card-content">
                          <span className="autodm-gate-val">{analytics?.followGateBlockedCount || 0}</span>
                          <span className="autodm-gate-label">Non-Followers Blocked</span>
                        </div>
                      </div>
                      <div className="autodm-gate-card">
                        <div className="autodm-gate-card-icon icon-indigo">
                          <HugeiconsIcon icon={UserAdd01Icon} size={16} strokeWidth={1.8} />
                        </div>
                        <div className="autodm-gate-card-content">
                          <span className="autodm-gate-val">
                            {analytics?.followerGrowth > 0 ? '+' + analytics.followerGrowth : (analytics?.followerGrowth || 0)}
                          </span>
                          <span className="autodm-gate-label">New Followers</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="autodm-panel">
                  <div className="autodm-panel-head">
                    <div className="autodm-panel-title-group">
                      <div className="autodm-icon-badge autodm-icon-badge-ig">
                        <HugeiconsIcon icon={InstagramIcon} size={16} strokeWidth={1.8} />
                      </div>
                      <div>
                        <h3>Post Snapshot</h3>
                        <p>Caption, link, and synced post metrics.</p>
                      </div>
                    </div>
                    {automation.media_permalink ? (
                      <button 
                        type="button" 
                        className="btn-ghost" 
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        onClick={() => window.open(automation.media_permalink, '_blank', 'noopener,noreferrer')}
                      >
                        <ExternalLink size={13} />
                        View
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        className="btn-ghost" 
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        onClick={() => navigator.clipboard?.writeText(automation.media_id || '')}
                      >
                        <Copy size={13} />
                        Copy
                      </button>
                    )}
                  </div>

                  <div className="autodm-post-card-container">
                    {automation.media_thumbnail || automation.media_url ? (
                      <div className="autodm-post-card-preview">
                        <div className="autodm-post-media-wrap">
                          <img src={automation.media_thumbnail || automation.media_url} alt="Post media" referrerPolicy="no-referrer" />
                          <span className="autodm-media-type-badge">{triggerLabel(automation.trigger_type)}</span>
                        </div>
                        <div className="autodm-post-media-meta">
                          <div className="autodm-media-id-tag">
                            <span>Media ID: </span><code>{automation.media_id || automation.post_id || 'Synced'}</code>
                          </div>
                          <p className="autodm-post-caption-preview">
                            {automation.media_caption || 'No caption fetched yet. Click Sync Meta Data to fetch latest post details.'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="autodm-post-mock-card">
                        <div className="autodm-mock-header">
                          <div className="autodm-mock-avatar">
                            <HugeiconsIcon icon={InstagramIcon} size={15} strokeWidth={1.8} />
                          </div>
                          <div className="autodm-mock-meta">
                            <strong>{automation.name || 'Instagram Post'}</strong>
                            <span>{triggerLabel(automation.trigger_type)}</span>
                          </div>
                          <span className="autodm-synced-badge">
                            {automation.media_id ? 'Synced' : 'Pending Sync'}
                          </span>
                        </div>
                        <div className="autodm-mock-gradient-banner">
                          <div className="autodm-mock-banner-content">
                            <HugeiconsIcon icon={InstagramIcon} size={26} strokeWidth={1.8} />
                            <p>Target Instagram Media</p>
                            <span className="autodm-mock-id">
                              {automation.media_id ? `ID: ${automation.media_id}` : 'Click Sync Meta Data to fetch live post graphic'}
                            </span>
                          </div>
                        </div>
                        <div className="autodm-mock-caption">
                          <span className="autodm-caption-label">CAPTION</span>
                          <p>{automation.media_caption || 'No caption synced yet. Use Sync Meta Data button to fetch caption & thumbnail.'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <section className="autodm-panel autodm-comments-panel">
                <div className="autodm-panel-head">
                  <div className="autodm-panel-title-group">
                    <div className="autodm-icon-badge autodm-icon-badge-ig">
                      <HugeiconsIcon icon={Comment01Icon} size={16} strokeWidth={1.8} />
                    </div>
                    <div>
                      <h3>Post Comments</h3>
                      <p>Latest Instagram comment events received for this automation.</p>
                    </div>
                  </div>
                  <span className="badge badge-indigo">{visibleComments.length} received</span>
                </div>

                {commentsLoading ? (
                  <div className="autodm-empty compact">
                    <HugeiconsIcon icon={Loading03Icon} className="is-spinning" size={24} strokeWidth={1.8} />
                    <p>Loading comments</p>
                  </div>
                ) : commentsError ? (
                  <div className="autodm-issue-list">
                    <p>{commentsError}</p>
                  </div>
                ) : visibleComments.length === 0 ? (
                  <div className="autodm-good-box">
                    No comment events found yet. Add a test comment on the selected Instagram post, then reopen Data.
                  </div>
                ) : (
                  <div className="autodm-comment-list">
                    {visibleComments.map((comment) => {
                      const initial = getAvatarInitial(comment);
                      const avatarStyle = getAvatarStyle(comment.username || comment.senderId);
                      const username = comment.username ? `@${comment.username}` : `IG user ${comment.senderId || ''}`;
                      const isProcessed = Boolean(comment.processed);
                      const hasError = Boolean(comment.processingError);

                      return (
                        <article key={comment.id || comment.eventId || Math.random()} className="autodm-comment-card">
                          <div className="autodm-comment-header">
                            <div className="autodm-comment-user-info">
                              <div className="autodm-avatar-wrapper" style={avatarStyle}>
                                <span>{initial}</span>
                                <span className="autodm-avatar-ig-badge">
                                  <HugeiconsIcon icon={InstagramIcon} size={9} strokeWidth={1.8} />
                                </span>
                              </div>
                              <div className="autodm-user-details">
                                <div className="autodm-user-title-row">
                                  <strong className="autodm-username">{username}</strong>
                                  <span className="autodm-time-pill">
                                    <HugeiconsIcon icon={Clock01Icon} size={11} strokeWidth={1.8} />
                                    {formatCommentTime(comment.createdAt)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="autodm-comment-badges">
                              {isProcessed ? (
                                <span className="autodm-status-tag status-success">
                                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} strokeWidth={1.8} />
                                  <span>Processed</span>
                                </span>
                              ) : (
                                <span className="autodm-status-tag status-pending">
                                  <HugeiconsIcon icon={Clock01Icon} size={12} strokeWidth={1.8} />
                                  <span>Pending</span>
                                </span>
                              )}
                              {hasError && (
                                <span className="autodm-status-tag status-error">
                                  <HugeiconsIcon icon={AlertCircleIcon} size={12} strokeWidth={1.8} />
                                  <span>{comment.processingError.replace(/_/g, ' ')}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="autodm-comment-body">
                            <div className="autodm-speech-bubble">
                              <p>{comment.text || 'Comment text unavailable'}</p>
                            </div>
                          </div>

                          <div className="autodm-comment-footer">
                            <div className="autodm-footer-meta">
                              {comment.mediaId && (
                                <span className="autodm-meta-pill">
                                  <HugeiconsIcon icon={ExternalLinkIcon} size={11} strokeWidth={1.8} />
                                  Media #{comment.mediaId}
                                </span>
                              )}
                              {isProcessed && (
                                <span className="autodm-meta-pill highlight">
                                  <HugeiconsIcon icon={SentIcon} size={11} strokeWidth={1.8} />
                                  Auto-DM Delivered
                                </span>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <footer className="autodm-analytics-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
          <button type="button" className="btn-ghost" onClick={onSync}>
            <HugeiconsIcon icon={RefreshIcon} size={14} strokeWidth={1.8} />
            Sync Meta Data
          </button>
          <button type="button" className="btn-arc" onClick={onEdit}>Edit Automation</button>
        </footer>
      </div>
    </div>
  );
}

const liveMediaCache = new Map();

export default function AutoDMAutomationsPage() {
  const navigate = useNavigate();
  const {
    activeAccount,
    automations,
    setAutomations,
    automationsLoading,
    loadAutomations,
    updateAutomation,
    deleteAutomation,
    createAutomation,
    fetchAnalytics,
    fetchAutomationComments,
    fetchInstagramMedia,
    syncInsights,
  } = useAutoDM();
  const [openMenuId, setOpenMenuId] = useState(null);
  const [selectedAutomation, setSelectedAutomation] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [liveMediaIds, setLiveMediaIds] = useState(() => {
    return activeAccount?.id ? liveMediaCache.get(activeAccount.id) ?? null : null;
  });
  const [mediaCheckCompleted, setMediaCheckCompleted] = useState(() => {
    return Boolean(activeAccount?.id && liveMediaCache.has(activeAccount.id));
  });

  useEffect(() => {
    let mounted = true;
    const accountId = activeAccount?.id;
    if (!accountId) return;

    if (liveMediaCache.has(accountId)) {
      setLiveMediaIds(liveMediaCache.get(accountId));
      setMediaCheckCompleted(true);
    }

    if (automations && automations.length > 0 && automations.some((a) => a.media_id)) {
      fetchInstagramMedia(60)
        .then((mediaList) => {
          if (!mounted) return;
          const idSet = new Set((mediaList || []).map((m) => String(m.id)));
          liveMediaCache.set(accountId, idSet);
          setLiveMediaIds(idSet);
          setMediaCheckCompleted(true);
        })
        .catch((err) => {
          console.warn('[AutoDM] Failed to verify post presence:', err);
        });
    } else if (automations && automations.length > 0) {
      setMediaCheckCompleted(true);
    }
    return () => {
      mounted = false;
    };
  }, [activeAccount?.id, automations, fetchInstagramMedia]);

  useEffect(() => {
    loadAutomations();
  }, [activeAccount?.id, loadAutomations]);

  const rows = useMemo(() => automations || [], [automations]);

  const openAnalytics = async (automation) => {
    setSelectedAutomation(automation);
    setAnalytics(null);
    setComments([]);
    setCommentsError('');
    setAnalyticsLoading(true);
    setCommentsLoading(true);
    try {
      const [analyticsResult, commentsResult] = await Promise.allSettled([
        fetchAnalytics(automation.id),
        fetchAutomationComments(automation.id),
      ]);

      if (analyticsResult.status === 'fulfilled') {
        setAnalytics(analyticsResult.value || {});
      } else {
        console.error('[AutoDM] Analytics load error:', analyticsResult.reason);
        setAnalytics({});
      }

      if (commentsResult.status === 'fulfilled') {
        setComments(commentsResult.value || []);
      } else {
        console.error('[AutoDM] Comments load error:', commentsResult.reason);
        const error = commentsResult.reason;
        if (error?.response?.status === 404) {
          setComments([]);
          setCommentsError('');
        } else {
          setCommentsError(error.response?.data?.error || error.message || 'Failed to load comments');
        }
      }
    } catch (error) {
      console.error('[AutoDM] Automation data load error:', error);
    } finally {
      setAnalyticsLoading(false);
      setCommentsLoading(false);
    }
  };

    const toggleActive = async (automation) => {
    const hasSpecificPost = Boolean(automation.media_id);
    const isPostDeleted =
      hasSpecificPost &&
      mediaCheckCompleted &&
      liveMediaIds !== null &&
      !liveMediaIds.has(String(automation.media_id));

    if (isPostDeleted && !automation.is_active) {
      toast.error('This post was deleted on Instagram. Please edit to select another post or delete this automation.');
      return;
    }

    // Optimistic UI update for instant toggle
    setAutomations(prev => prev.map(a => 
      a.id === automation.id ? { ...a, is_active: !a.is_active } : a
    ));

    try {
      await updateAutomation(automation.id, { is_active: !automation.is_active });
    } catch (error) {
      console.error('[AutoDM] Toggle automation error:', error);
      // Revert on failure
      setAutomations(prev => prev.map(a => 
        a.id === automation.id ? { ...a, is_active: automation.is_active } : a
      ));
    }
  };

  const duplicateAutomation = async (automation) => {
    try {
      const clone = {
        ...automation,
        id: undefined,
        name: `${automation.name || 'Untitled Automation'} Copy`,
        is_active: false,
      };
      delete clone.created_at;
      delete clone.updated_at;
      await createAutomation(clone);
      await loadAutomations();
    } catch (error) {
      console.error('[AutoDM] Duplicate automation error:', error);
    }
  };

  const removeAutomation = async (automation) => {
    const ok = window.confirm(`Delete "${automation.name || 'Untitled Automation'}"?`);
    if (!ok) return;
    try {
      await deleteAutomation(automation.id);
      await loadAutomations();
    } catch (error) {
      console.error('[AutoDM] Delete automation error:', error);
    }
  };
  const syncSelected = async () => {
    if (!selectedAutomation) return;
    setAnalyticsLoading(true);
    setCommentsLoading(true);
    try {
      await syncInsights(selectedAutomation.id);
      const [analyticsRes, commentsRes] = await Promise.allSettled([
        fetchAnalytics(selectedAutomation.id),
        fetchAutomationComments(selectedAutomation.id),
      ]);
      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value || {});
      }
      if (commentsRes.status === 'fulfilled') {
        setComments(commentsRes.value || []);
      }
      setCommentsError('');
      await loadAutomations();
    } catch (error) {
      console.error('[AutoDM] Sync insights error:', error);
    } finally {
      setAnalyticsLoading(false);
      setCommentsLoading(false);
    }
  };

  return (
    <div className="autodm-page">
      <header className="autodm-list-header">
        <div>
          <h1>Automations</h1>
          <p>Create and manage your Instagram automations</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <AutoDMAccountSwitcher />
          <button type="button" className="autodm-create-btn" onClick={() => navigate('/dashboard/auto-dm/automations/new')}>
            <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.8} />
            Create
          </button>
        </div>
      </header>

      <section className="card-shadow autodm-automation-table">
        <div className="autodm-automation-head">
          <span>Automation</span>
          <span>Status</span>
          <span>Activity</span>
          <span>Updated</span>
          <span>Actions</span>
        </div>

        {automationsLoading ? (
          <div className="autodm-loading-list">
            {[1, 2, 3].map((item) => <div key={item} className="skeleton-shimmer" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="autodm-empty">
            <img src="https://static.vecteezy.com/system/resources/previews/014/337/128/non_2x/error-in-process-icon-with-gear-vector.jpg" className="h-40 object-contain mx-auto mb-4" alt="No Automations" />
            <p>No automations yet</p>
            <span>Create your first Instagram automation to start sending DMs.</span>
          </div>
        ) : (
          rows.map((automation) => {
            const comments = statValue(automation, ['comments', 'comments_count', 'total_comments']);
            const sent = statValue(automation, ['dms_sent', 'messages_sent', 'total_messages_sent']);
            const hasSpecificPost = Boolean(automation.media_id);
            const isPostDeleted =
              hasSpecificPost &&
              mediaCheckCompleted &&
              liveMediaIds !== null &&
              !liveMediaIds.has(String(automation.media_id));

            return (
              <article key={automation.id} className="autodm-automation-row">
                <div className="autodm-automation-main">
                  <AutomationThumb automation={automation} isPostDeleted={isPostDeleted} />
                  <div>
                    <strong title={automation.name || 'Untitled Automation'}>
                      {automation.name || 'Untitled Automation'}
                    </strong>
                    {isPostDeleted ? (
                      <small className="autodm-deleted-note" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', color: '#e11d48', marginTop: '4px' }}>
                        <HugeiconsIcon icon={AlertCircleIcon} size={12} strokeWidth={1.8} style={{ flexShrink: 0 }} />
                        <span>Post deleted on Instagram</span>
                      </small>
                    ) : (
                      <small>Created {formatRelativeTime(automation.created_at)}</small>
                    )}
                  </div>
                </div>

                <div className="autodm-status-stack">
                  {isPostDeleted ? (
                    <>
                      <span className="badge badge-error bg-rose-50 text-rose-700 border border-rose-200 font-medium inline-flex items-center gap-1">
                        <HugeiconsIcon icon={AlertCircleIcon} size={12} strokeWidth={1.8} className="shrink-0" /> Post Deleted
                      </span>
                      <small className="text-gray-500 font-medium">Inactive on IG</small>
                    </>
                  ) : (
                    <>
                      <span className={`badge ${automation.is_active ? 'badge-success' : 'badge-slate'}`}>
                        {automation.is_active ? 'Active' : 'Paused'}
                      </span>
                      <span className="badge badge-slate">Manual</span>
                      <small>Runs until paused</small>
                    </>
                  )}
                </div>

                <div className="autodm-activity-chips">
                  <span><HugeiconsIcon icon={Comment01Icon} size={14} strokeWidth={1.8} /> {comments}</span>
                  <span><HugeiconsIcon icon={SentIcon} size={14} strokeWidth={1.8} /> {sent}</span>
                </div>

                <time className="autodm-muted">{formatRelativeTime(automation.updated_at || automation.created_at)}</time>

                <div className="autodm-actions-cell">
                  <button
                    type="button"
                    disabled={isPostDeleted}
                    className={`autodm-switch ${automation.is_active ? 'is-on' : ''} ${isPostDeleted ? 'opacity-40 cursor-not-allowed' : ''}`}
                    onClick={() => toggleActive(automation)}
                    aria-label={automation.is_active ? 'Pause automation' : 'Activate automation'}
                    title={isPostDeleted ? 'Post deleted on Instagram' : undefined}
                  >
                    <span />
                  </button>
                  <ActionMenu
                    automation={automation}
                    open={openMenuId === automation.id}
                    onEdit={() => navigate(`/dashboard/auto-dm/automations/${automation.id}`)}
                    onData={() => openAnalytics(automation)}
                    onDuplicate={() => duplicateAutomation(automation)}
                    onDelete={() => removeAutomation(automation)}
                    onToggle={() => setOpenMenuId(openMenuId === automation.id ? null : automation.id)}
                  />
                </div>
              </article>
            );
          })
        )}

        {rows.length > 0 ? (
          <footer className="autodm-list-footer">
            <span>Showing {rows.length} automation{rows.length === 1 ? '' : 's'}</span>
            <strong>1-{rows.length} of {rows.length}</strong>
          </footer>
        ) : null}
      </section>

      {selectedAutomation ? (
        <AnalyticsModal
          automation={selectedAutomation}
          analytics={analytics}
          loading={analyticsLoading}
          commentRows={comments}
          commentsLoading={commentsLoading}
          commentsError={commentsError}
          onClose={() => {
            setSelectedAutomation(null);
            setAnalytics(null);
            setComments([]);
            setCommentsError('');
          }}
          onSync={syncSelected}
          onEdit={() => navigate(`/dashboard/auto-dm/automations/${selectedAutomation.id}`)}
        />
      ) : null}
    </div>
  );
}
