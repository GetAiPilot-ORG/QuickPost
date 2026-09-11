import dotenv from 'dotenv';
import { processInstagramWebhook } from './src/services/instapilot.js';

dotenv.config({ path: './.env' });

async function testCricboss() {
  const payload = {
    entry: [
      {
        messaging: [
          {
            sender: { id: "1540448894454262" },
            recipient: { id: "26280221678336455" }, // baba_tillu.lala page_id
            timestamp: Date.now(),
            message: {
              mid: "test_mid_cricboss_" + Date.now(),
              text: "Heres my mail - priyanshgour817@gmail.com Number is _ 7067612077"
            }
          }
        ]
      }
    ]
  };

  console.log("=== Testing Webhook Execution for cricboss121 lead message ===");
  try {
    const res = await processInstagramWebhook(payload);
    console.log("Webhook result:", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("Webhook execution failed with error:", err);
  }
}

testCricboss();
