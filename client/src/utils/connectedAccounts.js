export function countConnectedTargets(accounts = {}) {
  const targets = new Set();
  Object.entries(accounts || {}).forEach(([key, value]) => {
    if (key.endsWith("Accounts")) {
      (Array.isArray(value) ? value : []).forEach((account) => {
        targets.add(`${key}:${account.account_id || account.accountId || account.pageId || account.id}`);
      });
    } else if (
      value?.connected &&
      !accounts?.[`${key}Accounts`]?.length
    ) {
      targets.add(`${key}:${value.account_id || value.accountId || value.page_id || value.pageId || key}`);
    }
  });
  return targets.size;
}
