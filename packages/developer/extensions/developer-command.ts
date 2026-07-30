export const DEVELOPER_COMMAND_ACTIONS = [
	"status",
	"questions",
	"settings",
	"on",
	"off",
] as const;

export type DeveloperCommandAction = (typeof DEVELOPER_COMMAND_ACTIONS)[number];

export type DeveloperCommand =
	| { readonly kind: "workbench" }
	| { readonly kind: DeveloperCommandAction };

export type DeveloperCommandParseResult =
	| { readonly ok: true; readonly command: DeveloperCommand }
	| { readonly ok: false };

export interface DeveloperCommandCompletion {
	readonly value: DeveloperCommandAction;
	readonly label: DeveloperCommandAction;
}

export function parseDeveloperCommand(
	value: string,
): DeveloperCommandParseResult {
	const normalized = value.trim();
	if (!normalized) return { ok: true, command: { kind: "workbench" } };
	if (DEVELOPER_COMMAND_ACTIONS.includes(normalized as DeveloperCommandAction))
		return {
			ok: true,
			command: { kind: normalized as DeveloperCommandAction },
		};
	return { ok: false };
}

export function completeDeveloperArgs(
	prefix: string,
): DeveloperCommandCompletion[] | null {
	const normalized = prefix.trim();
	const matches = DEVELOPER_COMMAND_ACTIONS.filter((action) =>
		action.startsWith(normalized),
	);
	return matches.length > 0
		? matches.map((action) => ({ value: action, label: action }))
		: null;
}
