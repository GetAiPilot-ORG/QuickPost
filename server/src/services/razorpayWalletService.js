import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ override: true });

function getRazorpayCredentials() {
  dotenv.config({ override: true });

  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

  return {
    keyId,
    keySecret,
  };
}

/**
 * Create an order on Razorpay for wallet deposit
 */
export async function createRazorpayOrder({ amount, currency = 'INR', receipt = '' }) {
  const { keyId, keySecret } = getRazorpayCredentials();

  if (!keyId || !keySecret) {
    throw new Error('Razorpay keys (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are missing from server environment.');
  }

  // Razorpay accepts amount in paise (1 INR = 100 paise)
  const amountInPaise = Math.round(Number(amount) * 100);

  if (isNaN(amountInPaise) || amountInPaise < 100) {
    throw new Error('Minimum deposit amount is ₹1.00');
  }

  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  try {
    const response = await axios.post(
      'https://api.razorpay.com/v1/orders',
      {
        amount: amountInPaise,
        currency,
        receipt: receipt || `rcpt_wallet_${Date.now()}`,
        payment_capture: 1,
      },
      {
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    return {
      orderId: response.data.id,
      amount: Number(amount),
      currency: response.data.currency,
      keyId,
    };
  } catch (error) {
    const details = error.response?.data?.error?.description || error.response?.data?.error || error.message;
    console.error('[Razorpay Order Creation Error]:', details);
    throw new Error(typeof details === 'object' ? JSON.stringify(details) : details);
  }
}

/**
 * Verify Razorpay payment signature
 */
export function verifyRazorpayPaymentSignature({ orderId, paymentId, signature }) {
  const { keySecret } = getRazorpayCredentials();

  if (!keySecret) {
    throw new Error('Razorpay Key Secret is missing.');
  }

  if (!orderId || !paymentId || !signature) {
    return false;
  }

  const generatedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return generatedSignature === signature;
}
