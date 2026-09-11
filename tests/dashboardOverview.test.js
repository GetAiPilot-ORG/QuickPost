import { describe, expect, it } from 'vitest';

process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY ||= 'test-key';
process.env.TOKEN_ENCRYPTION_KEY_BASE64 ||= Buffer.alloc(32).toString('base64');

const {
  normalizeDashboardRange,
  sumInsightValues,
  summarizeBroadcasts,
  summarizeConnectedAccounts,
} = await import('../server/src/services/dashboardOverview.js');

describe('dashboard overview aggregation', () => {
  it('falls back to the 30 day range for unsupported values', () => {
    expect(normalizeDashboardRange('7')).toBe(7);
    expect(normalizeDashboardRange('999')).toBe(30);
    expect(normalizeDashboardRange(undefined)).toBe(30);
  });

  it('summarizes mixed broadcast states without invalid dates', () => {
    const now = new Date('2026-07-17T12:00:00.000Z');
    const summary = summarizeBroadcasts(
      [
        { id: 'sent-1', status: 'sent', caption: 'Published', posted_at: '2026-07-17T08:00:00.000Z', selected_channels: ['instagram:one'] },
        { id: 'failed-1', status: 'failed', caption: 'Failed', created_at: '2026-07-16T08:00:00.000Z', selected_channels: ['youtube'] },
        { id: 'scheduled-1', status: 'scheduled', caption: 'Next', scheduled_for: '2026-07-18T08:00:00.000Z', selected_channels: ['instagram:one'] },
        { id: 'old-1', status: 'sent', caption: 'Old', posted_at: '2026-06-01T08:00:00.000Z', selected_channels: ['x'] },
      ],
      7,
      now,
    );

    expect(summary.operations).toMatchObject({
      totalPosts: 2,
      sent: 1,
      failed: 1,
      scheduled: 1,
      queueCount: 1,
      successRate: 50,
    });
    expect(summary.operations.nextScheduled).toMatchObject({ id: 'scheduled-1', scheduledFor: '2026-07-18T08:00:00.000Z' });
    expect(summary.operations.recentActivity.map((post) => post.id)).toEqual(['sent-1', 'failed-1', 'old-1']);
    expect(summary.publishingTrend).toHaveLength(7);
  });

  it('handles empty broadcasts and connected account health', () => {
    const summary = summarizeBroadcasts([], 30, new Date('2026-07-17T12:00:00.000Z'));
    const accounts = summarizeConnectedAccounts({
      instagramAccounts: [{ id: 'one', username: 'brand', connected: true, token_expiry: '2026-07-01T00:00:00.000Z' }],
      youtube: { connected: true, username: 'channel', token_expiry: '2026-08-01T00:00:00.000Z' },
    });

    expect(summary.operations.successRate).toBeNull();
    expect(summary.operations.nextScheduled).toBeNull();
    expect(accounts.totalConnected).toBe(2);
    expect(accounts.needsReconnect).toHaveLength(1);
  });

  it('does not report missing Meta insight rows as zero', () => {
    expect(sumInsightValues([])).toBeNull();
    expect(sumInsightValues([{ value: undefined }])).toBeNull();
    expect(sumInsightValues([{ value: 0 }, { value: '3' }])).toBe(3);
  });
});
