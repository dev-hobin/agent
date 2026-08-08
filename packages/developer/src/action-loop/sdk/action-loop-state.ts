import type { SkillContributionContext } from "../contribution/accept-skill-contribution.ts";
import type { NeedCoverage } from "../need-coverage/assess-need-coverage.ts";
import type {
	AcceptedApplicabilityAssessment,
	CapabilityAssignment,
} from "../routing/accept-applicability.ts";
import type { BoundReferenceSelection } from "../routing/bind-reference-selection.ts";
import type { ActiveWorkCase } from "../work/work-case.ts";
import type { SdkCoverageContribution } from "./coverage-controller.ts";

/** Canonical controller state resumed by both Judgment and whole-loop progression. */
export interface SdkActionLoopState {
	readonly workCase: ActiveWorkCase;
	readonly applicabilityAssessments: readonly AcceptedApplicabilityAssessment[];
	readonly assignments: readonly CapabilityAssignment[];
	readonly selections: readonly BoundReferenceSelection[];
	readonly contexts: readonly SkillContributionContext[];
	readonly contributions: readonly SdkCoverageContribution[];
	readonly coverages: readonly NeedCoverage[];
}
