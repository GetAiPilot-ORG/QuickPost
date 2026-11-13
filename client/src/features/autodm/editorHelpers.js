export function spacePersonalization(value) {
  return String(value || '').replace(/(@?\{\{\s*(?:username|first_name|firstname|name|full_name)\s*\}\})(?=[\p{L}\p{N}])/gu, (match, token, offset, source) => {
    const prefix = source.slice(0, offset).split(/\s/).pop();
    return /https?:\/\/|www\./i.test(prefix) ? token : `${token} `;
  });
}
export function personalizationExample(value) {
  return spacePersonalization(value)
    .replace(/@*\{\{\s*username\s*\}\}/gi, '@alex_dev')
    .replace(/\{\{\s*(?:first_name|firstname|name|full_name)\s*\}\}/gi, 'Alex');
}
export function insertPersonalization(value, variable, start, end = start) {
  const current = String(value || '');
  const before = current.slice(0, start);
  const after = current.slice(end);
  const token = variable === 'username' ? (before.endsWith('@') ? '{{username}}' : '@{{username}}') : '{{first_name}}';
  const prefix = before && !/[\s@]$/.test(before) ? ' ' : '';
  const suffix = after && /^[\p{L}\p{N}@{]/u.test(after) ? ' ' : '';
  return { text: before + prefix + token + suffix + after, caret: before.length + prefix.length + token.length + suffix.length };
}
export function responseIssue(node) {
  const text = String(node.content || node.text || '').trim();
  if (['text', 'buttons'].includes(node.type) && (!text || text === 'Write a message')) return 'Message required';
  if (node.type === 'image' && !node.image_url?.trim()) return 'Photo required';
  if (node.type === 'card' && !node.card_title?.trim()) return 'Card title required';
  if (node.type === 'carousel') {
    if (!node.items?.length) return 'Add a card';
    if (node.items.some(item => !item.title?.trim())) return 'Card title required';
  }
  if (node.type === 'lead_form' && !node.form_fields?.length) return 'Add a question';
  if (node.type === 'delay' && (!Number.isFinite(Number(node.delay_seconds)) || Number(node.delay_seconds) <= 0)) return 'Choose a wait time';
  const buttons = [...(node.buttons || []), ...(node.items || []).flatMap(item => item.buttons || [])];
  for (const button of buttons) {
    if (!button.title?.trim()) return 'Button label required';
    if (['url', 'web_url'].includes(button.type)) {
      try { const url = new URL(button.url); if (!['http:', 'https:'].includes(url.protocol)) return 'Valid button link required'; }
      catch { return 'Button link required'; }
    }
  }
  return null;
}
