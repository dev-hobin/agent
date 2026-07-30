export interface ObserverBackgroundJob {
	readonly id: string;
}

export type ObserverBackgroundJobResult =
	| { readonly status: "completed" | "skipped" }
	| { readonly status: "aborted" }
	| { readonly status: "deferred"; readonly message: string };

export interface ObserverBackgroundQueueSnapshot {
	readonly state: "paused" | "idle" | "running" | "disposed";
	readonly queued: number;
	readonly activeJobId: string | null;
}

export interface ObserverBackgroundQueue<Job extends ObserverBackgroundJob> {
	enqueue(job: Job): boolean;
	pause(): void;
	resume(): void;
	reset(): void;
	dispose(): void;
	snapshot(): ObserverBackgroundQueueSnapshot;
}

interface QueuedJob<Job extends ObserverBackgroundJob> {
	readonly job: Job;
	readonly epoch: number;
}

interface ActiveJob<Job extends ObserverBackgroundJob> {
	readonly queued: QueuedJob<Job>;
	readonly abort: AbortController;
	requeue: boolean;
}

export function createObserverBackgroundQueue<
	Job extends ObserverBackgroundJob,
>(input: {
	readonly run: (
		job: Job,
		signal: AbortSignal,
	) => Promise<ObserverBackgroundJobResult>;
	readonly settled?: (
		job: Job,
		result: ObserverBackgroundJobResult,
	) => void | Promise<void>;
	readonly changed?: (snapshot: ObserverBackgroundQueueSnapshot) => void;
	readonly maximumQueued?: number;
}): ObserverBackgroundQueue<Job> {
	const maximumQueued = Math.max(1, input.maximumQueued ?? 8);
	const queue: QueuedJob<Job>[] = [];
	let epoch = 0;
	let paused = true;
	let disposed = false;
	let draining = false;
	let active: ActiveJob<Job> | null = null;

	function snapshot(): ObserverBackgroundQueueSnapshot {
		let state: ObserverBackgroundQueueSnapshot["state"] = "idle";
		if (disposed) state = "disposed";
		else if (active) state = "running";
		else if (paused) state = "paused";
		return {
			state,
			queued: queue.length,
			activeJobId: active?.queued.job.id ?? null,
		};
	}

	function changed(): void {
		input.changed?.(snapshot());
	}

	async function settle(
		job: Job,
		result: ObserverBackgroundJobResult,
	): Promise<void> {
		try {
			await input.settled?.(job, result);
		} catch {
			// Status presentation failures must never stop later Observer work.
		}
	}

	function schedule(): void {
		if (disposed || paused || draining || queue.length === 0) return;
		draining = true;
		queueMicrotask(() => {
			void drain();
		});
	}

	async function drain(): Promise<void> {
		try {
			while (!disposed && !paused && queue.length > 0) {
				const queued = queue.shift();
				if (!queued || queued.epoch !== epoch) continue;
				const current: ActiveJob<Job> = {
					queued,
					abort: new AbortController(),
					requeue: false,
				};
				active = current;
				changed();
				let result: ObserverBackgroundJobResult;
				try {
					result = await input.run(queued.job, current.abort.signal);
				} catch (error) {
					if (current.abort.signal.aborted) {
						result = { status: "aborted" };
					} else {
						result = {
							status: "deferred",
							message: error instanceof Error ? error.message : String(error),
						};
					}
				}
				active = null;
				if (current.requeue && !disposed && queued.epoch === epoch) {
					queue.unshift(queued);
				} else if (queued.epoch === epoch) {
					await settle(queued.job, result);
				}
				changed();
			}
		} finally {
			draining = false;
			changed();
			schedule();
		}
	}

	return {
		enqueue(job) {
			if (disposed) return false;
			if (
				active?.queued.job.id === job.id ||
				queue.some((queued) => queued.job.id === job.id)
			) {
				return false;
			}
			if (queue.length >= maximumQueued) {
				const evicted = queue.shift();
				if (evicted) {
					void settle(evicted.job, {
						status: "deferred",
						message: "Observer background queue reached its bounded capacity.",
					});
				}
			}
			queue.push({ job, epoch });
			changed();
			schedule();
			return true;
		},
		pause() {
			if (disposed) return;
			paused = true;
			if (active) {
				active.requeue = true;
				active.abort.abort();
			}
			changed();
		},
		resume() {
			if (disposed) return;
			paused = false;
			changed();
			schedule();
		},
		reset() {
			if (disposed) return;
			epoch += 1;
			paused = true;
			queue.length = 0;
			if (active) {
				active.requeue = false;
				active.abort.abort();
			}
			changed();
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			epoch += 1;
			queue.length = 0;
			if (active) {
				active.requeue = false;
				active.abort.abort();
			}
			changed();
		},
		snapshot,
	};
}
