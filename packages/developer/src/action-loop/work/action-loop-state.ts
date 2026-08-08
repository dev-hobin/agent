import type { HostContribution } from "../contribution/accept-host-contribution.ts";
import type {
	SkillContribution,
	SkillContributionContext,
} from "../contribution/accept-skill-contribution.ts";
import type { NeedCoverage } from "../need-coverage/assess-need-coverage.ts";
import type {
	AcceptedApplicabilityAssessment,
	CapabilityAssignment,
} from "../routing/accept-applicability.ts";
import type { BoundReferenceSelection } from "../routing/bind-reference-selection.ts";
import type { ActiveWorkCase } from "./work-case.ts";

export type ActionLoopContribution = SkillContribution | HostContribution;

/** Domain-neutral progression state shared by controllers and host projections. */
export interface ActionLoopState {
	readonly workCase: ActiveWorkCase;
	readonly applicabilityAssessments: readonly AcceptedApplicabilityAssessment[];
	readonly assignments: readonly CapabilityAssignment[];
	readonly selections: readonly BoundReferenceSelection[];
	readonly contexts: readonly SkillContributionContext[];
	readonly contributions: readonly ActionLoopContribution[];
	readonly coverages: readonly NeedCoverage[];
}
