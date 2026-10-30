import assert from "node:assert/strict";
import { test } from "node:test";

import { createBucket } from "../src/bucket.js";

function clock(start = 0) {
	let t = start;
	return { now: () => t, advance: (ms) => { t += ms; } };
}

test("starts full and allows a burst up to capacity", () => {
	const c = clock();
	const bucket = createBucket({ capacity: 3, refillPerSecond: 1, now: c.now });
	assert.equal(bucket.take(), true);
	assert.equal(bucket.take(), true);
	assert.equal(bucket.take(), true);
	assert.equal(bucket.take(), false);
});

test("refills over time but never above capacity", () => {
	const c = clock();
	const bucket = createBucket({ capacity: 2, refillPerSecond: 1, now: c.now });
	bucket.take(2);
	c.advance(10_000);
	assert.equal(bucket.available(), 2);
});

test("a rejected take removes nothing", () => {
	const c = clock();
	const bucket = createBucket({ capacity: 2, refillPerSecond: 0, now: c.now });
	assert.equal(bucket.take(3), false);
	assert.equal(bucket.available(), 2);
});
