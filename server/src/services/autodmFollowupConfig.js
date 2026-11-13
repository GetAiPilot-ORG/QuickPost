function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

export function normalizeFollowupConfig(value) {
  if (value == null) return { enabled: false, delay_hours: 3, message: '', buttons: [] };
  if (typeof value !== 'object' || Array.isArray(value) || typeof value.enabled !== 'boolean') {
    invalid('Follow-up must include an enabled boolean.');
  }
  const message = typeof value.message === 'string' ? value.message.trim() : '';
  if (value.enabled && (!message || Buffer.byteLength(message, 'utf8') > 900)) {
    invalid('Follow-up message must contain text and be at most 900 UTF-8 bytes.');
  }
  const rawButtons = value.buttons ?? [];
  if (!Array.isArray(rawButtons) || rawButtons.length > 3) invalid('Add up to 3 follow-up buttons.');
  if (!value.enabled) return { enabled: false, delay_hours: 3, message, buttons: rawButtons.map((button) => ({ type: 'url', title: typeof button?.title === 'string' ? button.title.trim() : '', url: typeof button?.url === 'string' ? button.url.trim() : '' })) };
  const buttons = rawButtons.map((button) => {
    const title = typeof button?.title === 'string' ? button.title.trim() : '';
    const url = typeof button?.url === 'string' ? button.url.trim() : '';
    if (!title || Array.from(title).length > 20) invalid('Each follow-up button needs a title of at most 20 characters.');
    if (button.type && !['url', 'web_url'].includes(button.type)) invalid('Follow-up buttons must open a link.');
    let parsed;
    try { parsed = new URL(url); } catch { invalid('Enter a valid HTTP or HTTPS button link.'); }
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || url.length > 2048) {
      invalid('Enter a valid HTTP or HTTPS button link without login credentials.');
    }
    return { type: 'url', title, url };
  });
  if (buttons.length && Array.from(message).length > 600) invalid('Use at most 600 characters when adding follow-up buttons.');
  return { enabled: value.enabled, delay_hours: 3, message, buttons };
}
