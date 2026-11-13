interface CommentInput {
  triggerType: string;
  igId: string;
  senderId: string;
  eventId?: string;
  parentId?: string;
  senderUsername?: string;
  externalPayload?: any;
}
interface AccountIdentity {
  id?: string;
  ig_id?: string;
  instagram_user_id?: string;
  instagram_business_account_id?: string;
  webhook_ig_id?: string | null;
  webhook_instagram_user_id?: string | null;
  page_id?: string;
  username?: string | null;
  instagram_username?: string | null;
}
const handle = (value: unknown) => String(value || '').trim().replace(/^@+/, '').toLowerCase();

export function ignoredCommentReason(input: CommentInput, accounts: AccountIdentity[] = []): string | null {
  if (input.triggerType !== 'comment') return null;
  const value = input.externalPayload?.value || input.externalPayload || {};
  const author = value.from || {};
  if (input.parentId || value.parent_id) return 'ignored_nested_reply';
  if (!input.eventId || !input.senderId) return 'ignored_invalid_comment';
  if (author.self_ig_scoped_id || input.senderId === input.igId || author.id === input.igId) return 'ignored_self_action';
  const senderIds = [input.senderId, author.id].filter(Boolean).map(String);
  const senderHandles = [input.senderUsername, author.username].map(handle).filter(Boolean);
  if (accounts.some(account => {
    const ids = [account.ig_id, account.instagram_user_id, account.instagram_business_account_id,
      account.webhook_ig_id, account.webhook_instagram_user_id, account.page_id].filter(Boolean).map(String);
    const handles = [account.instagram_username, account.username].map(handle).filter(Boolean);
    return senderIds.some(id => ids.includes(id)) || senderHandles.some(name => handles.includes(name));
  })) return 'ignored_self_action';
  return null;
}

export function webhookEventIdentity(event: { eventType: string; eventId: string; igId: string; senderId: string }) {
  return event.eventType === 'comments'
    ? ['instagram-comment', event.eventId]
    : [event.igId, event.senderId, event.eventType, event.eventId];
}

interface ClaimStore {
  from(table: string): { insert(row: Record<string, unknown>): PromiseLike<{ error: { code?: string; message: string } | null }> };
}
export async function claimCommentDelivery(db: ClaimStore, commentId: string, accountId: string, automationId: string): Promise<boolean> {
  const { error } = await db.from('autodm_comment_claims').insert({
    comment_id: commentId, instagram_account_id: accountId, automation_id: automationId,
  });
  if (error?.code === '23505') return false;
  if (error) throw new Error(`Unable to claim comment delivery: ${error.message}`);
  return true;
}
