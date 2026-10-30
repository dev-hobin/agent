// Token bucket. Refill is computed lazily on each call instead of on a timer.
export function createBucket({ capacity, refillPerSecond, now = () => Date.now() }) {
	if (!(capacity > 0)) throw new RangeError("capacity must be positive");
	if (!(refillPerSecond >= 0)) throw new RangeError("refillPerSecond must not be negative");

	let tokens = capacity;
	let last = now();

	function refill() {
		const current = now();
		// A clock that moves backwards adds nothing instead of removing tokens.
		const elapsed = Math.max(0, current - last) / 1000;
		tokens = Math.min(capacity, tokens + elapsed * refillPerSecond);
		last = current;
	}

	return {
		take(cost = 1) {
			refill();
			if (cost > tokens) return false;
			tokens -= cost;
			return true;
		},
		available() {
			refill();
			return tokens;
		},
	};
}
