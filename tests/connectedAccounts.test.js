import { describe, expect, it } from 'vitest';
import { countConnectedTargets } from '../client/src/utils/connectedAccounts.js';

describe('countConnectedTargets', () => {
  it('counts account arrays without double-counting platform summaries', () => {
    expect(countConnectedTargets({
      instagram: { connected: true },
      instagramAccounts: [{ id: 'ig-1' }, { id: 'ig-2' }],
      youtube: { connected: true },
      youtubeAccounts: [{ id: 'yt-1' }, { id: 'yt-2' }, { id: 'yt-3' }],
      threads: { connected: true },
      threadsAccounts: [{ id: 'th-1' }, { id: 'th-2' }],
      bluesky: { connected: true },
      blueskyAccounts: [{ id: 'bs-1' }],
    })).toBe(8);
  });
});
