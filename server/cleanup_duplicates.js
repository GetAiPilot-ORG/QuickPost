import 'dotenv/config';
import supabase from './src/services/supabase.js';

async function cleanupDuplicates() {
  const { data: messages, error } = await supabase
    .from('instagram_messages')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return;
  }

  console.log(`Found ${messages.length} total messages.`);
  const seenMids = new Set();
  const seenReplies = new Map();
  const toDelete = [];

  for (const msg of messages) {
    const mid = msg.raw_payload?.message?.mid;
    if (msg.direction === 'inbound') {
      if (mid) {
        if (seenMids.has(mid)) {
          toDelete.push(msg.id);
          continue;
        }
        seenMids.add(mid);
      }
    } else if (msg.direction === 'outbound') {
      const key = `${msg.conversation_id}`;
      const time = new Date(msg.created_at).getTime();
      if (seenReplies.has(key)) {
        const lastTime = seenReplies.get(key);
        if (Math.abs(time - lastTime) < 15000) { // within 15 seconds
          toDelete.push(msg.id);
          continue;
        }
      }
      seenReplies.set(key, time);
    }
  }

  console.log(`Total duplicate messages to delete: ${toDelete.length}`);
  if (toDelete.length > 0) {
    const { error: delError } = await supabase
      .from('instagram_messages')
      .delete()
      .in('id', toDelete);
    if (delError) {
      console.error('Error deleting duplicates:', delError);
    } else {
      console.log('✅ Successfully cleaned up duplicate messages!');
    }
  }
}

cleanupDuplicates().catch(console.error);
