import assert from "node:assert/strict";
import test from "node:test";
import {
	createObserverBackgroundQueue,
	type ObserverBackgroundJobResult,
} from "../src/observer-background-queue.ts";

interface TestJob {
	readonly id: string;
}

function nextTask(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve));
}

function abortableGate(
	signal: AbortSignal,
): Promise<ObserverBackgroundJobResult> {
	return new Promise((resolve) => {
		if (signal.aborted) {
			resolve({ status: "aborted" });
			return;
		}
		signal.addEventListener("abort", () => resolve({ status: "aborted" }), {
			once: true,
		});
	});
}

test("Observer background queue runs one job at a time and deduplicates identities", async () => {
	let active = 0;
	let maximumActive = 0;
	const completed: string[] = [];
	const queue = createObserverBackgroundQueue<TestJob>({
		async run(job) {
			active += 1;
			maximumActive = Math.max(maximumActive, active);
			await nextTask();
			completed.push(job.id);
			active -= 1;
			return { status: "completed" };
		},
	});

	assert.equal(queue.enqueue({ id: "one" }), true);
	assert.equal(queue.enqueue({ id: "one" }), false);
	assert.equal(queue.enqueue({ id: "two" }), true);
	assert.deepEqual(queue.snapshot(), {
		state: "paused",
		queued: 2,
		activeJobId: null,
	});
	queue.resume();
	await nextTask();
	await nextTask();
	await nextTask();

	assert.equal(maximumActive, 1);
	assert.deepEqual(completed, ["one", "two"]);
	assert.deepEqual(queue.snapshot(), {
		state: "idle",
		queued: 0,
		activeJobId: null,
	});
});

test("bounded overflow defers the evicted job instead of dropping it silently", async () => {
	const settled: string[] = [];
	const queue = createObserverBackgroundQueue<TestJob>({
		maximumQueued: 2,
		run() {
			return Promise.resolve({ status: "completed" });
		},
		settled(job, result) {
			settled.push(`${job.id}:${result.status}`);
		},
	});

	queue.enqueue({ id: "oldest" });
	queue.enqueue({ id: "middle" });
	queue.enqueue({ id: "newest" });
	await nextTask();
	assert.equal(queue.snapshot().queued, 2);
	assert.deepEqual(settled, ["oldest:deferred"]);
});

test("provider failures are deferred once instead of retried in the same run", async () => {
	const starts: string[] = [];
	const settled: string[] = [];
	const queue = createObserverBackgroundQueue<TestJob>({
		run(job) {
			starts.push(job.id);
			throw new Error("provider returned an unmapped terminal stop reason");
		},
		settled(job, result) {
			settled.push(
				`${job.id}:${result.status}:${result.status === "deferred" ? result.message : ""}`,
			);
		},
	});

	queue.enqueue({ id: "provider-error" });
	queue.resume();
	await nextTask();
	await nextTask();

	assert.deepEqual(starts, ["provider-error"]);
	assert.deepEqual(settled, [
		"provider-error:deferred:provider returned an unmapped terminal stop reason",
	]);
	assert.equal(queue.snapshot().state, "idle");
});

test("foreground pause aborts and requeues active Observer work", async () => {
	const starts: string[] = [];
	const settled: string[] = [];
	let allowCompletion = false;
	const queue = createObserverBackgroundQueue<TestJob>({
		async run(job, signal) {
			starts.push(job.id);
			if (!allowCompletion) return abortableGate(signal);
			return { status: "completed" };
		},
		settled(job, result) {
			settled.push(`${job.id}:${result.status}`);
		},
	});

	queue.enqueue({ id: "routine" });
	queue.resume();
	await nextTask();
	assert.equal(queue.snapshot().activeJobId, "routine");

	queue.pause();
	await nextTask();
	assert.deepEqual(settled, []);
	assert.equal(queue.snapshot().queued, 1);

	allowCompletion = true;
	queue.resume();
	await nextTask();
	await nextTask();
	assert.deepEqual(starts, ["routine", "routine"]);
	assert.deepEqual(settled, ["routine:completed"]);
});

test("reset rejects stale completion and dispose rejects new work", async () => {
	const settled: string[] = [];
	const queue = createObserverBackgroundQueue<TestJob>({
		run(_job, signal) {
			return abortableGate(signal);
		},
		settled(job) {
			settled.push(job.id);
		},
	});

	queue.enqueue({ id: "stale" });
	queue.resume();
	await nextTask();
	queue.reset();
	await nextTask();
	assert.deepEqual(settled, []);
	assert.deepEqual(queue.snapshot(), {
		state: "paused",
		queued: 0,
		activeJobId: null,
	});

	queue.dispose();
	assert.equal(queue.enqueue({ id: "late" }), false);
	assert.equal(queue.snapshot().state, "disposed");
});
