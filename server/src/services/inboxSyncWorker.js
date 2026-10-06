import supabase from './supabase.js';

export async function syncAutoDMMessageToInbox(msg) {
  if (!msg || !msg.user_id) return null;

  try {
    // 1. Fetch Contact
    let contact = null;
    if (msg.contact_id) {
      const { data: c } = await supabase
        .from('contacts')
        .select('id, user_id, instagram_user_id, username, full_name, profile_picture_url')
        .eq('id', msg.contact_id)
        .maybeSingle();
      contact = c;
    }

    // Fallback if contact wasn't found by id
    const externalIdFromMsg = msg.sender_id || msg.recipient_id || null;
    if (!contact && externalIdFromMsg && msg.user_id) {
      const { data: c } = await supabase
        .from('contacts')
        .select('id, user_id, instagram_user_id, username, full_name, profile_picture_url')
        .eq('user_id', msg.user_id)
        .eq('instagram_user_id', String(externalIdFromMsg))
        .maybeSingle();
      contact = c;
    }

    const contactSenderId = contact?.instagram_user_id ? String(contact.instagram_user_id) : (externalIdFromMsg ? String(externalIdFromMsg) : null);
    if (!contactSenderId) return null;

    const contactHandle = contact?.username ? (contact.username.startsWith('@') ? contact.username : `@${contact.username}`) : null;
    const contactName = contact?.full_name || contact?.username || `Instagram user ${contactSenderId}`;
    const contactAvatar = contact?.profile_picture_url || null;

    // 2. Fetch Instagram Account
    let accountId = null;
    let accountName = 'Instagram Account';

    if (msg.instagram_account_id) {
      const { data: igAcc } = await supabase
        .from('instagram_accounts')
        .select('id, instagram_business_account_id, page_id, username, instagram_username')
        .eq('id', msg.instagram_account_id)
        .maybeSingle();

      if (igAcc) {
        accountId = igAcc.instagram_business_account_id || igAcc.page_id || igAcc.id;
        accountName = igAcc.username || igAcc.instagram_username || accountName;
      }
    }

    if (!accountId) {
      const { data: socialAcc } = await supabase
        .from('social_tokens')
        .select('account_id, page_id, instagram_business_id, username, account_name')
        .eq('user_id', msg.user_id)
        .eq('provider', 'instagram')
        .limit(1)
        .maybeSingle();

      if (socialAcc) {
        accountId = socialAcc.instagram_business_id || socialAcc.account_id || socialAcc.page_id;
        accountName = socialAcc.username || socialAcc.account_name || accountName;
      }
    }

    if (!accountId) accountId = 'default_instagram';

    // 3. Parse Message Content
    let bodyText = msg.content || '';
    let imageUrl = msg.media_url || null;
    let buttons = [];
    let isInteractiveCard = false;

    if (bodyText.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(bodyText);
        if (parsed.elements && Array.isArray(parsed.elements)) {
          const el = parsed.elements[0] || {};
          bodyText = el.title || '';
          if (el.subtitle) bodyText += '\n' + el.subtitle;
          if (!imageUrl && el.image_url) imageUrl = el.image_url;
          if (el.buttons && Array.isArray(el.buttons)) buttons = el.buttons;
          isInteractiveCard = true;
        }
      } catch (e) {
        // keep as is
      }
    }

    if (!imageUrl && bodyText) {
      const imgMatch = bodyText.match(/(https?:\/\/[^\s]+(?:\.(?:png|jpg|jpeg|webp|gif)|res\.cloudinary\.com\/[^\s]+)[^\s]*)/i);
      if (imgMatch) imageUrl = imgMatch[0];
    }

    const createdAt = msg.created_at || new Date().toISOString();
    const isSelf = msg.direction === 'outbound';

    // 4. Upsert inbox_conversations
    const { data: inboxConv, error: convError } = await supabase
      .from('inbox_conversations')
      .upsert({
        user_id: msg.user_id,
        platform: 'instagram',
        account_id: String(accountId),
        account_name: accountName,
        external_conversation_id: contactSenderId,
        contact_external_id: contactSenderId,
        contact_name: contactName,
        contact_handle: contactHandle,
        contact_avatar_url: contactAvatar,
        last_message_text: bodyText || (imageUrl ? '📸 Photo' : ''),
        last_message_at: createdAt,
        last_inbound_at: !isSelf ? createdAt : null,
        last_outbound_at: isSelf ? createdAt : null,
        is_replied: isSelf,
        unread_count: 0,
        status: 'open',
      }, { onConflict: 'user_id,platform,account_id,external_conversation_id' })
      .select('id')
      .single();

    if (convError || !inboxConv) {
      console.warn('[INBOX-SYNC] Conversation upsert warning:', convError?.message);
      return null;
    }

    // 5. Upsert inbox_messages
    const externalMessageId = msg.instagram_message_id || `msg-${msg.id}`;
    const { error: msgError } = await supabase
      .from('inbox_messages')
      .upsert({
        user_id: msg.user_id,
        conversation_id: inboxConv.id,
        platform: 'instagram',
        account_id: String(accountId),
        external_message_id: externalMessageId,
        direction: msg.direction,
        body: bodyText,
        media_url: imageUrl,
        message_type: msg.message_type || 'text',
        delivery_status: isSelf ? 'sent' : 'received',
        sent_at: msg.sent_at || createdAt,
        raw_payload: {
          imageUrl,
          buttons,
          isInteractiveCard: isInteractiveCard || Boolean(buttons.length || (imageUrl && isSelf)),
        },
      }, { onConflict: 'user_id,platform,account_id,external_message_id' });

    if (msgError) {
      console.warn('[INBOX-SYNC] Message upsert warning:', msgError.message);
    }

    return inboxConv.id;
  } catch (err) {
    console.error('[INBOX-SYNC] Error syncing AutoDM message to inbox:', err.message);
    return null;
  }
}

