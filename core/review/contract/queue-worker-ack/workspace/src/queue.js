// At-least-once queue: a received job stays in flight until ack(id) removes
// it or nack(id) makes it available for redelivery.
export function createQueue(jobs = []) {
  const pending = [...jobs];
  const inFlight = new Map();
  return {
    receive() {
      const job = pending.shift();
      if (job) inFlight.set(job.id, job);
      return job;
    },
    ack(id) {
      inFlight.delete(id);
    },
    nack(id) {
      const job = inFlight.get(id);
      inFlight.delete(id);
      if (job) pending.push(job);
    },
    inFlightCount: () => inFlight.size,
    pendingCount: () => pending.length,
  };
}
