export const ACTION_LOOP_PROGRESS_TOOL = "developer_progress_action_loop";
export const ACTION_LOOP_ACCEPT_HOST_CONTRIBUTION_TOOL =
	"developer_accept_observation_contribution";
export const ACTION_LOOP_PAUSE_WORK_CASE_TOOL = "developer_pause_work_case";
export const ACTION_LOOP_WAIT_WORK_CASE_TOOL = "developer_wait_work_case";
export const ACTION_LOOP_BLOCK_WORK_CASE_TOOL = "developer_block_work_case";
export const ACTION_LOOP_RESUME_WORK_CASE_TOOL = "developer_resume_work_case";

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
