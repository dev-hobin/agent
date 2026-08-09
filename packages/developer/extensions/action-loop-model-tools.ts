export const ACTION_LOOP_PROGRESS_TOOL = "developer_progress_action_loop";
export const ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL =
	"developer_accept_observation_contribution";
export const ACTION_LOOP_PAUSE_WORK_CASE_TOOL = "developer_pause_work_case";
export const ACTION_LOOP_WAIT_WORK_CASE_TOOL = "developer_wait_work_case";
export const ACTION_LOOP_BLOCK_WORK_CASE_TOOL = "developer_block_work_case";
export const ACTION_LOOP_RESUME_WORK_CASE_TOOL = "developer_resume_work_case";

export const ACTION_LOOP_EVIDENCE_RECOVERY_GUIDANCE = `After a Judgment refusal, do not repeat ${ACTION_LOOP_PROGRESS_TOOL}. For every unresolved Need that requires host, tool-result, Effect, or post-Action evidence, use ${ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL} with an exact listed tool or Effect Observation; never substitute a human-prompt Observation. If no matching Observation exists, call one fitting observational host tool first.`;

/** The complete Developer tool protocol admitted to model output. */
export const MODEL_FACING_ACTION_LOOP_TOOLS = Object.freeze([
	ACTION_LOOP_PROGRESS_TOOL,
	ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL,
	ACTION_LOOP_PAUSE_WORK_CASE_TOOL,
	ACTION_LOOP_WAIT_WORK_CASE_TOOL,
	ACTION_LOOP_BLOCK_WORK_CASE_TOOL,
	ACTION_LOOP_RESUME_WORK_CASE_TOOL,
] as const);

export type ModelFacingActionLoopToolName =
	(typeof MODEL_FACING_ACTION_LOOP_TOOLS)[number];

const MODEL_FACING_ACTION_LOOP_TOOL_SET: ReadonlySet<string> = new Set(
	MODEL_FACING_ACTION_LOOP_TOOLS,
);

export function isModelFacingActionLoopTool(
	toolName: string,
): toolName is ModelFacingActionLoopToolName {
	return MODEL_FACING_ACTION_LOOP_TOOL_SET.has(toolName);
}

export function actionLoopModelProtocolPrompt(
	availableSkillNames: readonly string[],
): string {
	return [
		"",
		"[action_loop_protocol]",
		"state_owner: canonical Work Case",
		`primary_tool: ${ACTION_LOOP_PROGRESS_TOOL}; call again after an exact cleared host Action returns`,
		`observed_contribution_tool: ${ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL}; exact admitted evidence only`,
		"model_authority: proposal-only; evidence is not truth; never infer permission, Effect success, or completion",
		"trusted_controller: owns opening, routing, Judgment, Action proposal, Effect settlement, durable checkpoints, and revision-revalidated Completion",
		`admitted_skills: ${availableSkillNames.length > 0 ? availableSkillNames.join(", ") : "none"}; excluded Skills remain unavailable`,
		"user_surface: never expose internal identities, revisions, hashes, fingerprints, or transitions",
	].join("\n");
}

export interface ActionLoopToolPresentation {
	readonly title: string;
	readonly detail?: string;
}

export function actionLoopToolPresentation(
	toolName: ModelFacingActionLoopToolName,
	args: Readonly<Record<string, unknown>>,
): ActionLoopToolPresentation {
	const text = (key: string) =>
		typeof args[key] === "string" ? String(args[key]).trim() : undefined;
	switch (toolName) {
		case ACTION_LOOP_PROGRESS_TOOL:
			return { title: "Progress canonical work" };
		case ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL:
			return { title: "Use observed evidence" };
		case ACTION_LOOP_PAUSE_WORK_CASE_TOOL:
			return { title: "Pause work", detail: text("reason") };
		case ACTION_LOOP_WAIT_WORK_CASE_TOOL:
			return {
				title: "Wait for an external condition",
				detail: text("external_condition"),
			};
		case ACTION_LOOP_BLOCK_WORK_CASE_TOOL:
			return { title: "Record blocked work", detail: text("reason") };
		case ACTION_LOOP_RESUME_WORK_CASE_TOOL:
			return {
				title: "Resume held work",
				detail: text("observed_change") ?? text("continuation"),
			};
		default:
			return toolName satisfies never;
	}
}
