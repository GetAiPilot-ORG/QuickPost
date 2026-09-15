export const sseClients = [];

export function broadcastRefresh(source = 'unknown') {
  console.log(`[SSE] broadcastRefresh called from ${source}. Notifying ${sseClients.length} clients.`);
  sseClients.forEach((client) => {
    try {
      client.write('data: refresh\n\n');
    } catch (err) {
      console.warn('Failed to write to SSE client', err);
    }
  });
}
