import apiClient from "@/utils/apiClient";

export async function fetchInstagramAccounts() {
  const { data } = await apiClient.get("/api/instapilot/accounts");
  return data.accounts || [];
}

export async function importSocialInstagramAccount() {
  const { data } = await apiClient.post("/api/instapilot/accounts/import-social-instagram");
  return data.account;
}

export async function disconnectInstagramAccount(accountId: string) {
  await apiClient.delete(`/api/instapilot/accounts/${accountId}`);
}

export async function subscribeInstagramWebhook(accountId: string) {
  const { data } = await apiClient.post(`/api/instapilot/accounts/${accountId}/subscribe-webhooks`);
  return data.result;
}

export async function fetchInstagramBots() {
  const { data } = await apiClient.get("/api/instapilot/bots");
  return data.bots || [];
}

export async function createInstagramBot(payload: Record<string, unknown>) {
  const { data } = await apiClient.post("/api/instapilot/bots", payload);
  return data.bot;
}

export async function updateInstagramBot(botId: string, payload: Record<string, unknown>) {
  const { data } = await apiClient.patch(`/api/instapilot/bots/${botId}`, payload);
  return data.bot;
}

export async function deleteInstagramBot(botId: string) {
  await apiClient.delete(`/api/instapilot/bots/${botId}`);
}

export async function fetchKnowledgeSources(botId: string) {
  const { data } = await apiClient.get(`/api/instapilot/bots/${botId}/knowledge`);
  return data.sources || [];
}

export async function addKnowledgeSource(payload: Record<string, unknown>) {
  const { data } = await apiClient.post("/api/instapilot/knowledge", payload);
  return data.source;
}

export async function updateKnowledgeSource(sourceId: string, payload: Record<string, unknown>) {
  const { data } = await apiClient.patch(`/api/instapilot/knowledge/${sourceId}`, payload);
  return data.source;
}

export async function deleteKnowledgeSource(sourceId: string) {
  await apiClient.delete(`/api/instapilot/knowledge/${sourceId}`);
}

export async function testInstagramBotReply(botId: string, message: string) {
  const { data } = await apiClient.post(`/api/instapilot/bots/${botId}/test-reply`, { message });
  return data.reply;
}

export async function fetchInboxConversations() {
  const { data } = await apiClient.get("/api/instapilot/inbox/conversations");
  return data.conversations || [];
}

export async function fetchConversationThread(conversationId: string) {
  const { data } = await apiClient.get(`/api/instapilot/inbox/conversations/${conversationId}`);
  return data;
}

export async function updateConversation(conversationId: string, payload: Record<string, unknown>) {
  const { data } = await apiClient.patch(`/api/instapilot/inbox/conversations/${conversationId}`, payload);
  return data.conversation;
}

export async function sendManualInstagramReply(conversationId: string, message: string) {
  const { data } = await apiClient.post(`/api/instapilot/inbox/conversations/${conversationId}/reply`, { message });
  return data.message;
}

export async function fetchInstagramAnalytics() {
  const { data } = await apiClient.get("/api/instapilot/analytics");
  return data.analytics;
}
