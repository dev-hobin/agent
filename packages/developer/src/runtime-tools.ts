export const OPEN_JUDGMENT_TOOL = "developer_open_judgment" as const;
export const OPEN_CONTEXT_SOURCES_TOOL =
	"developer_open_context_sources" as const;
export const CONCLUDE_JUDGMENT_TOOL = "developer_conclude_judgment" as const;
export const AUTHORIZE_CHANGE_TOOL = "developer_authorize_change" as const;
export const RECORD_LANDING_TOOL = "developer_record_landing" as const;

export const DEVELOPER_PROTOCOL_TOOLS = Object.freeze([
	OPEN_JUDGMENT_TOOL,
	OPEN_CONTEXT_SOURCES_TOOL,
	CONCLUDE_JUDGMENT_TOOL,
	AUTHORIZE_CHANGE_TOOL,
	RECORD_LANDING_TOOL,
] as const);
