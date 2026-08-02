import {
	assessMemoContext,
	assessObservationContext,
	encodeContextBasisData,
	type InquiryContext,
	type MemoContextEvidence,
	type SourceReading,
} from "../../src/observer-context.ts";

export async function observationContextBasisFixture(input: {
	readonly sourceReading: SourceReading;
	readonly inquiryContext: InquiryContext | null;
	readonly relatedInquiryIds: readonly string[];
}): Promise<unknown> {
	const assessment = await assessObservationContext(input);
	if (!assessment.ok) throw new Error(assessment.message);
	return encodeContextBasisData(assessment.basis);
}

export async function memoContextBasisDataFixture(input: MemoContextEvidence) {
	const assessment = await assessMemoContext(input);
	if (!assessment.ok) throw new Error(assessment.message);
	return assessment.basis;
}

export async function memoContextBasisFixture(
	input: MemoContextEvidence,
): Promise<unknown> {
	return encodeContextBasisData(await memoContextBasisDataFixture(input));
}
