import supabase from './supabase.js';
import { createOrder, getOrderStatus } from './smmService.js';

let isProcessingQueue = false;
let isUpdatingStatuses = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Process all queued SMM orders one-by-one with controlled pacing
 */
export async function processSmmOrderQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    // 1. Fetch pending queued orders
    const { data: queuedOrders, error } = await supabase
      .from('sg_orders')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(20);

    if (error) {
      console.error('[SMM Queue Worker] Error fetching queued orders:', error);
      return;
    }

    if (!queuedOrders || queuedOrders.length === 0) {
      return;
    }

    console.log(`[SMM Queue Worker] Processing ${queuedOrders.length} queued order(s)...`);

    for (const order of queuedOrders) {
      try {
        // Mark as processing
        await supabase
          .from('sg_orders')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', order.id);

        // Place order on TeleSMM
        const smmResult = await createOrder({
          service: order.service_id,
          link: order.target_link,
          quantity: order.quantity,
        });

        const providerOrderId = String(smmResult.order || '');

        // Update with success
        await supabase
          .from('sg_orders')
          .update({
            provider_order_id: providerOrderId,
            status: 'in_progress',
            provider_status: 'Pending',
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id);

        console.log(`[SMM Queue Worker] ✅ Order ${order.id} placed on TeleSMM. Provider Order ID: ${providerOrderId}`);
      } catch (orderErr) {
        const errorMsg = orderErr.message || 'Provider rejected order';
        console.error(`[SMM Queue Worker] ❌ Order ${order.id} failed:`, errorMsg);

        // 1. Update order as failed
        await supabase
          .from('sg_orders')
          .update({
            status: 'failed',
            error_message: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id);

        // 2. Automatically refund user's wallet!
        try {
          const { error: refundErr } = await supabase.rpc('sg_refund_failed_order', {
            p_user_id: order.user_id,
            p_amount: order.total_cost,
            p_order_id: order.id,
            p_reason: `Refund: Order failed - ${errorMsg}`,
          });

          if (refundErr) {
            console.error(`[SMM Queue Worker] ⚠️ Failed to auto-refund order ${order.id}:`, refundErr);
          } else {
            console.log(`[SMM Queue Worker] 💰 Auto-refunded ${order.total_cost} to user ${order.user_id} for failed order ${order.id}`);
          }
        } catch (refundException) {
          console.error('[SMM Queue Worker] Exception during auto-refund:', refundException);
        }
      }

      // Respect TeleSMM rate limits with 400ms delay between consecutive requests
      await sleep(400);
    }
  } catch (err) {
    console.error('[SMM Queue Worker] Unexpected error processing queue:', err);
  } finally {
    isProcessingQueue = false;
  }
}

/**
 * Periodically refresh status of in-progress orders from TeleSMM
 */
export async function syncActiveOrderStatuses() {
  if (isUpdatingStatuses) return;
  isUpdatingStatuses = true;

  try {
    const { data: activeOrders, error } = await supabase
      .from('sg_orders')
      .select('id, provider_order_id, user_id, total_cost')
      .in('status', ['in_progress', 'processing'])
      .not('provider_order_id', 'is', null)
      .limit(30);

    if (error || !activeOrders || activeOrders.length === 0) return;

    for (const order of activeOrders) {
      try {
        const statusRes = await getOrderStatus(order.provider_order_id);
        if (statusRes && statusRes.status) {
          const rawStatus = (statusRes.status || '').toLowerCase();
          let finalStatus = 'in_progress';

          if (rawStatus === 'completed') finalStatus = 'completed';
          else if (rawStatus === 'canceled' || rawStatus === 'cancelled') finalStatus = 'canceled';
          else if (rawStatus === 'partial') finalStatus = 'partial';

          await supabase
            .from('sg_orders')
            .update({
              status: finalStatus,
              provider_status: statusRes.status,
              remains: parseInt(statusRes.remains, 10) || 0,
              updated_at: new Date().toISOString(),
            })
            .eq('id', order.id);

          // If provider canceled order, refund the user
          if (finalStatus === 'canceled') {
            await supabase.rpc('sg_refund_failed_order', {
              p_user_id: order.user_id,
              p_amount: order.total_cost,
              p_order_id: order.id,
              p_reason: `Refund: Order canceled by provider (${statusRes.status})`,
            });
          }
        }
      } catch (e) {
        // Silent skip individual status poll error
      }
      await sleep(250);
    }
  } catch (err) {
    console.error('[SMM Queue Worker] Error syncing order statuses:', err);
  } finally {
    isUpdatingStatuses = false;
  }
}

/**
 * Start Background Loop for Queue and Status Sync
 */
export function startSmmQueueWorker() {
  console.log('🚀 [SMM Queue Worker] Background worker initialized.');

  // Process queued orders every 4 seconds
  setInterval(async () => {
    try {
      await processSmmOrderQueue();
    } catch (e) {
      console.error('[SMM Queue Worker] Interval error:', e);
    }
  }, 4000);

  // Sync active order statuses every 2 minutes
  setInterval(async () => {
    try {
      await syncActiveOrderStatuses();
    } catch (e) {
      console.error('[SMM Status Sync] Interval error:', e);
    }
  }, 2 * 60 * 1000);
}
