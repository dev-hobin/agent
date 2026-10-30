// In-memory test doubles that follow the contracts in REQUIREMENTS.md.
export function createDeps({ request, order }) {
  const requestsById = new Map([[request.id, { ...request }]]);
  const ordersById = new Map([[order.id, { ...order }]]);
  const refunds = new Map();
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  return {
    requests: {
      async get(id) { await tick(); const r = requestsById.get(id); return r && { ...r }; },
      async update(id, patch, { expectedVersion } = {}) {
        await tick();
        const current = requestsById.get(id);
        if (!current || current.version !== expectedVersion) throw new Error('version conflict');
        const next = { ...current, ...patch, version: current.version + 1 };
        requestsById.set(id, next);
        return { ...next };
      },
    },
    orders: {
      async get(id) { await tick(); const o = ordersById.get(id); return o && { ...o }; },
      async update(id, patch) { await tick(); ordersById.set(id, { ...ordersById.get(id), ...patch }); },
    },
    payments: {
      async issueRefund({ orderId, amountCents, idempotencyKey }) {
        await tick();
        const key = idempotencyKey ?? `anon-${refunds.size}`;
        if (!refunds.has(key)) refunds.set(key, { refundId: `rf-${refunds.size + 1}`, orderId, amountCents });
        return { refundId: refunds.get(key).refundId };
      },
    },
    issued: () => [...refunds.values()],
    request: (id) => requestsById.get(id),
    order: (id) => ordersById.get(id),
  };
}
