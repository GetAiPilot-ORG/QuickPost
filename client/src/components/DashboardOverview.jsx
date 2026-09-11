import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Layers,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import apiClient from "../utils/apiClient";
import ComposerModal from "./ComposerModal";

const ranges = [7, 30, 90];

const emptyOverview = {
  operations: {
    totalPosts: 0,
    sent: 0,
    scheduled: 0,
    failed: 0,
    processing: 0,
    successRate: null,
    queueCount: 0,
    totalPostsDelta: 0,
    nextScheduled: null,
    recentActivity: [],
  },
  publishingTrend: [],
  accounts: { totalConnected: 0, needsReconnect: [], accounts: [] },
  instagramGrowth: { accounts: [], summary: {} },
  automation: { instapilot: null, autodm: {} },
};

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Unavailable";
  return new Intl.NumberFormat(undefined, { notation: Math.abs(value) >= 10000 ? "compact" : "standard" }).format(value);
}

function formatDelta(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Baseline collecting";
  if (value === 0) return "No change yet";
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function formatDateTime(value) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRefreshTime(value) {
  return value ? formatDateTime(value) : "Just now";
}

function shortCaption(value) {
  const text = String(value || "Untitled post").trim();
  return text.length > 86 ? `${text.slice(0, 83)}...` : text;
}

function cleanInsightReason(value) {
  const text = String(value || "").trim();
  if (!text) return "Meta did not return this insight for the selected account.";
  if (text.length > 150 || text.toLowerCase().includes("must be one of the following values")) {
    return "Meta did not return this insight for the selected account.";
  }
  return text;
}

function channelLabel(channels = []) {
  if (!channels.length) return "No channel data";
  const base = [...new Set(channels.map((channel) => String(channel).split(":")[0]))];
  return base.slice(0, 3).join(", ") + (base.length > 3 ? ` +${base.length - 3}` : "");
}

function statusTone(status) {
  if (status === "failed") return "danger";
  if (["scheduled", "queued", "processing"].includes(status)) return "warning";
  if (["sent", "partially_sent"].includes(status)) return "success";
  return "neutral";
}

function getNextAction(data) {
  const ops = data.operations || emptyOverview.operations;
  if (data.accounts?.totalConnected === 0) {
    return {
      title: "Connect a publishing channel",
      detail: "Link Instagram or another platform before your next broadcast.",
      action: "Connect channels",
      href: "/connect",
      icon: Layers,
      tone: "warning",
    };
  }
  if (ops.failed > 0) {
    return {
      title: `${ops.failed} post${ops.failed === 1 ? "" : "s"} need attention`,
      detail: "Review failed broadcasts before adding more queue pressure.",
      action: "Open history",
      href: "/dashboard/history",
      icon: AlertTriangle,
      tone: "danger",
    };
  }
  if (ops.nextScheduled) {
    return {
      title: shortCaption(ops.nextScheduled.caption),
      detail: `Next scheduled for ${formatDateTime(ops.nextScheduled.scheduledFor)}`,
      action: "Open queue",
      href: "/dashboard/queue",
      icon: CalendarClock,
      tone: "success",
    };
  }
  return {
    title: "Your queue is clear",
    detail: "Create or schedule the next post when you are ready.",
    action: "New post",
    href: null,
    icon: Send,
    tone: "neutral",
  };
}

function MetricCard({ icon: Icon, label, value, detail, tone = "neutral" }) {
  return (
    <article className={`dash-card dash-metric is-${tone}`}>
      <div className="dash-card-head">
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function SkeletonDashboard() {
  return (
    <div className="dash-shell" aria-busy="true" aria-label="Loading dashboard">
      <div className="dash-loading-row">
        <div className="dash-skeleton title" />
        <div className="dash-skeleton controls" />
      </div>
      <div className="dash-grid">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className={`dash-card dash-skeleton-card ${index === 0 ? "wide" : ""}`} key={index}>
            <div className="dash-skeleton line" />
            <div className="dash-skeleton number" />
            <div className="dash-skeleton line short" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const shellRef = useRef(null);
  const [range, setRange] = useState(30);
  const [instagramAccountId, setInstagramAccountId] = useState("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [data, setData] = useState(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoveredSegment, setHoveredSegment] = useState(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get("/api/dashboard/overview", {
        params: { range, instagramAccountId },
      });
      setData({ ...emptyOverview, ...(response.data || {}) });
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [range, instagramAccountId]);

  useEffect(() => {
    if (loading || !shellRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = gsap.context(() => {
      gsap.fromTo(
        ".dash-animate",
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.42, ease: "power3.out", stagger: 0.045 },
      );
      gsap.fromTo(
        ".dash-donut-slice",
        { strokeDasharray: "0 251.2" },
        {
          strokeDasharray: (i, target) => target.getAttribute("data-dasharray"),
          duration: 0.85,
          ease: "power3.out",
          stagger: 0.12,
          delay: 0.1,
        }
      );
    }, shellRef);

    return () => context.revert();
  }, [loading, range, instagramAccountId, data.generatedAt]);

  const firstName = user?.name?.split(" ")?.[0] || "there";
  const ops = data.operations || emptyOverview.operations;
  const growth = data.instagramGrowth || emptyOverview.instagramGrowth;
  const automation = data.automation || emptyOverview.automation;
  const nextAction = getNextAction(data);
  const NextActionIcon = nextAction.icon;
  const maxTrend = Math.max(1, ...((data.publishingTrend || []).map((day) => day.sent + day.scheduled + day.failed)));
  const trendData = data.publishingTrend || [];
  const totalSent = useMemo(() => trendData.reduce((acc, curr) => acc + (curr.sent || 0), 0), [trendData]);
  const totalScheduled = useMemo(() => trendData.reduce((acc, curr) => acc + (curr.scheduled || 0), 0), [trendData]);
  const totalFailed = useMemo(() => trendData.reduce((acc, curr) => acc + (curr.failed || 0), 0), [trendData]);
  const totalPostsCount = totalSent + totalScheduled + totalFailed;
  const selectedGrowthAccount = useMemo(() => {
    if (instagramAccountId === "all") return null;
    return (growth.accounts || []).find((account) => account.id === instagramAccountId) || null;
  }, [growth.accounts, instagramAccountId]);
  const topMedia = useMemo(() => {
    const media = selectedGrowthAccount?.topMedia || (growth.accounts || []).flatMap((account) => account.topMedia || []);
    return [...media].sort((a, b) => (b.engagement || 0) - (a.engagement || 0)).slice(0, 3);
  }, [growth.accounts, selectedGrowthAccount]);
  const growthSummary = selectedGrowthAccount || growth.summary || {};
  const issues = [
    ...(data.accounts?.needsReconnect || []).map((account) => ({
      title: `${account.provider} needs reconnect`,
      detail: account.username ? `@${account.username}` : "Token is expired or unavailable.",
      href: "/connect",
    })),
    ...((growth.accounts || [])
      .filter((account) => account.unavailableReason)
      .map((account) => ({
        title: account.username ? `@${account.username} insights unavailable` : "Instagram insights unavailable",
        detail: cleanInsightReason(account.unavailableReason),
        href: "/dashboard/auto-dm/instagram-profile",
      }))),
  ].slice(0, 5);

  if (loading && !data.generatedAt) {
    return (
      <>
        <DashboardStyles />
        <SkeletonDashboard />
      </>
    );
  }

  return (
    <div className="dash-shell" ref={shellRef}>
      <DashboardStyles />

      <header className="dash-top dash-animate">
        <div>
          <p className="dash-kicker">Workspace overview</p>
          <h1>Good to see you, {firstName}</h1>
          <span>Publishing, growth, queue health, and account risk in one place.</span>
          <div className="dash-snapshot" aria-label="Workspace snapshot">
            <span><strong>{formatNumber(ops.totalPosts)}</strong> posts in {range} days</span>
            <span><strong>{formatNumber(ops.queueCount)}</strong> queued</span>
            <span><strong>{formatRefreshTime(data.generatedAt)}</strong> last refresh</span>
          </div>
        </div>
        <div className="dash-actions">
          <div className="dash-range" aria-label="Dashboard range">
            {ranges.map((option) => (
              <button
                type="button"
                key={option}
                className={range === option ? "active" : ""}
                onClick={() => setRange(option)}
              >
                {option}d
              </button>
            ))}
          </div>
          <button type="button" className="dash-btn secondary" onClick={() => navigate("/connect")}>
            <Layers size={16} />
            Channels
          </button>
          <button type="button" className="dash-btn primary" onClick={() => setComposerOpen(true)}>
            <Plus size={16} />
            New Post
          </button>
        </div>
      </header>

      {error ? (
        <section className="dash-error">
          <AlertTriangle size={18} />
          <div>
            <strong>Dashboard could not refresh</strong>
            <p>{error}</p>
          </div>
          <button type="button" className="dash-btn secondary" onClick={fetchOverview}>
            <RefreshCw size={15} />
            Retry
          </button>
        </section>
      ) : null}

      <section className="dash-grid primary-grid dash-animate">
        <article className={`dash-card dash-next is-${nextAction.tone}`}>
          <div className="dash-card-head">
            <span>Next action</span>
            <NextActionIcon size={18} />
          </div>
          <h2>{nextAction.title}</h2>
          <p>{nextAction.detail}</p>
          <button
            type="button"
            className="dash-link-btn"
            onClick={() => (nextAction.href ? navigate(nextAction.href) : setComposerOpen(true))}
          >
            {nextAction.action}
            <ArrowRight size={15} />
          </button>
        </article>

        <MetricCard
          icon={CheckCircle2}
          label="Publish success"
          value={ops.successRate === null ? "No baseline" : `${ops.successRate}%`}
          detail={`${formatNumber(ops.sent)} sent, ${formatNumber(ops.failed)} failed in ${range} days`}
          tone={ops.failed > 0 ? "danger" : "success"}
        />
        <MetricCard
          icon={Clock3}
          label="Queue health"
          value={formatNumber(ops.queueCount)}
          detail={`${formatNumber(ops.processing)} processing, ${formatNumber(ops.scheduled)} waiting`}
          tone={ops.queueCount > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          icon={Users}
          label="Connected accounts"
          value={formatNumber(data.accounts?.totalConnected || 0)}
          detail={(data.accounts?.needsReconnect || []).length ? "Reconnect needed" : "All visible accounts healthy"}
          tone={(data.accounts?.needsReconnect || []).length ? "danger" : "neutral"}
        />
      </section>

      <section className="dash-grid growth-grid dash-animate">
        <article className="dash-card dash-growth">
          <div className="dash-section-title -mb-4">
            <div>
              <span>Instagram growth</span>
              <h2>Account momentum</h2>
            </div>
            <select
              value={instagramAccountId}
              onChange={(event) => setInstagramAccountId(event.target.value)}
              aria-label="Instagram account"
            >
              <option value="all">All Instagram accounts</option>
              {(growth.accounts || []).map((account) => (
                <option value={account.id} key={account.id}>
                  @{account.username || account.instagramBusinessId || "instagram"}
                </option>
              ))}
            </select>
          </div>

          <div className="dash-growth-stats">
            <MetricInline label="Followers" value={formatNumber(growthSummary.followers)} detail={formatDelta(growthSummary.followerDelta)} />
            <MetricInline label="Reach" value={formatNumber(growthSummary.reach)} detail={`Last ${range} days`} />
            <MetricInline
              label="Profile views"
              value={formatNumber(growthSummary.profileViews)}
              detail={growthSummary.profileViews == null ? "Not returned by Meta" : "From Meta insights"}
            />
          </div>

          {growthSummary.unavailableReason ? (
            <div className="dash-note">
              <AlertTriangle size={15} />
              <span>{cleanInsightReason(growthSummary.unavailableReason)}</span>
            </div>
          ) : null}
        </article>

        <article className="dash-card dash-automation">
          <div className="dash-card-head">
            <span>Automation lift</span>
            <ShieldCheck size={17} />
          </div>
          <div className="dash-mini-grid">
            <MetricInline label="DMs sent" value={formatNumber(automation.autodm?.messagesSent || 0)} detail="AutoDM" />
            <MetricInline label="Leads" value={formatNumber(automation.instapilot?.leadsCaptured || 0)} detail="InstaPilot" />
            <MetricInline label="Followers gained" value={formatNumber(automation.autodm?.followersGained || 0)} detail="AutoDM tracked" />
          </div>
        </article>
      </section>

      <section className="dash-grid ops-grid dash-animate">
        <article className="dash-card dash-trend">
          <div className="dash-section-title">
            <div>
              <span>Publishing cadence</span>
              <h2>{formatNumber(ops.totalPosts)} posts in {range} days</h2>
            </div>
            <p>{formatDelta(ops.totalPostsDelta)} vs previous period</p>
          </div>
          <div className="dash-chart-donut-container" aria-label="Publishing trend">
            {totalPostsCount === 0 ? (
              <div className="dash-chart-donut-visual">
                <svg width="140" height="140" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f2eee8" strokeWidth="12" />
                </svg>
                <div className="dash-donut-center">
                  <strong>0</strong>
                  <span>posts</span>
                </div>
              </div>
            ) : (
              <div className="dash-chart-donut-visual">
                <svg width="140" height="140" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                  {totalSent > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="var(--ink, #111111)"
                      strokeWidth={hoveredSegment === "sent" ? "15" : "12"}
                      strokeDasharray="0 251.2"
                      data-dasharray={`${(totalSent / totalPostsCount) * 251.2} 251.2`}
                      strokeDashoffset="0"
                      className="dash-donut-slice sent"
                      onMouseEnter={() => setHoveredSegment("sent")}
                      onMouseLeave={() => setHoveredSegment(null)}
                      style={{ transformOrigin: "50px 50px", transition: "stroke-width 200ms ease, opacity 200ms ease" }}
                    />
                  )}
                  {totalScheduled > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#d97706"
                      strokeWidth={hoveredSegment === "scheduled" ? "15" : "12"}
                      strokeDasharray="0 251.2"
                      data-dasharray={`${(totalScheduled / totalPostsCount) * 251.2} 251.2`}
                      strokeDashoffset={`-${(totalSent / totalPostsCount) * 251.2}`}
                      className="dash-donut-slice scheduled"
                      onMouseEnter={() => setHoveredSegment("scheduled")}
                      onMouseLeave={() => setHoveredSegment(null)}
                      style={{ transformOrigin: "50px 50px", transition: "stroke-width 200ms ease, opacity 200ms ease" }}
                    />
                  )}
                  {totalFailed > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#ef4444"
                      strokeWidth={hoveredSegment === "failed" ? "15" : "12"}
                      strokeDasharray="0 251.2"
                      data-dasharray={`${(totalFailed / totalPostsCount) * 251.2} 251.2`}
                      strokeDashoffset={`-${((totalSent + totalScheduled) / totalPostsCount) * 251.2}`}
                      className="dash-donut-slice failed"
                      onMouseEnter={() => setHoveredSegment("failed")}
                      onMouseLeave={() => setHoveredSegment(null)}
                      style={{ transformOrigin: "50px 50px", transition: "stroke-width 200ms ease, opacity 200ms ease" }}
                    />
                  )}
                </svg>
                <div className="dash-donut-center">
                  <strong>{totalPostsCount}</strong>
                  <span>posts</span>
                </div>
              </div>
            )}

            <div className="dash-chart-donut-details">
              <div
                className="dash-donut-row"
                onMouseEnter={() => setHoveredSegment("sent")}
                onMouseLeave={() => setHoveredSegment(null)}
              >
                <div className="dash-donut-label">
                  <span className="dot sent" />
                  <span>Sent</span>
                </div>
                <div className="dash-donut-stats">
                  <strong>{totalSent}</strong>
                  <span>({totalPostsCount ? Math.round((totalSent / totalPostsCount) * 100) : 0}%)</span>
                </div>
              </div>
              <div
                className="dash-donut-row"
                onMouseEnter={() => setHoveredSegment("scheduled")}
                onMouseLeave={() => setHoveredSegment(null)}
              >
                <div className="dash-donut-label">
                  <span className="dot scheduled" />
                  <span>Scheduled</span>
                </div>
                <div className="dash-donut-stats">
                  <strong>{totalScheduled}</strong>
                  <span>({totalPostsCount ? Math.round((totalScheduled / totalPostsCount) * 100) : 0}%)</span>
                </div>
              </div>
              <div
                className="dash-donut-row"
                onMouseEnter={() => setHoveredSegment("failed")}
                onMouseLeave={() => setHoveredSegment(null)}
              >
                <div className="dash-donut-label">
                  <span className="dot failed" />
                  <span>Failed</span>
                </div>
                <div className="dash-donut-stats">
                  <strong style={{ color: totalFailed > 0 ? "#ef4444" : "inherit" }}>{totalFailed}</strong>
                  <span>({totalPostsCount ? Math.round((totalFailed / totalPostsCount) * 100) : 0}%)</span>
                </div>
              </div>
            </div>
          </div>

          <div className={`dash-donut-hover-info ${hoveredSegment ? `is-${hoveredSegment}` : ""}`}>
            {hoveredSegment === "sent" && (
              <div className="hover-detail-content sent animate-fade-in">
                <div className="hover-detail-head">
                  <span className="dot sent" />
                  <strong>Sent successfully</strong>
                </div>
                <p>{totalSent} posts were successfully broadcast to your connected channels during this period.</p>
              </div>
            )}
            {hoveredSegment === "scheduled" && (
              <div className="hover-detail-content scheduled animate-fade-in">
                <div className="hover-detail-head">
                  <span className="dot scheduled" />
                  <strong>Scheduled queue</strong>
                </div>
                <p>{totalScheduled} posts are currently queued and waiting to be published automatically.</p>
              </div>
            )}
            {hoveredSegment === "failed" && (
              <div className="hover-detail-content failed animate-fade-in">
                <div className="hover-detail-head">
                  <span className="dot failed" />
                  <strong>Failed delivery</strong>
                </div>
                <p>{totalFailed} posts encountered errors. Check your publishing history to review logs.</p>
              </div>
            )}
            {!hoveredSegment && (
              <div className="hover-detail-content default animate-fade-in">
                <div className="hover-detail-head">
                  <span className="dot info" />
                  <strong>Publishing overview</strong>
                </div>
                <p>Hover over any chart segment to view breakdown details and delivery health advice.</p>
              </div>
            )}
          </div>
        </article>

        <article className="dash-card dash-feed">
          <div className="dash-section-title">
            <div>
              <span>Recent broadcasts</span>
              <h2>What shipped lately</h2>
            </div>
            <button type="button" className="dash-small-link" onClick={() => navigate("/dashboard/history")}>
              History
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="dash-list">
            {(ops.recentActivity || []).length ? (
              ops.recentActivity.slice(0, 6).map((post) => (
                <button type="button" className="dash-row" key={post.id} onClick={() => navigate("/dashboard/history")}>
                  <span className={`dash-status ${statusTone(post.status)}`} />
                  <div>
                    <strong>{shortCaption(post.caption)}</strong>
                    <p>{channelLabel(post.channels)} / {formatDateTime(post.postedAt || post.scheduledFor || post.createdAt)}</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="dash-empty">
                <Send size={18} />
                <p>No broadcast history in this range.</p>
              </div>
            )}
          </div>
        </article>

        <article className="dash-card dash-issues">
          <div className="dash-section-title">
            <div>
              <span>Account risk</span>
              <h2>{issues.length ? `${issues.length} item${issues.length === 1 ? "" : "s"} to review` : "No visible blockers"}</h2>
            </div>
            <AlertTriangle size={17} />
          </div>
          <div className="dash-list compact">
            {issues.length ? (
              issues.map((issue, index) => (
                <button type="button" className="dash-row" key={`${issue.title}-${index}`} onClick={() => navigate(issue.href)}>
                  <span className="dash-status danger" />
                  <div>
                    <strong>{issue.title}</strong>
                    <p>{issue.detail}</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="dash-empty">
                <ShieldCheck size={18} />
                <p>Connected accounts look ready from the data available.</p>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="dash-grid media-grid dash-animate">
        <article className="dash-card dash-top-content">
          <div className="dash-section-title">
            <div>
              <span>Top Instagram content</span>
              <h2>Best recent engagement</h2>
            </div>
            <BarChart3 size={17} />
          </div>
          <div className="dash-media-list">
            {topMedia.length ? (
              topMedia.map((item) => (
                <a className="dash-media-row" href={item.permalink || "#"} target="_blank" rel="noreferrer" key={item.id}>
                  <div className="dash-thumb">
                    {item.mediaUrl ? <img src={item.mediaUrl} alt={item.caption || "Instagram media"} /> : <TrendingUp size={18} />}
                  </div>
                  <div>
                    <strong>{shortCaption(item.caption)}</strong>
                    <p>{formatNumber(item.likes)} likes / {formatNumber(item.comments)} comments</p>
                  </div>
                </a>
              ))
            ) : (
              <div className="dash-empty">
                <BarChart3 size={18} />
                <p>Top content will appear when Meta returns media engagement.</p>
              </div>
            )}
          </div>
        </article>
      </section>

      <ComposerModal
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPostCreated={fetchOverview}
      />
    </div>
  );
}

function MetricInline({ label, value, detail }) {
  return (
    <div className="dash-inline-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
  );
}

function DashboardStyles() {
  return (
    <style>{`
      .dash-shell {
        min-height: 100%;
        padding: 32px;
        background: var(--canvas, #f5f1ec);
        color: var(--ink, #111111);
        font-family: var(--font-body, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif);
      }

      .dash-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        max-width: 1200px;
        margin: 0 auto 18px;
        padding: 20px;
        border: 1px solid rgba(20, 20, 19, 0.08);
        border-radius: 14px;
        background: #ffffff;
      }

      .dash-kicker,
      .dash-section-title span,
      .dash-card-head span {
        display: block;
        margin: 0 0 6px;
        color: var(--slate, #626260);
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.01em;
        text-transform: none;
      }

      .dash-top h1 {
        margin: 0;
        color: var(--ink, #111111);
        font-size: 30px;
        font-weight: 600;
        line-height: 1.1;
        letter-spacing: -0.025em;
        text-wrap: balance;
      }

      .dash-top span,
      .dash-card p,
      .dash-section-title p,
      .dash-row p,
      .dash-inline-metric p {
        color: var(--slate, #626260);
      }

      .dash-top > div:first-child > span {
        display: block;
        margin-top: 8px;
        font-size: 15px;
      }

      .dash-snapshot {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 16px;
      }

      .dash-snapshot span {
        display: inline-flex;
        min-height: 30px;
        align-items: center;
        gap: 5px;
        padding: 6px 10px;
        border: 1px solid rgba(20, 20, 19, 0.08);
        border-radius: 999px;
        background: #f7f5f2;
        color: var(--slate, #626260);
        font-size: 12px;
        font-weight: 600;
      }

      .dash-snapshot strong {
        color: var(--ink, #111111);
      }

      .dash-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .dash-range {
        display: inline-flex;
        gap: 4px;
        padding: 4px;
        border: 1px solid var(--dust, #d3cec6);
        border-radius: 8px;
        background: rgba(0,0,0,0.03);
      }

      .dash-range button,
      .dash-btn,
      .dash-link-btn,
      .dash-small-link {
        min-height: 36px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 150ms ease, border-color 150ms ease, color 150ms ease, transform 150ms ease;
      }

      .dash-range button {
        min-width: 48px;
        border: 0;
        background: transparent;
        color: var(--slate, #626260);
      }

      .dash-range button.active {
        background: var(--surface-1, #ffffff);
        color: var(--ink, #111111);
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        font-weight: 600;
      }

      .dash-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: 1px solid var(--dust, #d3cec6);
        padding: 0 16px;
        background: var(--surface-1, #ffffff);
        color: var(--ink, #111111);
      }

      .dash-btn.primary {
        border-color: var(--ink, #111111);
        background: var(--ink, #111111);
        color: #ffffff;
      }

      .dash-btn:hover {
        border-color: var(--ink, #111111);
        background: #f7f5f2;
      }
      .dash-btn.primary:hover {
        background: #2b2b2b;
      }

      .dash-grid {
        max-width: 1200px;
        margin: 0 auto 16px;
        display: grid;
        gap: 14px;
        align-items: start;
      }

      .primary-grid {
        grid-template-columns: 1.25fr 1fr 1fr 1fr;
        align-items: stretch;
      }

      .primary-grid .dash-card {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 16px 16px 14px;
      }

      .primary-grid .dash-metric strong {
        margin-top: 6px;
      }

      .growth-grid {
        grid-template-columns: 1.45fr 1fr;
      }

      .ops-grid {
        grid-template-columns: 1.2fr 1fr 1fr;
        align-items: stretch;
      }

      .ops-grid .dash-card {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .ops-grid .dash-card .dash-list,
      .ops-grid .dash-card .dash-empty {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
      }

      .media-grid {
        grid-template-columns: 1fr;
      }

      .dash-card,
      .dash-error {
        border: 1px solid var(--dust, #d3cec6);
        border-radius: 12px;
        background: var(--surface-1, #ffffff);
      }

      .dash-card {
        position: relative;
        padding: 20px;
        min-width: 0;
        transition: border-color 160ms ease, transform 160ms ease, background 160ms ease;
      }

      .dash-card:hover {
        border-color: rgba(20, 20, 19, 0.28);
        transform: translateY(-1px);
      }

      .dash-card-head,
      .dash-section-title {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }

      .dash-card-head svg,
      .dash-section-title svg {
        width: 30px;
        height: 30px;
        padding: 7px;
        border: 1px solid rgba(20, 20, 19, 0.08);
        border-radius: 8px;
        background: #f7f5f2;
        color: var(--slate, #626260);
        flex-shrink: 0;
      }

      .dash-next h2,
      .dash-section-title h2 {
        margin: 0;
        color: var(--ink, #111111);
        font-size: 17px;
        font-weight: 600;
        line-height: 1.2;
        letter-spacing: -0.01em;
      }

      .dash-next p {
        margin: 4px 0 8px;
        max-width: 58ch;
        font-size: 13px;
        line-height: 1.35;
      }

      .dash-next .dash-link-btn {
        margin-top: auto;
        align-self: flex-start;
      }

      .dash-link-btn,
      .dash-small-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 0;
        background: transparent;
        color: var(--ink, #111111);
        font-weight: 600;
        padding: 0;
      }
      .dash-link-btn:hover,
      .dash-small-link:hover {
        color: #3b82f6;
      }

      .dash-metric {
        display: block;
      }

      .dash-metric strong {
        display: block;
        margin-top: 10px;
        color: var(--ink, #111111);
        font-size: 30px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: -0.03em;
      }

      .dash-metric p {
        margin: 6px 0 0;
        font-size: 13px;
        line-height: 1.4;
      }

      .dash-card.is-danger .dash-card-head svg, .dash-metric.is-danger .dash-card-head svg {
        border-color: rgba(220, 38, 38, 0.16);
        background: #fff1ee;
        color: #dc2626;
      }
      .dash-card.is-warning .dash-card-head svg, .dash-metric.is-warning .dash-card-head svg {
        border-color: rgba(217, 119, 6, 0.2);
        background: #fff7ed;
        color: #d97706;
      }
      .dash-card.is-success .dash-card-head svg, .dash-metric.is-success .dash-card-head svg {
        border-color: rgba(5, 150, 105, 0.18);
        background: #ecfdf5;
        color: #059669;
      }

      .dash-growth-stats,
      .dash-mini-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-top: 20px;
      }

      .dash-inline-metric {
        min-width: 0;
        border: 1px solid var(--dust, #d3cec6);
        border-radius: 8px;
        background: #faf8f5;
        padding: 14px;
      }

      .dash-inline-metric span {
        display: block;
        color: var(--slate, #626260);
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 6px;
      }

      .dash-inline-metric strong {
        display: block;
        overflow-wrap: anywhere;
        color: var(--ink, #111111);
        font-size: 20px;
        font-weight: 600;
        line-height: 1.1;
        letter-spacing: -0.02em;
      }

      .dash-inline-metric p {
        margin: 4px 0 0;
        font-size: 12px;
        line-height: 1.35;
      }

      .dash-section-title select {
        min-height: 36px;
        max-width: 260px;
        border: 1px solid var(--dust, #d3cec6);
        border-radius: 6px;
        background: var(--surface-1, #ffffff);
        color: var(--ink, #111111);
        padding: 0 12px;
        font-size: 13px;
        font-weight: 500;
      }

      .dash-note {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-top: 16px;
        padding: 12px;
        border: 1px solid #fef08a;
        border-radius: 8px;
        background: #fef9c3;
        color: #854d0e;
        font-size: 13px;
        line-height: 1.4;
      }

      .dash-chart-donut-container {
        display: flex;
        align-items: center;
        gap: 24px;
        min-height: 150px;
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid var(--dust, #d3cec6);
        width: 100%;
      }

      .dash-chart-donut-visual {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 140px;
        height: 140px;
        flex-shrink: 0;
      }

      .dash-donut-slice {
        transition: stroke-width 200ms ease, opacity 200ms ease;
        cursor: pointer;
      }

      .dash-donut-slice:hover {
        stroke-width: 15;
        opacity: 0.9;
      }

      .dash-donut-center {
        position: absolute;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        pointer-events: none;
      }

      .dash-donut-center strong {
        font-size: 22px;
        font-weight: 700;
        color: var(--ink, #111111);
        line-height: 1.1;
        letter-spacing: -0.02em;
      }

      .dash-donut-center span {
        font-size: 11px;
        color: var(--slate, #626260);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 600;
        margin-top: 2px;
      }

      .dash-chart-donut-details {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex-grow: 1;
      }

      .dash-donut-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 8px;
        margin: 0 -8px;
        border-radius: 6px;
        transition: background 150ms ease;
        cursor: pointer;
      }

      .dash-donut-row:hover {
        background: rgba(20, 20, 19, 0.04);
      }

      .dash-donut-hover-info {
        margin-top: 16px;
        min-height: 74px;
        border: 1px solid rgba(20, 20, 19, 0.08);
        border-radius: 8px;
        background: #faf8f5;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        transition: background 200ms ease, border-color 200ms ease;
      }

      .dash-donut-hover-info.is-sent {
        background: rgba(17, 17, 17, 0.02);
        border-color: rgba(17, 17, 17, 0.12);
      }

      .dash-donut-hover-info.is-scheduled {
        background: rgba(217, 119, 6, 0.02);
        border-color: rgba(217, 119, 6, 0.15);
      }

      .dash-donut-hover-info.is-failed {
        background: rgba(239, 68, 68, 0.02);
        border-color: rgba(239, 68, 68, 0.15);
      }

      .hover-detail-content {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .hover-detail-head {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .hover-detail-head strong {
        font-size: 13px;
        font-weight: 600;
        color: var(--ink, #111111);
      }

      .hover-detail-content p {
        margin: 0;
        font-size: 12px;
        line-height: 1.4;
        color: var(--slate, #626260);
      }

      .hover-detail-head .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }

      .hover-detail-head .dot.sent { background: var(--ink, #111111); }
      .hover-detail-head .dot.scheduled { background: #d97706; }
      .hover-detail-head .dot.failed { background: #ef4444; }
      .hover-detail-head .dot.info { background: #3b82f6; }

      @keyframes slide-up-fade {
        from {
          opacity: 0;
          transform: translateY(3px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .animate-fade-in {
        animation: slide-up-fade 200ms ease forwards;
      }

      .dash-donut-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 500;
        color: var(--slate, #626260);
      }

      .dash-donut-label .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      .dash-donut-label .dot.sent { background: var(--ink, #111111); }
      .dash-donut-label .dot.scheduled { background: #d97706; }
      .dash-donut-label .dot.failed { background: #ef4444; }

      .dash-donut-stats {
        display: flex;
        align-items: baseline;
        gap: 4px;
        font-size: 13px;
      }

      .dash-donut-stats strong {
        font-weight: 600;
        color: var(--ink, #111111);
      }

      .dash-donut-stats span {
        color: var(--slate, #626260);
        font-size: 11px;
      }

      .dash-list,
      .dash-media-list {
        display: flex;
        flex-direction: column;
        margin-top: 16px;
      }

      .dash-feed .dash-list {
        max-height: 286px;
        overflow-y: auto;
        padding-right: 2px;
      }

      .dash-feed .dash-row {
        padding: 8px 8px;
        gap: 10px;
      }

      .dash-feed .dash-row p {
        margin-top: 2px;
      }

      .dash-row,
      .dash-media-row {
        width: 100%;
        min-width: 0;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 12px;
        align-items: center;
        border: 0;
        border-bottom: 1px solid var(--dust, #d3cec6);
        background: transparent;
        color: var(--ink, #111111);
        padding: 11px 8px;
        text-align: left;
        text-decoration: none;
        cursor: pointer;
        transition: background 150ms ease;
      }
      .dash-row:last-child,
      .dash-media-row:last-child {
        border-bottom: 0;
      }

      .dash-row:hover,
      .dash-media-row:hover {
        background: #faf8f5;
        border-radius: 8px;
      }

      .dash-row strong,
      .dash-media-row strong {
        display: block;
        overflow: hidden;
        color: var(--ink, #111111);
        font-size: 13px;
        font-weight: 600;
        line-height: 1.25;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .dash-row p,
      .dash-media-row p {
        margin: 4px 0 0;
        overflow: hidden;
        font-size: 12px;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .dash-status {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #cbd5e1;
      }

      .dash-status.success { background: #10b981; }
      .dash-status.warning { background: #f59e0b; }
      .dash-status.danger { background: #ef4444; }

      .dash-thumb {
        width: 56px;
        height: 56px;
        border: 1px solid var(--dust, #d3cec6);
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.02);
        color: var(--slate, #626260);
      }

      .dash-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .dash-empty {
        min-height: 94px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: 1px dashed var(--dust, #d3cec6);
        border-radius: 8px;
        background: rgba(0,0,0,0.01);
        color: var(--slate, #626260);
        text-align: center;
        padding: 16px;
      }

      .dash-empty p {
        margin: 0;
        font-size: 13px;
      }

      .dash-error {
        max-width: 1200px;
        margin: 0 auto 16px;
        padding: 14px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-color: #fca5a5;
        background: #fef2f2;
      }

      .dash-error strong {
        display: block;
        color: var(--ink, #111111);
        font-size: 14px;
      }

      .dash-error p {
        margin: 2px 0 0;
        color: var(--slate, #626260);
        font-size: 13px;
      }

      .dash-loading-row {
        max-width: 1200px;
        margin: 0 auto 22px;
        display: flex;
        justify-content: space-between;
        gap: 16px;
      }

      .dash-skeleton,
      .dash-skeleton-card {
        background: linear-gradient(90deg, rgba(17,17,17,0.03) 25%, rgba(17,17,17,0.06) 37%, rgba(17,17,17,0.03) 63%);
        background-size: 400% 100%;
        animation: dash-shimmer 1.4s ease-in-out infinite;
      }

      .dash-skeleton.title { width: 360px; height: 66px; border-radius: 8px; }
      .dash-skeleton.controls { width: 320px; height: 44px; border-radius: 8px; }
      .dash-skeleton-card { min-height: 180px; }
      .dash-skeleton-card.wide { min-height: 240px; }
      .dash-skeleton.line { width: 72%; height: 14px; border-radius: 6px; margin-bottom: 26px; }
      .dash-skeleton.line.short { width: 48%; margin-top: 18px; margin-bottom: 0; }
      .dash-skeleton.number { width: 42%; height: 42px; border-radius: 8px; }

      @keyframes dash-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }

      @media (prefers-reduced-motion: reduce) {
        .dash-btn,
        .dash-range button,
        .dash-link-btn,
        .dash-small-link,
        .dash-card,
        .dash-row,
        .dash-media-row,
        .dash-bar-wrap span {
          transition: none;
        }
        .dash-skeleton,
        .dash-skeleton-card {
          animation: none;
        }
      }

      @media (max-width: 1180px) {
        .primary-grid,
        .growth-grid,
        .ops-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .dash-next,
        .dash-growth,
        .dash-trend {
          grid-column: span 2;
        }
      }

      @media (max-width: 768px) {
        .dash-shell {
          padding: 24px 16px 40px;
        }
        .dash-top,
        .dash-loading-row {
          align-items: stretch;
          flex-direction: column;
        }
        .dash-top {
          padding: 18px;
        }
        .dash-actions,
        .dash-range,
        .dash-btn {
          width: 100%;
        }
        .dash-range button,
        .dash-btn {
          flex: 1;
        }
        .dash-top h1 {
          font-size: 28px;
        }
        .primary-grid,
        .growth-grid,
        .ops-grid,
        .media-grid {
          grid-template-columns: 1fr;
        }
        .dash-next,
        .dash-growth,
        .dash-trend {
          grid-column: span 1;
        }
        .dash-growth-stats,
        .dash-mini-grid {
          grid-template-columns: 1fr;
        }
        .dash-section-title {
          flex-direction: column;
          align-items: stretch;
        }
        .dash-section-title select {
          max-width: none;
          width: 100%;
        }
        .dash-error {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `}</style>
  );
}
