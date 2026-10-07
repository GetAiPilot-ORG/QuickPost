import { getSupabaseAdmin, json, logError, logInfo, requireEnv } from '../_shared/db.ts';
import { processAutomationEvent } from '../_shared/automationEngine.ts';

interface WebhookEvent {
  triggerType: 'dm' | 'comment';
  igId: string;
  senderId: string;
  senderUsername?: string;
  parentId?: string;
  messageText: string;
  eventType: string;
  eventId: string;
  mediaId?: string; // Parent post ID
  payload: Record<string, unknown>;
}

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const verifyWebhookSignature = async (
  rawBody: Uint8Array,
  signatureHeader: string | null,
  requestId: string
): Promise<boolean> => {
  if (!signatureHeader?.startsWith('sha256=')) {
    logInfo('Signature header missing or invalid format', { requestId, signatureHeader });
    return false;
  }

  const received = signatureHeader.replace('sha256=', '').trim().toLowerCase();
  const rotationSecrets = (Deno.env.get('META_WEBHOOK_SIGNATURE_SECRETS') ?? '')
    .split(',')
    .map((secret) => secret.trim())
    .filter(Boolean)
    .map((secret, index) => [`META_WEBHOOK_SIGNATURE_SECRETS[${index}]`, secret] as [string, string]);

  const secrets = [
    ['META_APP_SECRET', Deno.env.get('META_APP_SECRET')?.trim()],
    ['IG_APP_SECRET', Deno.env.get('IG_APP_SECRET')?.trim()],
    ['INSTAGRAM_APP_SECRET', Deno.env.get('INSTAGRAM_APP_SECRET')?.trim()],
    ...rotationSecrets,
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  if (secrets.length === 0) {
    requireEnv('IG_APP_SECRET');
  }

  const hmacSign = async (key: CryptoKey, data: Uint8Array): Promise<string> => {
    const digest = await crypto.subtle.sign('HMAC', key, data);
    return hex(new Uint8Array(digest)).toLowerCase();
  };

  const attempts: Array<{ secretName: string; expectedRawSnippet: string; secretLength: number }> = [];

  for (const [secretName, appSecret] of secrets) {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(appSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // 1. Try with raw body exactly as received
    const expectedRaw = await hmacSign(key, rawBody);
    attempts.push({
      secretName,
      expectedRawSnippet: `${expectedRaw.slice(0, 10)}...`,
      secretLength: appSecret.length,
    });
    if (timingSafeEqual(expectedRaw, received)) {
      logInfo('Signature verified (Raw Body)', { requestId, secretName });
      return true;
    }

    // 2. Try with compact JSON (Common fallback if proxy/test-tool reformats)
    try {
      const bodyText = new TextDecoder().decode(rawBody);
      const compactBody = JSON.stringify(JSON.parse(bodyText));
      const expectedCompact = await hmacSign(key, new TextEncoder().encode(compactBody));

      if (timingSafeEqual(expectedCompact, received)) {
        logInfo('Signature verified (Compact JSON Fallback)', { requestId, secretName });
        return true;
      }
    } catch (e) {
      /* ignore parse error */
    }
  }

  // If all failed, log deep diagnostics
  logInfo('Webhook signature mismatch after all attempts', {
    requestId,
    receivedSnippet: `${received.slice(0, 10)}...`,
    attempts,
    bodyLength: rawBody.byteLength,
  });

  return false;
};

const hashDedupeKey = async (parts: string[]) => {
  const joined = parts.join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(joined));
  return hex(new Uint8Array(digest));
};

const extractEvents = (payload: any): WebhookEvent[] => {
  const events: WebhookEvent[] = [];

  for (const entry of payload?.entry ?? []) {
    const entryId = String(entry?.id ?? '');

    for (const messaging of entry?.messaging ?? []) {
      const isEcho = Boolean(messaging?.message?.is_echo);
      const rawSenderId = String(messaging?.sender?.id ?? '');
      const rawRecipientId = String(messaging?.recipient?.id ?? entryId);
      const senderId = isEcho ? rawRecipientId : rawSenderId;
      const igId = isEcho ? rawSenderId : rawRecipientId;

      if (messaging?.message?.text || messaging?.message?.quick_reply?.payload || messaging?.message?.attachments) {
        const quickReplyPayload = String(messaging?.message?.quick_reply?.payload ?? '').trim();
        const messageText = quickReplyPayload || String(messaging?.message?.text ?? (messaging?.message?.attachments ? '📎 Attachment' : ''));
        events.push({
          triggerType: 'dm',
          igId,
          senderId,
          messageText,
          eventType: 'messages',
          eventId: String(
            messaging?.message?.mid ?? `${entryId}-${messaging?.timestamp ?? Date.now()}`
          ),
          payload: messaging,
        });
      }

      if (messaging?.postback) {
        events.push({
          triggerType: 'dm',
          igId,
          senderId,
          messageText: String(messaging.postback.payload ?? messaging.postback.title ?? ''),
          eventType: 'messaging_postbacks',
          eventId: String(
            messaging?.postback?.mid ?? `${entryId}-${messaging?.timestamp ?? Date.now()}-postback`
          ),
          payload: messaging,
        });
      }
    }

    for (const change of entry?.changes ?? []) {
      if (change?.field !== 'comments') continue;

      const senderId = String(change?.value?.from?.id ?? '');
      const senderUsername = String(change?.value?.from?.username ?? '').trim().toLowerCase().replace(/^@/, '');
      const igId = entryId || String(change?.value?.instagram_business_account_id ?? '');
      const messageText = String(change?.value?.text ?? '');
      const eventId = String(change?.value?.id ?? `${entryId}-${Date.now()}-comment`);
      const mediaId = String(change?.value?.media?.id ?? '');
      const parentId = String(change?.value?.parent_id ?? '');

      if (parentId) {
        logInfo('Skipping child comment reply webhook event', {
          entryId,
          parentId,
          senderId,
          senderUsername,
          eventId,
        });
        continue;
      }

      if (
        Boolean(change?.value?.from?.self_ig_scoped_id) ||
        (senderId &&
          (senderId === entryId ||
            senderId === String(change?.value?.instagram_business_account_id ?? '') ||
            senderId === igId))
      ) {
        logInfo('Skipping own comment webhook event', {
          entryId,
          senderId,
          senderUsername,
          eventId,
        });
        continue;
      }

      logInfo('Extracted comment event details', {
        entryId,
        payloadIgId: change?.value?.instagram_business_account_id,
        finalIgId: igId,
        mediaId,
        senderUsername,
        parentId,
      });

      events.push({
        triggerType: 'comment',
        igId,
        senderId,
        senderUsername: senderUsername || undefined,
        parentId: parentId || undefined,
        messageText,
        eventType: 'comments',
        eventId,
        mediaId,
        payload: change,
      });
    }
  }

  return events.filter((event) => event.igId && event.senderId && event.messageText);
};

Deno.serve(async (request: Request) => {
  const requestId = crypto.randomUUID();

  try {
    const url = new URL(request.url);

    if (request.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === requireEnv('META_WEBHOOK_VERIFY_TOKEN') && challenge) {
        logInfo('Webhook verification succeeded', { requestId });
        return new Response(challenge, { status: 200 });
      }

      return new Response('Verification failed', { status: 403 });
    }

    if (request.method !== 'POST') {
      return json(405, { error: 'Method not allowed' });
    }

    const arrayBuffer = await request.arrayBuffer();
    const rawBody = new Uint8Array(arrayBuffer);
    const signature = request.headers.get('x-hub-signature-256');
    logInfo('Instagram webhook POST received', {
      requestId,
      bodyLength: rawBody.byteLength,
      hasSignature: Boolean(signature),
      signaturePrefix: signature?.slice(0, 16) ?? null,
    });
    const signatureValid = await verifyWebhookSignature(rawBody, signature, requestId);

    if (!signatureValid) {
      logInfo('Invalid webhook signature', { requestId });
      return json(401, { error: 'Invalid signature' });
    }

    const payload = JSON.parse(new TextDecoder().decode(rawBody));
    const events = extractEvents(payload);

    const supabase = getSupabaseAdmin();

    for (const event of events) {
      const dedupeKey = await hashDedupeKey([
        event.igId,
        event.senderId,
        event.eventType,
        event.eventId,
        event.messageText,
      ]);

      const insertPayload = {
        ig_id: event.igId,
        sender_id: event.senderId,
        message_text: event.messageText,
        processed: false,
        event_type: event.eventType,
        event_id: event.eventId,
        dedupe_key: dedupeKey,
        payload: event.payload,
      };

      const { error: insertError } = await supabase
        .from('webhook_logs')
        .insert(insertPayload)
        .select('id')
        .single();

      if (insertError) {
        const isDuplicate = insertError.code === '23505';
        if (isDuplicate) {
          logInfo('Duplicate webhook event skipped', { requestId, dedupeKey });
          continue;
        }

        throw new Error(`Failed storing webhook event: ${insertError.message}`);
      }

      if (!(event.payload as any)?.message?.is_echo) {
        try {
          await processAutomationEvent({
            igId: event.igId,
            senderId: event.senderId,
            senderUsername: event.senderUsername,
            parentId: event.parentId,
            messageText: event.messageText,
            triggerType: event.triggerType,
            mediaId: event.mediaId,
            eventId: event.eventId, // FIX: comment reply ke liye zaruri hai
            dedupeKey,
            requestId,
            externalPayload: event.payload,
          });
        } catch (automationError) {
          const errorMessage = automationError instanceof Error ? automationError.message : String(automationError);
          logError('Automation processing failed', {
            requestId,
            dedupeKey,
            igId: event.igId,
            senderId: event.senderId,
            triggerType: event.triggerType,
            error: errorMessage,
            stack: automationError instanceof Error ? automationError.stack : undefined,
          });

          // Ensure processed: true even on error to prevent stuck state, and log the ERROR to DB
          await supabase
            .from('webhook_logs')
            .update({ 
              processed: true, 
              processing_error: errorMessage,
            })
            .eq('dedupe_key', dedupeKey);
        }
      }
    }

    return json(200, { received: true, processedEvents: events.length });
  } catch (error) {
    logError('Webhook handler failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return json(500, { error: 'Webhook processing failed' });
  }
});
