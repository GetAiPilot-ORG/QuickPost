import { describe, expect, it } from 'vitest';
import { pendingBroadcastChannels } from '../server/src/config/queuePolicy.js';

describe('broadcast retry channel selection', () => {
  it('retries only channels that did not complete', () => {
    expect(pendingBroadcastChannels({
      platform_data: {
        selectedChannels: ['instagram:ig-1', 'youtube:yt-1'],
        completedChannels: ['youtube:yt-1'],
      },
    })).toEqual(['instagram:ig-1']);
  });

  it('uses legacy provider success flags when no channel checkpoint exists', () => {
    expect(pendingBroadcastChannels({
      selected_channels: ['instagram:ig-1', 'youtube:yt-1'],
      instagram_success: false,
      youtube_success: true,
      platform_data: {},
    })).toEqual(['instagram:ig-1']);
  });

  it('returns no work when every exact channel completed', () => {
    expect(pendingBroadcastChannels({
      platform_data: {
        selectedChannels: ['instagram:ig-1', 'youtube:yt-1'],
        completedChannels: ['instagram:ig-1', 'youtube:yt-1'],
      },
    })).toEqual([]);
  });
});
