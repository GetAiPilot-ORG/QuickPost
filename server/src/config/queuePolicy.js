export function findFullScheduledChannel(requestedChannels, broadcasts, perChannelLimit) {
  const counts = Object.fromEntries(requestedChannels.map((channel) => [channel, 0]));
  for (const broadcast of broadcasts) {
    for (const channel of broadcast.selected_channels || []) {
      if (Object.prototype.hasOwnProperty.call(counts, channel)) counts[channel] += 1;
    }
  }
  return requestedChannels.find((channel) => counts[channel] >= perChannelLimit);
}

export function pendingBroadcastChannels(broadcast) {
  const channels = broadcast?.platform_data?.selectedChannels || broadcast?.selected_channels || [];
  const completed = broadcast?.platform_data?.completedChannels;
  if (Array.isArray(completed)) {
    const completedSet = new Set(completed.map(String));
    return channels.filter((channel) => !completedSet.has(String(channel)));
  }

  return channels.filter((channel) => {
    const provider = String(channel).split(':')[0];
    return broadcast?.[`${provider}_success`] !== true;
  });
}
