// ============================================================================
// SupermailBox CPaaS Client SDK (ESM JavaScript version for server/src/services)
// Drop this file into any of your 4-5 projects to manage all outbound emails.
// ============================================================================

let econnrefusedWarned = false;
function logSdkError(action, error) {
  if (error.cause?.code === 'ECONNREFUSED' || error.code === 'ECONNREFUSED') {
    if (!econnrefusedWarned) {
      console.warn(`[SupermailBox SDK] ${action} failed: Service not reachable (ECONNREFUSED) - muting further warnings`);
      econnrefusedWarned = true;
    }
  } else if (error instanceof SyntaxError || error.message?.includes('JSON')) {
    console.error(`[SupermailBox SDK] ${action} failed: Received invalid JSON response from server.`);
  } else {
    console.error(`[SupermailBox SDK] ${action} failed:`, error.message || error);
  }
}

export class SupermailboxClient {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey || process.env.SUPERMAILBOX_API_KEY || '';
    this.baseUrl = baseUrl || process.env.SUPERMAILBOX_BASE_URL || 'http://localhost:5050';
  }

  /**
   * 1. Synchronize user profile with SupermailBox central contact repository.
   * Call this on User Signup or Profile Update.
   */
  async syncUser(user) {
    if (process.env.MAIL_ON !== 'true') return { success: true, skipped: true };
    try {
      const response = await fetch(`${this.baseUrl}/v1/contacts/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        body: JSON.stringify({
          productUserId: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          attributes: user.attributes
        })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 100)}`);
      }
      return await response.json();
    } catch (error) {
      logSdkError('Contact sync', error);
      return { success: false };
    }
  }

  /**
   * 2. Dispatch a high-priority transactional email (Payment receipt, OTP, Welcome).
   */
  async sendEmail(request) {
    if (process.env.MAIL_ON !== 'true') return { success: true, skipped: true };
    try {
      const response = await fetch(`${this.baseUrl}/v1/send/transactional`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        body: JSON.stringify({
          to: request.to,
          templateKey: request.templateKey,
          idempotencyKey: request.idempotencyKey || `tx_${Date.now()}_${Math.random()}`,
          productCode: request.productCode || 'socialpilot',
          variables: request.variables || {}
        })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 100)}`);
      }
      return await response.json();
    } catch (error) {
      logSdkError('Send email', error);
      return { success: false };
    }
  }

  /**
   * 3. Launch a bulk/marketing email broadcast with explicit confirmation support.
   * Supports notifyEmail and webhookUrl.
   */
  async sendBroadcast(request) {
    if (process.env.MAIL_ON !== 'true') return { success: true, skipped: true };
    try {
      const response = await fetch(`${this.baseUrl}/v1/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        body: JSON.stringify(request)
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 100)}`);
      }
      return await response.json();
    } catch (error) {
      logSdkError('Send broadcast', error);
      return { success: false };
    }
  }

  /**
   * 4. Helper: Dispatch broadcast summary email when a social post finishes.
   */
  async notifyBroadcastSuccess(params) {
    return this.sendEmail({
      to: params.userEmail,
      templateKey: 'broadcast_notification',
      idempotencyKey: `broadcast_${params.jobId}`,
      variables: {
        campaign_name: 'Broadcast Published successfully',
        full_name: params.userName || params.userEmail,
        email: params.userEmail,
        caption: params.caption?.substring(0, 100) || 'New post published',
        platforms: Array.isArray(params.platforms) ? params.platforms.join(', ') : params.platforms || 'Connected channels'
      }
    });
  }
}

// Singleton export initialized with environment secrets
export const supermailbox = new SupermailboxClient();
