import {
	decodeContextSelectionProposalData,
	parseContextSelectionProposal,
	selectContext,
	type ContextInventory,
	type ObservedContext,
} from "../context.ts";
import {
	assessContextCoverage,
	decodeContextCoverageProposalData,
	parseContextCoverageProposal,
} from "../coverage.ts";
import { JudgmentTransitionError } from "../errors.ts";
import type { JsonValue } from "../json.ts";
import {
	applicabilityRecorded,
	coverageRecorded,
	decodeContextApplicabilityData,
	outcomeRecorded,
	parseContextApplicability,
	sealedContextRecorded,
	selectionRecorded,
	startJudgment,
	transitionJudgment,
	type ContextJudgmentEvent,
	type ContextJudgmentState,
} from "../lifecycle.ts";
import {
	concludeJudgment,
	decodeJudgmentProposalData,
	parseJudgmentProposal,
} from "../outcome.ts";
import {
	decodeDynamicJudgmentQuestionData,
	parseDynamicJudgmentQuestion,
} from "../question.ts";
import { sealContext, type ContextAcquisition } from "../node/seal-context.ts";

export interface OpenContextAttemptInput {
	readonly question: JsonValue;
	readonly applicability?: JsonValue;
}

export interface ContextAttemptTransition<T> {
	readonly value: T;
	readonly events: readonly ContextJudgmentEvent[];
}

export class ContextAttempt {
	private current: ContextJudgmentState;

	private constructor(state: ContextJudgmentState) {
		this.current = state;
	}

	static open(
		input: OpenContextAttemptInput,
	): ContextAttemptTransition<ContextAttempt> {
		const question = parseDynamicJudgmentQuestion(
			decodeDynamicJudgmentQuestionData(input.question),
		);
		const attempt = new ContextAttempt(startJudgment(question));
		if (input.applicability === undefined) {
			return Object.freeze({ value: attempt, events: Object.freeze([]) });
		}
		const applicability = attempt.recordApplicability(input.applicability);
		return Object.freeze({
			value: attempt,
			events: applicability.events,
		});
	}

	get state(): ContextJudgmentState {
		return this.current;
	}

	recordApplicability(
		value: JsonValue,
	): ContextAttemptTransition<ContextJudgmentState> {
		const applicability = parseContextApplicability(
			decodeContextApplicabilityData(value),
		);
		const event = applicabilityRecorded({
			state: this.current,
			applicability,
		});
		const next = transitionJudgment(this.current, event);
		this.current = next;
		return Object.freeze({
			value: next,
			events: Object.freeze([event]),
		});
	}

	async selectAndSeal(input: {
		readonly inventory: ContextInventory;
		readonly observedContext: ObservedContext;
		readonly proposal: JsonValue;
		readonly admittedPolicySha256s?: readonly string[];
		readonly acquisition: ContextAcquisition;
		readonly signal?: AbortSignal;
	}): Promise<ContextAttemptTransition<ContextJudgmentState>> {
		const proposal = parseContextSelectionProposal(
			decodeContextSelectionProposalData(input.proposal),
		);
		const selection = selectContext({
			question: this.current.question,
			inventory: input.inventory,
			observedContext: input.observedContext,
			proposal,
			...(input.admittedPolicySha256s
				? { admittedPolicySha256s: input.admittedPolicySha256s }
				: {}),
		});
		const sealedContext = await sealContext(
			selection,
			input.acquisition,
			input.signal ? { signal: input.signal } : {},
		);
		const selectedEvent = selectionRecorded({
			state: this.current,
			selection,
		});
		const selectedState = transitionJudgment(this.current, selectedEvent);
		const sealedEvent = sealedContextRecorded({
			state: selectedState,
			sealedContext,
		});
		const sealedState = transitionJudgment(selectedState, sealedEvent);
		this.current = sealedState;
		return Object.freeze({
			value: sealedState,
			events: Object.freeze([selectedEvent, sealedEvent]),
		});
	}

	assessCoverage(
		proposalValue: JsonValue,
	): ContextAttemptTransition<ContextJudgmentState> {
		if (!this.current.sealedContext) {
			throw new JudgmentTransitionError(
				`Coverage requires sealed context, not ${this.current.status}.`,
			);
		}
		const proposal = parseContextCoverageProposal(
			decodeContextCoverageProposalData(proposalValue),
		);
		const coverage = assessContextCoverage({
			selectedContext: this.current.sealedContext,
			proposal,
		});
		const event = coverageRecorded({ state: this.current, coverage });
		const next = transitionJudgment(this.current, event);
		this.current = next;
		return Object.freeze({
			value: next,
			events: Object.freeze([event]),
		});
	}

	conclude(
		proposalValue: JsonValue,
	): ContextAttemptTransition<ContextJudgmentState> {
		if (!this.current.sealedContext || !this.current.coverage) {
			throw new JudgmentTransitionError(
				`Outcome requires assessed coverage, not ${this.current.status}.`,
			);
		}
		const proposal = parseJudgmentProposal(
			decodeJudgmentProposalData(proposalValue),
		);
		const outcome = concludeJudgment({
			question: this.current.question,
			selectedContext: this.current.sealedContext,
			coverage: this.current.coverage,
			proposal,
		});
		const event = outcomeRecorded({ state: this.current, outcome });
		const next = transitionJudgment(this.current, event);
		this.current = next;
		return Object.freeze({
			value: next,
			events: Object.freeze([event]),
		});
	}
}
