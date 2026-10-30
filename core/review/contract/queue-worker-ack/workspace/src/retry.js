export const DEFAULT_ATTEMPTS = 3;

// Calls fn until it resolves or attempts run out, doubling the delay each time.
export async function retry(fn, { attempts = DEFAULT_ATTEMPTS, delayMs = 0 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs * 2 ** attempt));
    }
  }
  throw lastError;
}
