export const DEVELOPER_MODE_PROTOCOL = "developer.mode/v1" as const;
export const DEVELOPER_MODE_ENTRY = "developer.mode" as const;

export interface DeveloperModeEvent {
	readonly protocol: typeof DEVELOPER_MODE_PROTOCOL;
	readonly kind: "activation";
	readonly enabled: boolean;
}

export interface DeveloperModeBranchEntry {
	readonly customType?: string;
	readonly data?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function developerModeEvent(enabled: boolean): DeveloperModeEvent {
	return Object.freeze({
		protocol: DEVELOPER_MODE_PROTOCOL,
		kind: "activation",
		enabled,
	});
}

export function decodeDeveloperModeEvent(
	value: unknown,
): DeveloperModeEvent | undefined {
	if (!isObject(value)) return undefined;
	if (Object.keys(value).sort((left, right) => left.localeCompare(right)).join("\0") !== "enabled\0kind\0protocol")
		return undefined;
	if (
		value.protocol !== DEVELOPER_MODE_PROTOCOL ||
		value.kind !== "activation" ||
		typeof value.enabled !== "boolean"
	)
		return undefined;
	return developerModeEvent(value.enabled);
}

export function reconstructDeveloperMode(
	entries: readonly DeveloperModeBranchEntry[],
): boolean {
	let enabled = false;
	for (const entry of entries) {
		if (entry.customType !== DEVELOPER_MODE_ENTRY) continue;
		const event = decodeDeveloperModeEvent(entry.data);
		if (event) enabled = event.enabled;
	}
	return enabled;
}
