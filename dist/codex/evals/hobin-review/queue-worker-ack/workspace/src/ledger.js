// Ledger client. A repeated idempotencyKey returns the original receipt
// instead of crediting again.
export function createLedger() {
  const balances = new Map();
  const receipts = new Map();
  return {
    async credit(accountId, amount, { idempotencyKey } = {}) {
      if (idempotencyKey && receipts.has(idempotencyKey)) return receipts.get(idempotencyKey);
      balances.set(accountId, (balances.get(accountId) ?? 0) + amount);
      const receipt = { accountId, amount, key: idempotencyKey ?? null };
      if (idempotencyKey) receipts.set(idempotencyKey, receipt);
      return receipt;
    },
    balance: (accountId) => balances.get(accountId) ?? 0,
  };
}
