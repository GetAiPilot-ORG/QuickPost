export function sortSchedules(posts, order = 'latest') {
  const time = (post) => {
    const value = post.scheduled_for ? Date.parse(post.scheduled_for) : NaN;
    return Number.isFinite(value) ? value : null;
  };
  return [...posts].sort((a, b) => {
    const left = time(a);
    const right = time(b);
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return order === 'oldest' ? left - right : right - left;
  });
}
