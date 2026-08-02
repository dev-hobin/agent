import {
	decodeContextSelectionProposalData,
	parseContextSelectionProposal,
	selectContext,
	type ContextInventory,
	type ObservedContext,
} from "../src/context.ts";
import {
	assessContextCoverage,
	decodeContextCoverageProposalData,
	parseContextCoverageProposal,
} from "../src/coverage.ts";
import { JudgmentTransitionError } from "../src/errors.ts";
import type { JsonValue } from "../src/json.ts";
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
	type ContextJudgmentState,
} from "../src/lifecycle.ts";
import {
	concludeJudgment,
	decodeJudgmentProposalData,
	parseJudgmentProposal,
} from "../src/outcome.ts";
import {
	decodeDynamicJudgmentQuestionData,
	parseDynamicJudgmentQuestion,
} from "../src/question.ts";
import {
	sealContext,
	type ContextAcquisition,
} from "../src/node/seal-context.ts";
import {
	judgmentSessionRecord,
	type JudgmentSessionRecordData,
	type ObservedContextNominationData,
} from "./session.ts";

export interface OpenContextAttemptInput {
	readonly policyPath?: string;
	readonly question: JsonValue;
	readonly applicability?: JsonValue;
}
export interface ContextAttemptTransition<T> {
	readonly value: T;
	readonly records: readonly JudgmentSessionRecordData[];
}

export class ContextAttempt {
	private current: ContextJudgmentState;
	private readonly history: JudgmentSessionRecordData[];
	private constructor(
		state: ContextJudgmentState,
		history: readonly JudgmentSessionRecordData[],
	) {
		this.current = state;
		this.history = [...history];
	}

	static open(
		input: OpenContextAttemptInput,
	): ContextAttemptTransition<ContextAttempt> {
		const questionData = decodeDynamicJudgmentQuestionData(input.question);
		const question = parseDynamicJudgmentQuestion(questionData);
		const initial = startJudgment(question);
		const openedRecord = judgmentSessionRecord({
			protocol: "judgment-event/v1",
			judgmentId: question.judgmentId,
			kind: "attempt-opened",
			...(input.policyPath ? { policyPath: input.policyPath } : {}),
			question: questionData,
			questionSha256: question.questionSha256,
		});
		const attempt = new ContextAttempt(initial, [openedRecord]);
		if (input.applicability === undefined)
			return Object.freeze({
				value: attempt,
				records: Object.freeze([openedRecord]),
			});
		const applicability = attempt.recordApplicability(input.applicability);
		return Object.freeze({
			value: attempt,
			records: Object.freeze([openedRecord, ...applicability.records]),
		});
	}
	get state(): ContextJudgmentState {
		return this.current;
	}
	get records(): readonly JudgmentSessionRecordData[] {
		return Object.freeze([...this.history]);
	}

	recordApplicability(
		value: JsonValue,
	): ContextAttemptTransition<ContextJudgmentState> {
		const applicabilityData = decodeContextApplicabilityData(value);
		const applicability = parseContextApplicability(applicabilityData);
		const next = transitionJudgment(
			this.current,
			applicabilityRecorded({ state: this.current, applicability }),
		);
		const record = judgmentSessionRecord({
			protocol: "judgment-event/v1",
			judgmentId: this.current.question.judgmentId,
			kind: "applicability-recorded",
			applicability: applicabilityData,
		});
		this.current = next;
		this.history.push(record);
		return Object.freeze({ value: next, records: Object.freeze([record]) });
	}

	async selectAndSeal(input: {
		readonly inventory: ContextInventory;
		readonly observedContext: ObservedContext;
		readonly proposal: JsonValue;
		readonly observedNominations: readonly ObservedContextNominationData[];
		readonly acquisition: ContextAcquisition;
		readonly signal?: AbortSignal;
	}): Promise<ContextAttemptTransition<ContextJudgmentState>> {
		const proposalData = decodeContextSelectionProposalData(input.proposal);
		const proposal = parseContextSelectionProposal(proposalData);
		const selection = selectContext({
			question: this.current.question,
			inventory: input.inventory,
			observedContext: input.observedContext,
			proposal,
		});
		const sealedContext = await sealContext(
			selection,
			input.acquisition,
			input.signal ? { signal: input.signal } : {},
		);
		const selectedState = transitionJudgment(
			this.current,
			selectionRecorded({ state: this.current, selection }),
		);
		const sealedState = transitionJudgment(
			selectedState,
			sealedContextRecorded({ state: selectedState, sealedContext }),
		);
		const records: JudgmentSessionRecordData[] = [
			judgmentSessionRecord({
				protocol: "judgment-event/v1",
				judgmentId: this.current.question.judgmentId,
				kind: "selection-recorded",
				proposal: proposalData,
				observedNominations: [...input.observedNominations],
				selectionSha256: selection.selectionSha256,
			}),
			judgmentSessionRecord({
				protocol: "judgment-event/v1",
				judgmentId: this.current.question.judgmentId,
				kind: "sealed-context-recorded",
				selectionSha256: selection.selectionSha256,
				sealedContextSha256: sealedContext.sealedContextSha256,
			}),
		];
		this.current = sealedState;
		this.history.push(...records);
		return Object.freeze({
			value: sealedState,
			records: Object.freeze(records),
		});
	}

	assessCoverage(
		proposalValue: JsonValue,
	): ContextAttemptTransition<ContextJudgmentState> {
		if (!this.current.sealedContext)
			throw new JudgmentTransitionError(
				`Coverage requires sealed context, not ${this.current.status}.`,
			);
		const proposalData = decodeContextCoverageProposalData(proposalValue);
		const proposal = parseContextCoverageProposal(proposalData);
		const coverage = assessContextCoverage({
			selectedContext: this.current.sealedContext,
			proposal,
		});
		const next = transitionJudgment(
			this.current,
			coverageRecorded({ state: this.current, coverage }),
		);
		const record = judgmentSessionRecord({
			protocol: "judgment-event/v1",
			judgmentId: this.current.question.judgmentId,
			kind: "coverage-recorded",
			proposal: proposalData,
			coverageSha256: coverage.coverageSha256,
		});
		this.current = next;
		this.history.push(record);
		return Object.freeze({ value: next, records: Object.freeze([record]) });
	}

	conclude(
		proposalValue: JsonValue,
	): ContextAttemptTransition<ContextJudgmentState> {
		if (!this.current.sealedContext || !this.current.coverage)
			throw new JudgmentTransitionError(
				`Outcome requires assessed coverage, not ${this.current.status}.`,
			);
		const proposalData = decodeJudgmentProposalData(proposalValue);
		const proposal = parseJudgmentProposal(proposalData);
		const outcome = concludeJudgment({
			question: this.current.question,
			selectedContext: this.current.sealedContext,
			coverage: this.current.coverage,
			proposal,
		});
		const next = transitionJudgment(
			this.current,
			outcomeRecorded({ state: this.current, outcome }),
		);
		const record = judgmentSessionRecord({
			protocol: "judgment-event/v1",
			judgmentId: this.current.question.judgmentId,
			kind: "outcome-recorded",
			proposal: proposalData,
			outcomeSha256: outcome.outcomeSha256,
		});
		this.current = next;
		this.history.push(record);
		return Object.freeze({ value: next, records: Object.freeze([record]) });
	}
}
