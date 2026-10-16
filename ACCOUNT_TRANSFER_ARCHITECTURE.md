# Account Ownership Transfer & Anti-Abuse Architecture

> **Status**: Scheduled for implementation after Meta App Review completion.  
> **Target Systems**: Social Pilot, QuickPost Scheduler, AutoDM, and InstaPilot Bots.

---

## 1. Problem Statement & Motivation

### Current State
1. **Multi-User Token Collision**: When a user logs in via Meta OAuth (e.g. via Direct IG Login or Facebook Page Selection), the system currently associates the returned Instagram Business Account ID with the active `user_id` without verifying if another workspace already owns an active connection to that same handle.
2. **Free-Tier Quota Abuse**: Free-tier limits (such as 50 automated DM replies/month or connected social profile quotas) are currently tracked per `user_id`. A user can cycle through disposable email accounts to connect the same Instagram handle repeatedly to bypass monthly limits.
3. **Webhook & Bot Collision**: When Meta sends webhook events (incoming DMs or comments) for an Instagram ID that is connected to multiple user accounts, the automation engine orders by `updated_at DESC`, resulting in fragmented message delivery and unpredictable bot responses.

---

## 2. Solution: Seamless Ownership Transfer & Claiming Flow

When a user attempts to connect an Instagram or Facebook account that is already linked to another workspace, the platform will **not crash or silently create duplicates**. Instead, it triggers an explicit **Account Transfer Confirmation Flow**:

```
                  User authenticates via Meta OAuth
                                │
                                ▼
               Check Database (instagram_accounts / social_tokens):
               Is this account currently connected to another user?
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
                   [NO]                    [YES]
              Direct Connect         Show Transfer Confirmation Modal:
                                     "@username is linked to another workspace.
                                      Transferring will disconnect the old workspace.
                                      [Cancel]   [Proceed & Transfer]"
                                                │
                                    ┌───────────┴───────────┐
                                    ▼                       ▼
                                [Cancel]            [Confirm Transfer]
                             Keep old owner        1. Disconnect & purge cache for old user
                                                   2. Update/insert tokens for new user
                                                   3. Update webhook routing to new user
                                                   4. Sync AutoDM & InstaPilot seamlessly
```

---

## 3. Detailed Component Implementation Guide

### A. Backend OAuth & Account Transfer (`server/src/routes/auth.js`)

1. **Pending Selection Route (`POST /api/auth/pending-selection/:id`)**:
   - Accept optional parameter `forceTransfer: boolean` (default `false`).
   - Check if any selected page or Instagram business account is active on another `user_id`:
     ```javascript
     const { data: existingOwners } = await supabase
       .from('social_tokens')
       .select('user_id, username, account_id')
       .eq('provider', provider)
       .eq('account_id', page.pageId)
       .neq('user_id', req.user.userId);
     ```
   - If occupied and `!forceTransfer`:
     - Return HTTP `409 Conflict` with:
       ```json
       {
         "success": false,
         "code": "ACCOUNT_OCCUPIED",
         "occupiedAccount": {
           "id": page.pageId,
           "username": page.name || page.username
         },
         "message": "This account is already connected to another workspace."
       }
       ```
   - If occupied and `forceTransfer === true`:
     1. Mark the old owner's `instagram_accounts` row:
        ```javascript
        await supabase
          .from('instagram_accounts')
          .update({ is_connected: false, token_status: 'transferred', updated_at: new Date().toISOString() })
          .eq('instagram_business_account_id', page.pageId)
          .neq('user_id', req.user.userId);
        ```
     2. Remove or deactivate old owner's `social_tokens` row.
     3. Purge caches:
        ```javascript
        clearTokensCache(oldUserId);
        await invalidateInboxCache([oldUserId, req.user.userId]);
        ```
     4. Save fresh credentials for `req.user.userId`.

---

### B. Direct Instagram OAuth Edge Function (`supabase/functions/oauth-callback/index.ts`)

1. **Duplicate Detection Before Insert**:
   - Query `instagram_accounts` for active connections with a different `user_id`:
     ```typescript
     const { data: existingActive } = await supabase
       .from('instagram_accounts')
       .select('user_id, instagram_username')
       .eq('instagram_business_account_id', igUser.id)
       .eq('is_connected', true)
       .neq('user_id', appUserId)
       .maybeSingle();
     ```
2. **Transfer Logic**:
   - If `existingActive` exists:
     - Check if the OAuth state payload contains `transfer_confirmed: true`.
     - If `transfer_confirmed === true`:
       - Disconnect previous owner (`is_connected = false`).
       - Save token for `appUserId`.
     - If not confirmed:
       - Redirect to `/connect/transfer-confirm?igId=${igUser.id}&username=${encodeURIComponent(igUser.username)}&stateToken=...`

---

### C. Frontend Transfer Confirmation UI

#### 1. Transfer Confirmation Modal Component (`client/src/components/connect/TransferConfirmModal.jsx`)
- **Title**: Transfer Instagram Account Ownership?
- **Body**:
  > *"**@username** is currently active in another QuickPost workspace. Connecting it here will disconnect it from that workspace and route all incoming messages, automations, and scheduled posts to this account."*
- **Actions**:
  - `[Cancel]`: Aborts connection and redirects to `/connect`.
  - `[Proceed & Transfer Account]`: Re-submits connection request with `forceTransfer: true`.

#### 2. Connect Selection Page (`client/src/pages/connect/SelectAccountsPage.jsx`)
- Listen for `ACCOUNT_OCCUPIED` error from `/api/auth/pending-selection/:id`.
- Automatically open the `TransferConfirmModal` and allow one-click confirmation.

---

### D. AutoDM & InstaPilot Synchronization Safety

#### `server/src/services/autodm.js` (`importInstagramAccountToAutoDM`):
- When importing a transferred account, deactivate any conflicting records for the previous user in AutoDM.
- Re-register the webhook subscription for the new user.

#### `server/src/services/instapilot.js` (`importConnectedInstagram`):
- Update duplicate checks so that if the account was cleanly transferred in Social Pilot, InstaPilot accepts the transfer rather than throwing a raw 409 error.

---

### E. Quota & Free Plan Abuse Prevention

To prevent multi-email quota cycling:
1. **Quota Key Anchoring**:
   - Free-tier reply quotas should be keyed by `(instagram_account_id, month)` in addition to `user_id`.
   - Even if a user disconnects and reconnects `@mybrand` under a different email, the Instagram Account ID has already consumed its monthly 50 free replies.

---

## 4. Post-Review Testing & Verification Checklist

- [ ] **Test Case 1 (Fresh Connect)**: Connect a new Instagram account that has never been connected before. Confirm it links immediately.
- [ ] **Test Case 2 (Duplicate Block & Modal)**: Log in with Account B and connect `@cricboss121` (already connected on Account A). Verify that the Transfer Confirmation Dialog appears.
- [ ] **Test Case 3 (Transfer Confirmation)**: Click "Proceed & Transfer":
  - Verify `@cricboss121` is active on Account B.
  - Verify Account A's Social Inbox displays the amber Disconnected Read-Only banner.
  - Verify Account A cannot send replies to the disconnected account.
  - Verify Account B can send replies and manage automations.
- [ ] **Test Case 4 (Quota Persistence)**: Verify that free-tier monthly message limits persist across account transfers.
