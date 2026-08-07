import { createFixtureBudgetMonitor } from "./eval-budget.mjs";
import { createJsonlDecoder } from "./jsonl.mjs";

export function createEvalEventMonitor({
	fixture,
	fixtureTimeoutMs,
	noProgressTimeoutMs,
	now = Date.now,
	onStop,
	onFailure,
}) {
	const events = [];
	const budget = createFixtureBudgetMonitor({
		fixture,
		fixtureTimeoutMs,
		noProgressTimeoutMs,
		now,
	});
	let failure;
	let budgetStop;

	const fail = (error) => {
		if (failure) return;
		failure = error;
		Object.defineProperty(error, "evalEvents", {
			value: [...events],
			enumerable: false,
		});
		onFailure?.(error);
	};
	const check = () => {
		if (failure || budgetStop) return budgetStop;
		const reason = budget.stop(events);
		if (!reason) return undefined;
		const recent =
			events
				.slice(-20)
				.map((event) => event.type)
				.join(", ") || "none";
		budgetStop = { ...reason, recentEvents: recent };
		onStop?.(budgetStop);
		return budgetStop;
	};
	const decoder = createJsonlDecoder({
		onValue(event) {
			budget.observe([event]);
			if (event.type !== "message_update") events.push(event);
			check();
		},
		onError(error, record) {
			fail(
				new Error(
					`${fixture.id}: invalid JSON event: ${error instanceof Error ? error.message : String(error)}; record: ${record.slice(0, 200)}`,
					{ cause: error },
				),
			);
		},
	});

	return {
		events,
		push(chunk) {
			if (!failure && !budgetStop) decoder.push(chunk);
		},
		end() {
			if (!failure && !budgetStop) decoder.end();
		},
		check,
		get failure() {
			return failure;
		},
		get budgetStop() {
			return budgetStop;
		},
	};
}
