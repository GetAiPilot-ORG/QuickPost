import crypto from 'crypto';
import axios from 'axios';
import supabase from './supabase.js';
import { consumeUsage } from './entitlements.js';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const IG_GRAPH_BASE = process.env.IG_GRAPH_BASE_URL || 'https://graph.instagram.com/v24.0';
const DEFAULT_REPLY =
  'I am not fully sure about that. Our team will help you shortly.';

function getGraphBaseForToken(accessToken) {
  return accessToken?.startsWith('IG') ? IG_GRAPH_BASE : GRAPH_BASE;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getEncryptionKeys() {
  // Try INSTAPILOT key first (used for tokens stored via importConnectedInstagram),
  // then fall back to AUTODM key (used by the legacy AutoDM token service).
  const rawKeys = [
    process.env.TOKEN_ENCRYPTION_KEY_BASE64 ||
      null,
    process.env.INSTAPILOT_TOKEN_ENCRYPTION_KEY_BASE64 || null,
    process.env.AUTODM_TOKEN_ENCRYPTION_KEY_BASE64 || null,
  ].filter(Boolean);

  if (!rawKeys.length) {
    throw new Error(
      'Missing TOKEN_ENCRYPTION_KEY_BASE64, INSTAPILOT_TOKEN_ENCRYPTION_KEY_BASE64 or AUTODM_TOKEN_ENCRYPTION_KEY_BASE64'
    );
  }

  return rawKeys.map((raw) => {
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new Error('Encryption key must decode to 32 bytes');
    }
    return key;
  });
}

function getEncryptionKey() {
  return getEncryptionKeys()[0];
}

export function encryptToken(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64')}:${Buffer.concat([encrypted, tag]).toString('base64')}`;
}

export function decryptToken(payload) {
  if (!payload?.startsWith('enc:v1:')) throw new Error('Unsupported encrypted token format');
  const [, , ivB64, dataB64] = payload.split(':');
  const data = Buffer.from(dataB64, 'base64');
  const encrypted = data.subarray(0, -16);
  const tag = data.subarray(-16);
  let lastError;

  for (const key of getEncryptionKeys()) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Failed to decrypt Instagram token: ${lastError?.message || 'unknown error'}`);
}

export function verifyMetaSignature(rawBody, signature) {
  const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;
  if (!appSecret) return false;
  if (!rawBody || !signature?.startsWith('sha256=')) return false;
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

function getUserIds(userOrId) {
  if (typeof userOrId === 'string') return [userOrId].filter(Boolean);
  return [...new Set([userOrId?.userId, userOrId?.authUserId].filter(Boolean))];
}

export async function listAccounts(userOrId) {
  const userIds = getUserIds(userOrId);
  const { data, error } = await supabase
    .from('instagram_accounts')
    .select('*')
    .in('user_id', userIds)
    .eq('is_connected', true)
    .order('updated_at', { ascending: false });
  if (error) throw error;

  const seen = new Set();
  return (data || [])
    .filter((account) => {
      const identity =
        account.instagram_business_account_id ||
        account.instagram_user_id ||
        account.page_id ||
        account.instagram_username ||
        account.id;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    })
    .map(({ access_token_encrypted, ...account }) => account);
}

export async function importConnectedInstagram(user) {
  const userIds = getUserIds(user);
  const { data: socialToken, error } = await supabase
    .from('social_tokens')
    .select('access_token, token_expiry, instagram_business_id, page_id, username, profile_data')
    .in('user_id', userIds)
    .eq('provider', 'instagram')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!socialToken?.access_token || !socialToken?.instagram_business_id) {
    throw new Error('Connect an Instagram Professional account through Instagram OAuth first.');
  }

  const permissions = await fetchTokenPermissions(socialToken.access_token).catch(() => []);
  const profile = socialToken.profile_data || {};
  const liveProfile = await fetchInstagramProfile({
    accessToken: socialToken.access_token,
    instagramBusinessId: socialToken.instagram_business_id,
  }).catch(() => null);
  const profilePictureUrl =
    liveProfile?.profile_picture_url ||
    liveProfile?.profilePicture ||
    profile.profile_picture_url ||
    profile.profilePicture ||
    profile.picture?.data?.url ||
    profile.picture ||
    null;
  // Preserve existing webhook_status and token if account already exists.
  const { data: existingAccount } = await supabase
    .from('instagram_accounts')
    .select('id, webhook_status, webhook_instagram_user_id, access_token_encrypted')
    .eq('user_id', user.userId)
    .eq('instagram_business_account_id', socialToken.instagram_business_id)
    .maybeSingle();

  const { data: duplicateAccount, error: duplicateError } = await supabase
    .from('instagram_accounts')
    .select('id, user_id, instagram_username')
    .eq('instagram_business_account_id', socialToken.instagram_business_id)
    .eq('is_connected', true)
    .neq('user_id', user.userId)
    .limit(1)
    .maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicateAccount) {
    const err = new Error(
      `This Instagram account is already connected to another workspace. Disconnect @${duplicateAccount.instagram_username || 'this account'} there before importing it here.`
    );
    err.status = 409;
    throw err;
  }

  let tokenEncrypted = existingAccount?.access_token_encrypted;
  if (tokenEncrypted) {
    try {
      const decrypted = decryptToken(tokenEncrypted);
      if (decrypted?.pageAccessToken !== socialToken.access_token) {
        tokenEncrypted = encryptToken({ pageAccessToken: socialToken.access_token });
      }
    } catch (e) {
      console.warn('[INSTAPILOT] Existing token decryption failed, re-encrypting:', e.message);
      tokenEncrypted = encryptToken({ pageAccessToken: socialToken.access_token });
    }
  } else {
    tokenEncrypted = encryptToken({ pageAccessToken: socialToken.access_token });
  }

  const accountPayload = {
    user_id: user.userId,
    page_id: socialToken.page_id || socialToken.instagram_business_id,
    page_name: profile.page_name || liveProfile?.name || profile.name || null,
    instagram_business_account_id: socialToken.instagram_business_id,
    instagram_username: liveProfile?.username || socialToken.username || profile.username || null,
    profile_picture_url: profilePictureUrl,
    access_token_encrypted: tokenEncrypted,
    token_expires_at: socialToken.token_expiry || null,
    permissions,
    webhook_status: existingAccount?.webhook_status || 'configure_in_meta',
    webhook_instagram_user_id: existingAccount?.webhook_instagram_user_id || null,
    token_status: 'active',
    is_connected: true,
    updated_at: new Date().toISOString(),
  };

  const { data, error: upsertError } = await supabase
    .from('instagram_accounts')
    .upsert(accountPayload, { onConflict: 'user_id,instagram_business_account_id' })
    .select('*')
    .single();
  if (upsertError) throw upsertError;
  const { access_token_encrypted, ...safe } = data;
  return safe;
}

async function fetchTokenPermissions(accessToken) {
  const { data } = await axios.get(`${GRAPH_BASE}/me/permissions`, {
    params: { access_token: accessToken },
  });
  return data?.data || [];
}

async function fetchInstagramProfile({ accessToken, instagramBusinessId }) {
  const { data } = await axios.get(`${getGraphBaseForToken(accessToken)}/${instagramBusinessId}`, {
    params: {
      access_token: accessToken,
      fields: 'id,username,name,profile_picture_url',
    },
  });
  return data || null;
}

async function getOwnedAccount(userId, accountId) {
  const { data, error } = await supabase
    .from('instagram_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Instagram account not found');
  return data;
}

async function getPageTokenForAccount(account) {
  return decryptToken(account.access_token_encrypted).pageAccessToken;
}

async function clearAndAssignWebhookRecipient(account, recipientId) {
  await supabase
    .from('instagram_accounts')
    .update({ webhook_instagram_user_id: null, updated_at: new Date().toISOString() })
    .eq('webhook_instagram_user_id', recipientId)
    .neq('id', account.id);

  const { data, error } = await supabase
    .from('instagram_accounts')
    .update({ webhook_instagram_user_id: recipientId, updated_at: new Date().toISOString() })
    .eq('id', account.id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function disconnectAccount(userId, accountId) {
  const account = await getOwnedAccount(userId, accountId);
  const { error } = await supabase
    .from('instagram_accounts')
    .update({ is_connected: false, token_status: 'disconnected' })
    .eq('id', account.id)
    .eq('user_id', userId);
  if (error) throw error;
  await audit(userId, 'disconnect', 'instagram_account', account.id);
  return true;
}

export async function subscribeAccountToWebhooks(userId, accountId) {
  const account = await getOwnedAccount(userId, accountId);
  const accessToken = await getPageTokenForAccount(account);
  const subscribedFields =
    process.env.INSTAPILOT_SUBSCRIBED_FIELDS || 'messages,messaging_postbacks,comments';

  let data = { success: true, bypassed: false };
  try {
    const response = await axios.post(
      `${getGraphBaseForToken(accessToken)}/${account.page_id}/subscribed_apps`,
      null,
      {
        params: {
          access_token: accessToken,
          subscribed_fields: subscribedFields,
        },
      }
    );
    data = response.data;
  } catch (error) {
    if (error.response && error.response.data && error.response.data.error) {
      const err = error.response.data.error;
      // If the app is in Live Mode without App Review, it throws (#200) for pages_messaging.
      // We know the user already manually subscribed in the Meta Dashboard, so we can safely swallow it!
      if (err.code === 200 && err.message && err.message.includes('pages_messaging')) {
        console.warn('[INSTAPILOT] Bypassing programmatic subscription since user manually subscribed.', err.message);
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  await supabase
    .from('instagram_accounts')
    .update({
      webhook_status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id)
    .eq('user_id', userId);

  await audit(userId, 'subscribe_webhooks', 'instagram_account', account.id, {
    subscribed_fields: subscribedFields,
    response: data,
  });

  return data;
}

export async function listBots(userId) {
  const { data, error } = await supabase
    .from('instagram_bots')
    .select('*, instagram_accounts(instagram_username, page_name, page_id, instagram_business_account_id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

function cleanBotPayload(payload, userId) {
  return {
    user_id: userId,
    instagram_account_id: payload.instagram_account_id,
    bot_name: payload.bot_name?.trim(),
    business_name: payload.business_name?.trim(),
    tone: payload.tone || 'friendly',
    language: payload.language || 'auto-detect',
    bot_goal: payload.bot_goal || 'support',
    fallback_message: payload.fallback_message || DEFAULT_REPLY,
    welcome_message:
      payload.welcome_message || 'Hi! Welcome to {{business_name}}. How can I help you today?',
    quick_replies: payload.quick_replies || ['Pricing', 'Services', 'Book a Call', 'Talk to Human'],
    handoff_keywords: payload.handoff_keywords || ['human', 'agent', 'call me', 'support'],
    lead_fields: payload.lead_fields || ['name', 'phone', 'email', 'requirement'],
    business_hours: payload.business_hours || {},
    is_active: Boolean(payload.is_active),
    human_handoff_enabled: payload.human_handoff_enabled !== false,
    confidence_threshold: Number(payload.confidence_threshold || 0.68),
    daily_reply_limit: Number(payload.daily_reply_limit || 250),
  };
}

export async function createBot(userId, payload) {
  if (!payload?.instagram_account_id || !payload?.bot_name || !payload?.business_name) {
    throw new Error('Instagram account, bot name, and business name are required.');
  }
  await getOwnedAccount(userId, payload.instagram_account_id);
  const { data: existingBot, error: existingError } = await supabase
    .from('instagram_bots')
    .select('id, bot_name')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingBot?.id) {
    const err = new Error('Only one InstaPilot bot is allowed. Please edit the existing bot instead.');
    err.status = 409;
    throw err;
  }
  if (payload.is_active) {
    await deactivateOtherBots(userId, payload.instagram_account_id);
  }
  const { data, error } = await supabase
    .from('instagram_bots')
    .insert(cleanBotPayload(payload, userId))
    .select('*')
    .single();
  if (error) throw error;
  await audit(userId, 'create', 'instagram_bot', data.id);
  return data;
}

export async function updateBot(userId, botId, payload) {
  const existing = await getOwnedBot(userId, botId);
  const targetAccountId = payload.instagram_account_id || existing.instagram_account_id;
  const mergedPayload = { ...existing, ...payload, instagram_account_id: targetAccountId };
  await getOwnedAccount(userId, targetAccountId);
  if (mergedPayload.is_active) {
    await deactivateOtherBots(userId, targetAccountId, botId);
  }
  const { user_id, id, created_at, updated_at, ...clean } = cleanBotPayload(mergedPayload, userId);
  const { data, error } = await supabase
    .from('instagram_bots')
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq('id', botId)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  await audit(userId, 'update', 'instagram_bot', botId);
  return data;
}

export async function deleteBot(userId, botId) {
  await getOwnedBot(userId, botId);
  const { error } = await supabase
    .from('instagram_bots')
    .delete()
    .eq('id', botId)
    .eq('user_id', userId);
  if (error) throw error;
  await audit(userId, 'delete', 'instagram_bot', botId);
  return true;
}

async function deactivateOtherBots(userId, instagramAccountId, exceptBotId = null) {
  let query = supabase
    .from('instagram_bots')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('instagram_account_id', instagramAccountId)
    .eq('is_active', true);
  if (exceptBotId) query = query.neq('id', exceptBotId);
  const { error } = await query;
  if (error) throw error;
}

export async function addKnowledgeSource(userId, payload) {
  const bot = await getOwnedBot(userId, payload.bot_id);
  const sourcePayload = {
    user_id: userId,
    bot_id: bot.id,
    source_type: payload.source_type || 'manual',
    title: payload.title || 'Knowledge source',
    original_file_url: payload.url || null,
    status: 'processing',
  };
  const { data: source, error } = await supabase
    .from('knowledge_sources')
    .insert(sourcePayload)
    .select('*')
    .single();
  if (error) throw error;

  try {
    const text = await resolveKnowledgeText(payload);
    const chunks = chunkText(text).map((chunk, index) => ({
      source_id: source.id,
      bot_id: bot.id,
      chunk_text: chunk,
      metadata: { index, source_type: sourcePayload.source_type },
    }));
    if (chunks.length) {
      const embeddings = await embedChunks(chunks.map((c) => c.chunk_text)).catch(() => null);
      const rows = chunks.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings?.[index] || null,
      }));
      const { error: chunkError } = await supabase.from('knowledge_chunks').insert(rows);
      if (chunkError) throw chunkError;
    }
    await supabase.from('knowledge_sources').update({ status: 'ready' }).eq('id', source.id);
    return { ...source, status: 'ready', chunks: chunks.length };
  } catch (err) {
    await supabase
      .from('knowledge_sources')
      .update({ status: 'failed', error_message: err.message })
      .eq('id', source.id);
    throw err;
  }
}

export async function updateKnowledgeSource(userId, sourceId, payload) {
  const source = await getOwnedKnowledgeSource(userId, sourceId);
  await getOwnedBot(userId, source.bot_id);

  await supabase
    .from('knowledge_sources')
    .update({
      source_type: payload.source_type || source.source_type,
      title: payload.title || source.title,
      original_file_url: payload.url || source.original_file_url || null,
      status: 'processing',
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', source.id)
    .eq('user_id', userId);

  try {
    await supabase.from('knowledge_chunks').delete().eq('source_id', source.id);
    const text = await resolveKnowledgeText(payload);
    const chunks = chunkText(text).map((chunk, index) => ({
      source_id: source.id,
      bot_id: source.bot_id,
      chunk_text: chunk,
      metadata: { index, source_type: payload.source_type || source.source_type },
    }));
    if (chunks.length) {
      const embeddings = await embedChunks(chunks.map((c) => c.chunk_text)).catch(() => null);
      const rows = chunks.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings?.[index] || null,
      }));
      const { error: chunkError } = await supabase.from('knowledge_chunks').insert(rows);
      if (chunkError) throw chunkError;
    }
    const { data, error } = await supabase
      .from('knowledge_sources')
      .update({ status: 'ready', updated_at: new Date().toISOString() })
      .eq('id', source.id)
      .eq('user_id', userId)
      .select('*, knowledge_chunks(id,chunk_text)')
      .single();
    if (error) throw error;
    await audit(userId, 'update', 'knowledge_source', source.id);
    return data;
  } catch (err) {
    await supabase
      .from('knowledge_sources')
      .update({ status: 'failed', error_message: err.message, updated_at: new Date().toISOString() })
      .eq('id', source.id)
      .eq('user_id', userId);
    throw err;
  }
}

export async function deleteKnowledgeSource(userId, sourceId) {
  const source = await getOwnedKnowledgeSource(userId, sourceId);
  await supabase.from('knowledge_chunks').delete().eq('source_id', source.id);
  const { error } = await supabase
    .from('knowledge_sources')
    .delete()
    .eq('id', source.id)
    .eq('user_id', userId);
  if (error) throw error;
  await audit(userId, 'delete', 'knowledge_source', source.id);
  return true;
}

async function resolveKnowledgeText(payload) {
  if (payload.text) return String(payload.text);
  if (payload.faqs) return payload.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
  if (payload.url) {
    const { data } = await axios.get(payload.url, { timeout: 12000, maxContentLength: 2_000_000 });
    return String(data).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');
  }
  throw new Error('Provide text, FAQ items, or a website URL.');
}

function chunkText(text) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  const chunks = [];
  for (let i = 0; i < cleaned.length; i += 1200) {
    const chunk = cleaned.slice(i, i + 1400).trim();
    if (chunk.length > 80) chunks.push(chunk);
  }
  return chunks.slice(0, 200);
}

async function embedChunks(input) {
  if (!process.env.OPENAI_API_KEY || !input.length) return null;
  const { data } = await axios.post(
    'https://api.openai.com/v1/embeddings',
    { model: process.env.INSTAPILOT_EMBEDDING_MODEL || 'text-embedding-3-small', input },
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
  );
  return data.data.map((item) => item.embedding);
}

async function getOwnedBot(userId, botId) {
  const { data, error } = await supabase
    .from('instagram_bots')
    .select('*')
    .eq('id', botId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Bot not found');
  return data;
}

async function getOwnedKnowledgeSource(userId, sourceId) {
  const { data, error } = await supabase
    .from('knowledge_sources')
    .select('*')
    .eq('id', sourceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Knowledge source not found');
  return data;
}

export async function listKnowledge(userId, botId) {
  await getOwnedBot(userId, botId);
  const { data, error } = await supabase
    .from('knowledge_sources')
    .select('*, knowledge_chunks(id,chunk_text)')
    .eq('bot_id', botId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function retrieveKnowledge(botId, question) {
  const words = String(question || '')
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3)
    .slice(0, 12);
  const { data, error } = await supabase
    .from('knowledge_chunks')
    .select('chunk_text, metadata')
    .eq('bot_id', botId)
    .limit(80);
  if (error) throw error;
  return (data || [])
    .map((chunk) => ({
      ...chunk,
      score: words.reduce((sum, word) => sum + (chunk.chunk_text.toLowerCase().includes(word) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

export async function generateReply({ bot, messageText, conversation = null }) {
  const chunks = await retrieveKnowledge(bot.id, messageText);
  // Fall back to top knowledge chunks if keyword score is 0
  let effectiveChunks = chunks;
  if (!effectiveChunks.length || !effectiveChunks.some((c) => c.score > 0)) {
    const { data: allChunks } = await supabase
      .from('knowledge_chunks')
      .select('chunk_text, metadata')
      .eq('bot_id', bot.id)
      .limit(5);
    if (allChunks?.length) effectiveChunks = allChunks;
  }

  if (!process.env.OPENAI_API_KEY) {
    const defaultText = effectiveChunks[0]?.chunk_text || bot.fallback_message || DEFAULT_REPLY;
    return {
      text: `${defaultText.slice(0, 420)}${defaultText.length > 420 ? '...' : ''}`,
      confidence: 0.55,
      handoff: false,
    };
  }

  const prompt = [
    `You are the official Instagram DM AI assistant for ${bot.business_name}.`,
    `Tone: ${bot.tone || 'friendly and professional'}. Language: ${bot.language || 'English'}. Goal: ${bot.bot_goal || 'Assist customers, answer questions, and collect contact details'}.`,
    'Rules:',
    '1. For greetings (e.g. "hello", "hi", "hey"), reply warmly and ask how you can assist them with our services.',
    '2. Use the Knowledge Base to answer business questions accurately.',
    '3. When the customer asks about pricing, booking a demo, or getting started, politely ask for their name, phone number, or email address so our team can assist them.',
    '4. Never invent prices, policies, discounts, or guarantees not listed in the Knowledge Base.',
    '5. Keep Instagram DM replies concise, natural, friendly, and mobile-friendly.',
  ].join('\n');

  const { data } = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: process.env.INSTAPILOT_OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: `Knowledge Base:\n${effectiveChunks.map((c, i) => `[${i + 1}] ${c.chunk_text}`).join('\n\n')}\n\nCustomer Message: ${messageText}`,
        },
      ],
    },
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
  );
  const text = data.choices?.[0]?.message?.content?.trim() || bot.fallback_message || DEFAULT_REPLY;
  return { text, confidence: 0.85, handoff: false };
}

export async function testReply(userId, botId, messageText) {
  const bot = await getOwnedBot(userId, botId);
  return generateReply({ bot, messageText });
}

function needsHandoff(bot, text) {
  const normalized = String(text || '').toLowerCase();
  const keywords = bot.handoff_keywords || ['human', 'agent', 'call me', 'support'];
  const riskWords = ['refund', 'legal', 'payment failed', 'angry', 'complaint', 'fraud', 'cancel'];
  return [...keywords, ...riskWords].some((word) => normalized.includes(String(word).toLowerCase()));
}

async function findActiveBotForAccount(accountId) {
  const { data, error } = await supabase
    .from('instagram_bots')
    .select('*')
    .eq('instagram_account_id', accountId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findAccountByRecipient(recipientId) {
  let { data, error } = await supabase
    .from('instagram_accounts')
    .select('*')
    .or(`instagram_business_account_id.eq.${recipientId},webhook_instagram_user_id.eq.${recipientId},page_id.eq.${recipientId}`)
    .eq('is_connected', true)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  if (data && data.length > 0) {
    const exact = data.find((acc) => acc.webhook_instagram_user_id === recipientId);
    if (exact) return exact;
    return data[0];
  }

  // Self-healing mapping fallback for direct Instagram accounts
  const { data: fallbackAccounts, error: fallbackError } = await supabase
    .from('instagram_accounts')
    .select('*')
    .eq('is_connected', true);

  if (!fallbackError && fallbackAccounts) {
    for (const account of fallbackAccounts) {
      try {
        const decrypted = decryptToken(account.access_token_encrypted);
        const token = decrypted.pageAccessToken || decrypted.userAccessToken;
        if (token && token.startsWith('IG')) {
          console.log(`[INSTAPILOT] Checking self-healing match for ${account.instagram_username}...`);
          const res = await axios.get(`https://graph.instagram.com/v24.0/${recipientId}`, {
            params: { access_token: token, fields: 'id,username' },
            timeout: 5000,
          });
          const storedId = account.instagram_user_id || account.page_id;
          if (
            res.data &&
            (res.data.id === storedId || res.data.username === account.instagram_username)
          ) {
            console.log(
              `[INSTAPILOT] Self-healing mapped webhook recipient ${recipientId} to account ${account.instagram_username}`
            );
            return clearAndAssignWebhookRecipient(account, recipientId);
          }
        }
      } catch (e) {
        console.warn(
          `[INSTAPILOT] Failed self-healing check for account ${account.instagram_username}:`,
          e.response?.data || e.message
        );
      }
    }
  }

  return null;
}

async function upsertConversation(account, bot, senderId) {
  // 1. Check if we already have it in the DB to avoid unnecessary API calls
  const { data: existingConv } = await supabase
    .from('instagram_conversations')
    .select('instagram_username, instagram_name, profile_pic_url')
    .eq('instagram_account_id', account.id)
    .eq('instagram_user_id', senderId)
    .maybeSingle();

  let profile = await fetchInstagramScopedUserProfile(account, senderId).catch(() => null);

  // If profile API failed or returned missing data, try to get username from contacts
  let fallbackUsername = null;
  let fallbackName = null;
  if (!profile || !profile.username) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('username, full_name')
      .eq('instagram_account_id', account.id)
      .eq('instagram_user_id', senderId)
      .maybeSingle();
      
    if (contact && contact.username && !contact.username.startsWith('user_')) {
      fallbackUsername = contact.username;
      fallbackName = contact.full_name;
    }
  }

  const payload = {
    user_id: account.user_id,
    bot_id: bot?.id || null,
    instagram_account_id: account.id,
    instagram_user_id: senderId,
    instagram_username: profile?.username || fallbackUsername || existingConv?.instagram_username || null,
    instagram_name: profile?.name || fallbackName || existingConv?.instagram_name || null,
    profile_pic_url: profile?.profile_pic || existingConv?.profile_pic_url || null,
    follower_count: Number.isFinite(profile?.follower_count) ? profile.follower_count : null,
    is_user_follow_business:
      typeof profile?.is_user_follow_business === 'boolean' ? profile.is_user_follow_business : null,
    is_business_follow_user:
      typeof profile?.is_business_follow_user === 'boolean' ? profile.is_business_follow_user : null,
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('instagram_conversations')
    .upsert(payload, { onConflict: 'instagram_account_id,instagram_user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function findExistingInboundMessage({ accountId, senderId, recipientId, text, metaMessageId }) {
  if (metaMessageId) {
    const { data, error } = await supabase
      .from('instagram_messages')
      .select('id')
      .eq('instagram_account_id', accountId)
      .eq('direction', 'inbound')
      .eq('raw_payload->message->>mid', metaMessageId)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  // Do not deduplicate by message text so users typing "Hello" or "Hi" multiple times get replies.
  return null;
}

async function fetchInstagramScopedUserProfile(account, senderId) {
  const accessToken = await getPageTokenForAccount(account);
  const { data } = await axios.get(`https://graph.instagram.com/${GRAPH_VERSION}/${senderId}`, {
    params: {
      access_token: accessToken,
      fields: 'name,username,profile_pic,follower_count,is_user_follow_business,is_business_follow_user',
    },
  });
  return data || null;
}

function conversationNeedsProfileRefresh(conversation) {
  return (
    !conversation.instagram_username ||
    !conversation.profile_pic_url ||
    typeof conversation.is_user_follow_business !== 'boolean' ||
    typeof conversation.is_business_follow_user !== 'boolean'
  );
}

async function refreshConversationProfile(conversation) {
  if (!conversationNeedsProfileRefresh(conversation)) return conversation;

  try {
    const account = await getOwnedAccount(conversation.user_id, conversation.instagram_account_id);
    const profile = await fetchInstagramScopedUserProfile(account, conversation.instagram_user_id);
    if (!profile) return conversation;

    const updates = {
      instagram_username: profile.username || conversation.instagram_username || null,
      instagram_name: profile.name || conversation.instagram_name || null,
      profile_pic_url: profile.profile_pic || conversation.profile_pic_url || null,
      follower_count: Number.isFinite(profile.follower_count)
        ? profile.follower_count
        : conversation.follower_count || null,
      is_user_follow_business:
        typeof profile.is_user_follow_business === 'boolean'
          ? profile.is_user_follow_business
          : conversation.is_user_follow_business,
      is_business_follow_user:
        typeof profile.is_business_follow_user === 'boolean'
          ? profile.is_business_follow_user
          : conversation.is_business_follow_user,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('instagram_conversations')
      .update(updates)
      .eq('id', conversation.id)
      .eq('user_id', conversation.user_id)
      .select('*, instagram_bots(bot_name), instagram_messages(message_text,direction,created_at), instagram_leads(*)')
      .single();
    if (error) throw error;
    return data || { ...conversation, ...updates };
  } catch (error) {
    console.warn(
      `[INSTAPILOT] Could not refresh profile for conversation ${conversation.id}:`,
      error.response?.data || error.message
    );
    return conversation;
  }
}

export async function processInstagramWebhook(payload) {
  const events = [];
  for (const entry of payload.entry || []) {
    for (const messaging of entry.messaging || []) {
      if (!messaging.message?.text || messaging.message?.is_echo) continue;
      const senderId = messaging.sender?.id;
      const recipientId = messaging.recipient?.id;
      if (!senderId || !recipientId || senderId === recipientId) continue;
      events.push(await handleInboundMessage({ senderId, recipientId, messaging }));
    }
  }
  return events.filter(Boolean);
}

export function extractLeadDataFromText(text) {
  if (!text || typeof text !== 'string') return {};
  const extracted = {};

  // 1. Phone extraction
  const phoneMatch = text.match(/(?:\+?\d{1,3}[\s-]?)?\(?\d{3,5}\)?[\s-]?\d{3,5}[\s-]?\d{3,5}/);
  if (phoneMatch) {
    const cleaned = phoneMatch[0].replace(/[^\d+]/g, '');
    if (cleaned.length >= 10 && cleaned.length <= 15) {
      extracted.phone = cleaned;
    }
  }

  // 2. Email extraction
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    extracted.email = emailMatch[0].toLowerCase();
  }

  // 3. Name extraction ("My name is John", "Name: Alex", "I am Priyansh")
  const nameMatch = text.match(/(?:my name is|i am|name[:\s]+)\s*([a-zA-Z\s]{2,30})/i);
  if (nameMatch && nameMatch[1]) {
    const name = nameMatch[1].trim();
    if (name && !['here', 'the', 'a', 'not', 'user'].includes(name.toLowerCase())) {
      extracted.name = name;
    }
  }

  // 4. City extraction ("I live in Bhopal", "City: Mumbai", "from Delhi")
  const cityMatch = text.match(/(?:i live in|from|city[:\s]+)\s*([a-zA-Z\s]{2,20})/i);
  if (cityMatch && cityMatch[1]) {
    const city = cityMatch[1].trim();
    if (city && !['here', 'the', 'a', 'india'].includes(city.toLowerCase())) {
      extracted.city = city;
    }
  }

  return extracted;
}

async function handleInboundMessage({ senderId, recipientId, messaging }) {
  const account = await findAccountByRecipient(recipientId);
  if (!account) return { skipped: true, reason: 'account_not_found' };
  const bot = await findActiveBotForAccount(account.id);
  const conversation = await upsertConversation(account, bot, senderId);
  const text = messaging.message.text;
  const metaMessageId = messaging.message.mid || null;

  // Extract and save lead details (Phone, Email, Name, City) automatically
  const extractedLead = extractLeadDataFromText(text);
  if (Object.keys(extractedLead).length > 0) {
    const mergedLeadData = {
      ...(conversation.lead_data || {}),
      ...extractedLead,
    };
    conversation.lead_data = mergedLeadData;

    await supabase
      .from('instagram_conversations')
      .update({ lead_data: mergedLeadData, updated_at: new Date().toISOString() })
      .eq('id', conversation.id);

    await supabase.from('instagram_leads').upsert(
      {
        user_id: account.user_id,
        bot_id: bot?.id || null,
        conversation_id: conversation.id,
        name: mergedLeadData.name || conversation.instagram_name || null,
        phone: mergedLeadData.phone || null,
        email: mergedLeadData.email || null,
        city: mergedLeadData.city || null,
        status: 'captured',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'conversation_id' }
    );
  }

  const existingInbound = await findExistingInboundMessage({
    accountId: account.id,
    senderId,
    recipientId,
    text,
    metaMessageId,
  });
  if (existingInbound) {
    return { skipped: true, reason: 'duplicate_inbound_message', messageId: existingInbound.id };
  }

  const { error: inboundError } = await supabase.from('instagram_messages').insert({
    user_id: account.user_id,
    bot_id: bot?.id || null,
    instagram_account_id: account.id,
    conversation_id: conversation.id,
    sender_id: senderId,
    recipient_id: recipientId,
    message_text: text,
    direction: 'inbound',
    raw_payload: messaging,
  });
  if (inboundError) console.error('❌ Failed to insert INBOUND message:', inboundError);

  if (!bot || conversation.bot_paused || conversation.status === 'human_active' || conversation.status === 'closed') {
    return { skipped: true, reason: 'bot_inactive_or_paused' };
  }

  if (needsHandoff(bot, text) || conversation.failure_count >= 5) {
    await supabase.from('instagram_conversations').update({ status: 'human_needed' }).eq('id', conversation.id);
    return { skipped: true, reason: 'human_handoff' };
  }

  const quotaBot = await resetAndCheckBotQuota(bot);
  if (!quotaBot.canSend) {
    await supabase.from('instagram_conversations').update({ status: 'human_needed' }).eq('id', conversation.id);
    return { skipped: true, reason: 'daily_reply_limit_reached' };
  }

  const reply = await generateReply({ bot, messageText: text, conversation });
  // Only increment failure_count on low confidence - don't lock the conversation immediately.
  // The bot will be handed off only when failure_count reaches the threshold above.
  if (reply.handoff) {
    await supabase
      .from('instagram_conversations')
      .update({ failure_count: (conversation.failure_count || 0) + 1 })
      .eq('id', conversation.id);
  }

  let sendText = reply.handoff ? bot.fallback_message || DEFAULT_REPLY : reply.text;

  let usage = { allowed: true };
  try {
    usage = await consumeUsage(
      account.user_id,
      'autodm_replies_per_month',
      1,
      'month',
    );
  } catch (err) {
    console.warn('[INSTAPILOT] Entitlement check warning, proceeding with reply:', err.message);
  }

  if (!usage.allowed) {
    return { skipped: true, reason: 'monthly_reply_limit_reached' };
  }
  const isFreePlan = usage.entitlements?.plan?.id === 'free';
  const watermark = '_⚡ Automation is powered by @Getaipilot_';

  // Send main message
  try {
    await sendInstagramMessage({ account, recipientId: senderId, text: sendText, messagingType: 'RESPONSE' });
    await supabase.from('instagram_messages').insert({
      user_id: account.user_id,
      bot_id: bot.id,
      instagram_account_id: account.id,
      conversation_id: conversation.id,
      sender_id: recipientId,
      recipient_id: senderId,
      message_text: sendText,
      direction: 'outbound',
      ai_generated: true,
      confidence_score: reply.confidence,
      status: 'sent',
    });

    // Send watermark as separate message if free plan
    if (isFreePlan) {
      try {
        await sendInstagramMessage({ account, recipientId: senderId, text: watermark, messagingType: 'RESPONSE' });
        await supabase.from('instagram_messages').insert({
          user_id: account.user_id,
          bot_id: bot.id,
          instagram_account_id: account.id,
          conversation_id: conversation.id,
          sender_id: recipientId,
          recipient_id: senderId,
          message_text: watermark,
          direction: 'outbound',
          ai_generated: true,
          confidence_score: reply.confidence,
          status: 'sent',
        });
      } catch (watermarkError) {
        console.warn('[INSTAPILOT] Failed to send watermark message:', watermarkError.message);
      }
    }
  } catch (sendErr) {
    console.error('❌ [INSTAPILOT] Failed to send Instagram DM reply:', sendErr.response?.data || sendErr.message);
    return { skipped: true, reason: 'send_message_failed', error: sendErr.response?.data?.error?.message || sendErr.message };
  }

  await supabase
    .from('instagram_bots')
    .update({ replies_sent_today: quotaBot.repliesSentToday + 1 })
    .eq('id', bot.id);
  await maybeCaptureLead(bot, conversation.id, account.user_id, text);
  return { sent: true, conversationId: conversation.id };
}

export async function sendInstagramMessage({ account, recipientId, text, messagingType = 'RESPONSE' }) {
  const accessToken = await getPageTokenForAccount(account);
  const graphBase = getGraphBaseForToken(accessToken);
  const { data } = await axios.post(
    `${graphBase}/${account.page_id}/messages`,
    {
      recipient: { id: recipientId },
      messaging_type: messagingType,
      message: { text: String(text).slice(0, 1000) },
    },
    {
      headers: accessToken.startsWith('IG') ? { Authorization: `Bearer ${accessToken}` } : undefined,
      params: accessToken.startsWith('IG') ? undefined : { access_token: accessToken },
    }
  );
  return data;
}

async function resetAndCheckBotQuota(bot) {
  const today = new Date().toISOString().slice(0, 10);
  let repliesSentToday = bot.replies_sent_today || 0;
  if (bot.last_reply_quota_reset !== today) {
    repliesSentToday = 0;
    await supabase
      .from('instagram_bots')
      .update({ replies_sent_today: 0, last_reply_quota_reset: today })
      .eq('id', bot.id);
  }
  return {
    canSend: repliesSentToday < Number(bot.daily_reply_limit || 250),
    repliesSentToday,
  };
}

async function maybeCaptureLead(bot, conversationId, userId, text) {
  const lead = {};
  const email = String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = String(text).match(/(?:\+?\d[\d\s-]{7,}\d)/)?.[0];
  if (email) lead.email = email;
  if (phone) lead.phone = phone;
  if (!Object.keys(lead).length) return;
  await supabase
    .from('instagram_leads')
    .upsert({ user_id: userId, bot_id: bot.id, conversation_id: conversationId, ...lead }, { onConflict: 'conversation_id' });
}

export async function listConversations(userId) {
  const { data, error } = await supabase
    .from('instagram_conversations')
    .select('*, instagram_bots(bot_name), instagram_messages(message_text,direction,created_at)')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return Promise.all((data || []).map(refreshConversationProfile));
}

export async function getConversation(userId, conversationId) {
  let { data: conversation, error } = await supabase
    .from('instagram_conversations')
    .select('*, instagram_leads(*)')
    .eq('user_id', userId)
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw error;
  if (conversation) {
    conversation = await refreshConversationProfile(conversation);
  }
  const { data: messages, error: messagesError } = await supabase
    .from('instagram_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (messagesError) throw messagesError;
  return { conversation, messages: messages || [] };
}

export async function manualReply(userId, conversationId, text) {
  const { conversation } = await getConversation(userId, conversationId);
  if (!conversation) throw new Error('Conversation not found');
  const account = await getOwnedAccount(userId, conversation.instagram_account_id);
  await sendInstagramMessage({ account, recipientId: conversation.instagram_user_id, text, messagingType: 'RESPONSE' });
  const { data, error } = await supabase
    .from('instagram_messages')
    .insert({
      user_id: userId,
      bot_id: conversation.bot_id,
      instagram_account_id: conversation.instagram_account_id,
      conversation_id: conversationId,
      sender_id: account.instagram_business_account_id,
      recipient_id: conversation.instagram_user_id,
      message_text: text,
      direction: 'outbound',
      status: 'sent',
    })
    .select('*')
    .single();
  if (error) throw error;
  await supabase.from('instagram_conversations').update({ status: 'human_active', bot_paused: true }).eq('id', conversationId);
  await audit(userId, 'manual_reply', 'instagram_conversation', conversationId);
  return data;
}

export async function updateConversation(userId, conversationId, payload) {
  const allowed = ['status', 'assigned_to', 'bot_paused', 'failure_count', 'labels', 'notes', 'lead_data'];
  const updates = Object.fromEntries(Object.entries(payload || {}).filter(([key]) => allowed.includes(key)));
  const { data, error } = await supabase
    .from('instagram_conversations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function getAnalytics(userId) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [conversations, botReplies, handoffs, leads, unanswered] = await Promise.all([
    supabase.from('instagram_conversations').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since),
    supabase.from('instagram_messages').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('direction', 'outbound').eq('ai_generated', true).gte('created_at', since),
    supabase.from('instagram_conversations').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'human_needed').gte('created_at', since),
    supabase.from('instagram_leads').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since),
    supabase.from('instagram_messages').select('id', { count: 'exact', head: true }).eq('user_id', userId).lt('confidence_score', 0.68).gte('created_at', since),
  ]);
  return {
    totalConversations: conversations.count || 0,
    botReplies: botReplies.count || 0,
    humanHandoffs: handoffs.count || 0,
    leadsCaptured: leads.count || 0,
    unansweredQuestions: unanswered.count || 0,
    conversionRate: conversations.count ? Math.round(((leads.count || 0) / conversations.count) * 100) : 0,
  };
}

async function audit(userId, action, entityType, entityId, metadata = {}) {
  await supabase.from('instagram_audit_logs').insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
}
