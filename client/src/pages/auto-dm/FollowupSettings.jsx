import React, { useId } from 'react';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

export function getFollowupError(value) {
  if (!value?.enabled) return null;
  const message = typeof value.message === 'string' ? value.message.trim() : '';
  if (!message || new TextEncoder().encode(message).length > 900) return 'Add a follow-up message of at most 900 UTF-8 bytes.';
  const buttons = value.buttons || [];
  if (!Array.isArray(buttons) || buttons.length > 3) return 'Add up to 3 follow-up buttons.';
  if (buttons.length && Array.from(message).length > 600) return 'Use at most 600 characters when adding follow-up buttons.';
  for (const button of buttons) {
    if (!button.title?.trim() || Array.from(button.title.trim()).length > 20) return 'Each button needs a title of at most 20 characters.';
    try {
      const url = new URL(button.url?.trim());
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || button.url.trim().length > 2048) throw new Error();
    } catch { return 'Enter a valid HTTP or HTTPS link for each follow-up button.'; }
  }
  return null;
}

export default function FollowupSettings({ value, onChange, disabled = false }) {
  const id = useId();
  const enabled = value?.enabled === true;
  const message = value?.message || '';
  const buttons = Array.isArray(value?.buttons) ? value.buttons : [];
  const bytes = new TextEncoder().encode(message.trim()).length;
  const characters = Array.from(message.trim()).length;
  const update = (patch) => onChange({ ...value, enabled, message, buttons, delay_hours: 3, ...patch });
  const updateButton = (index, patch) => update({ buttons: buttons.map((button, i) => i === index ? { ...button, ...patch } : button) });
  return (
    <section className="autodm-editor-card overflow-hidden" aria-labelledby={`${id}-title`}>
      <div className="autodm-editor-card-head flex items-center justify-between gap-4 p-4">
        <div>
          <h3 id={`${id}-title`} className="font-semibold text-gray-900">Follow-up after 3 hours</h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">One reminder in the same chat if they don’t reply after your final automated message.</p>
        </div>
        <Switch aria-labelledby={`${id}-title`} checked={enabled} onCheckedChange={(checked) => update({ enabled: checked })} disabled={disabled} />
      </div>
      {enabled && (
        <div className="space-y-4 border-t border-black/5 p-4">
          <div className="space-y-2">
            <label htmlFor={`${id}-message`} className="block text-sm font-medium text-gray-900">Follow-up message</label>
            <Textarea
              id={`${id}-message`} value={message} disabled={disabled}
              onChange={(event) => update({ message: event.target.value })}
              placeholder="Hope the guide helped! Join my channel for more tips and free resources."
              className="min-h-[112px] resize-y rounded-md border-gray-200 text-sm"
              aria-describedby={`${id}-hint ${id}-limit`}
              aria-invalid={bytes > 900 || (buttons.length > 0 && characters > 600)}
            />
            <p id={`${id}-limit`} className={`text-xs ${bytes > 900 || (buttons.length > 0 && characters > 600) ? 'text-red-600' : 'text-gray-500'}`} aria-live="polite">
              {buttons.length ? `${characters} / 600 characters · ` : ''}{bytes} / 900 bytes
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-900">Link buttons <span className="font-normal text-gray-500">(optional)</span></p>
              <button type="button" disabled={disabled || buttons.length >= 3}
                onClick={() => update({ buttons: [...buttons, { type: 'url', title: '', url: '' }] })}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
                <Plus size={14} /> Add button
              </button>
            </div>
            {buttons.map((button, index) => (
              <div key={index} className="space-y-2 rounded-md border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={`${id}-button-${index}-title`} className="text-xs font-medium text-gray-700">Button {index + 1} title</label>
                  <button type="button" disabled={disabled} aria-label={`Remove button ${index + 1}`}
                    onClick={() => update({ buttons: buttons.filter((_, i) => i !== index) })}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"><Trash2 size={14} /></button>
                </div>
                <Input id={`${id}-button-${index}-title`} value={button.title || ''} disabled={disabled}
                  onChange={(event) => updateButton(index, { title: event.target.value })}
                  placeholder="Join my channel" className="rounded-md border-gray-200 text-sm" aria-invalid={Array.from(button.title || '').length > 20} />
                <p className="text-xs text-gray-500">{Array.from(button.title || '').length} / 20 characters</p>
                <label htmlFor={`${id}-button-${index}-url`} className="block text-xs font-medium text-gray-700">Destination link</label>
                <Input id={`${id}-button-${index}-url`} type="url" value={button.url || ''} disabled={disabled}
                  onChange={(event) => updateButton(index, { url: event.target.value })}
                  placeholder="https://ig.me/j/your-channel" className="rounded-md border-gray-200 text-sm" />
              </div>
            ))}
            <p className="text-xs text-gray-500">Add up to 3 buttons to open a channel, website or resource.</p>
          </div>
          {(message.trim() || buttons.length > 0) && (
            <div className="space-y-2" aria-label="Follow-up preview">
              <p className="text-xs font-medium text-gray-500">Message preview</p>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                <p className="whitespace-pre-wrap break-words p-3 text-sm leading-relaxed text-gray-800">{message.trim() || 'Your follow-up message'}</p>
                {buttons.map((button, index) => (
                  <div key={index} className="flex items-center justify-center gap-1.5 border-t border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-blue-600">
                    <span className="min-w-0 break-words">{button.title.trim() || `Button ${index + 1}`}</span><ExternalLink size={12} className="shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
          <p id={`${id}-hint`} className="text-xs leading-relaxed text-gray-500">For comment-triggered DMs, they must first reply or tap a reply button. Opening a link alone doesn’t qualify. Sends only within Instagram’s 24-hour messaging window; a new reply cancels the reminder. One follow-up per person for this automation.</p>
        </div>
      )}
    </section>
  );
}
