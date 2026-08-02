export {
	AUTHORIZE_CHANGE_TOOL,
	CONCLUDE_JUDGMENT_TOOL,
	DEVELOPER_ACTIVATION_ENTRY as ACTIVATION_ENTRY,
	DEVELOPER_EVENT_ENTRY,
	DEVELOPER_FOCUS_ENTRY as FOCUS_ENTRY,
	DEVELOPER_PROTOCOL as PROTOCOL,
	DEVELOPER_PROTOCOL_TOOLS as PROTOCOL_TOOLS,
	OPEN_JUDGMENT_TOOL,
	RECORD_LANDING_TOOL,
	activationChanged,
	changeAuthorized,
	developerEventData,
	developerContextBasisSha256,
	judgmentConcluded,
	judgmentOpened,
	landingRecorded,
	parseActiveJudgment,
	parseAuthorizedChange,
	parseChoiceResponseSpec,
	parseDeveloperContextBasis,
	parseDeveloperEvent,
	parseImplementationLanding,
	parseJudgmentConclusion,
	type ActivationChanged,
	type ActiveJudgment,
	type AuthorizedChange,
	type ChangeAuthorized,
	type ChoiceResponseField,
	type ChoiceResponseOption,
	type ChoiceResponseSpec,
	type ContextBasisMember,
	type DeveloperAssurance,
	type DeveloperContextBasis,
	type DeveloperEvent,
	type DeveloperProtocolParseError,
	type DeveloperSkillRef,
	type ImplementationContract,
	type ImplementationLanding,
	type JudgmentConcluded,
	type JudgmentConclusion,
	type JudgmentOpened,
	type LandingRecorded,
	type MethodAlternative,
	type ContributionBasis,
	type PendingQuestion,
	type PendingQuestionStatus,
	type QuestionFocused,
	type QuestionGate,
	type QuestionResolutionOwner,
	type QuestionUpdate,
	type QuestionUpdateStatus,
	type RefinementBoundary,
	type TrustedCompilerGap,
} from "../src/protocol.ts";

export {
	blocksCompletion,
	blocksImplementation,
	developerNextOperations,
	developerProtocolState as protocolState,
	developerToolAccess,
	initialDeveloperState as initialState,
	transitionDeveloper,
	type ActiveDeveloperWork,
	type CompletedJudgment,
	type CompletedLanding,
	type DeveloperNextOperation,
	type DeveloperObligations,
	type DeveloperProtocolState as ProtocolState,
	type DeveloperState,
	type DeveloperToolAccess,
	type DeveloperTransitionError,
	type DeveloperTransitionErrorCode,
	type DeveloperTransitionResult,
} from "../src/transition.ts";

import { parseDeveloperEvent, type DeveloperEvent } from "../src/protocol.ts";
import {
	replayDeveloper,
	type DeveloperBranchEntry,
	type DeveloperReplayResult,
} from "../src/replay.ts";
import {
	applyDeveloperEvent,
	initialDeveloperState,
	type DeveloperState,
} from "../src/transition.ts";

export { applyDeveloperEvent };

export function normalizeDeveloperEvent(
	value: unknown,
): DeveloperEvent | undefined {
	try {
		return parseDeveloperEvent(value);
	} catch {
		return undefined;
	}
}

export function reconstructDeveloper(
	entries: readonly DeveloperBranchEntry[],
): DeveloperReplayResult {
	return replayDeveloper(entries);
}

export function reconstructState(
	entries: readonly DeveloperBranchEntry[],
): DeveloperState {
	return replayDeveloper(entries).state;
}

export function restartDiagnostic(
	entries: readonly DeveloperBranchEntry[],
): string | undefined {
	const replay = replayDeveloper(entries);
	if (!replay.restartRequired) return undefined;
	return (
		replay.issues.find(
			(issue) => issue.code === "developer.history.unsupported-v6",
		)?.message ??
		"Unsupported Developer history requires restart or /developer on reroute."
	);
}

export function enabledInitialState(): DeveloperState {
	return applyDeveloperEvent(initialDeveloperState(), {
		...parseDeveloperEvent({
			protocol: "developer/v7",
			kind: "activation-changed",
			enabled: true,
		}),
	});
}
