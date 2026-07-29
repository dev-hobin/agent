import type { EpisodeLanguage } from "./lifecycle.ts";

export const OBSERVE_ACTIONS = [
	"setup",
	"status",
	"on",
	"off",
	"add-hypothesis",
	"material",
	"memo",
	"review",
	"save",
	"settings",
];

export type ObserveCommand =
	| {
			readonly kind: "setup";
			readonly root: string;
			readonly lang: EpisodeLanguage;
	  }
	| { readonly kind: "setup-prompt" }
	| { readonly kind: "status" }
	| { readonly kind: "on" }
	| { readonly kind: "off" }
	| { readonly kind: "review" }
	| { readonly kind: "save" }
	| { readonly kind: "memo" }
	| { readonly kind: "settings-unavailable" };

export type ObserveCommandParseResult =
	| { readonly ok: true; readonly command: ObserveCommand }
	| { readonly ok: false; readonly message: string };

const USAGE =
	"Usage: /observe setup <ko|en> <path> | status | on | off | add-hypothesis <text> | material <request|retry|cancel> | memo | review | save | settings";

function success(command: ObserveCommand): ObserveCommandParseResult {
	return { ok: true, command };
}

function failure(message = USAGE): ObserveCommandParseResult {
	return { ok: false, message };
}

function actionAndRemainder(input: string): {
	readonly action: string;
	readonly remainder: string;
} {
	const boundary = input.search(/\s/u);
	if (boundary === -1) return { action: input, remainder: "" };
	return {
		action: input.slice(0, boundary),
		remainder: input.slice(boundary).trim(),
	};
}

function parseSetup(remainder: string): ObserveCommandParseResult {
	if (!remainder) return success({ kind: "setup-prompt" });
	const split = actionAndRemainder(remainder);
	if ((split.action !== "ko" && split.action !== "en") || !split.remainder) {
		return failure("setup requires ko or en and a notebook path.");
	}
	return success({
		kind: "setup",
		lang: split.action,
		root: split.remainder,
	});
}

function noArguments(
	remainder: string,
	command: ObserveCommand,
): ObserveCommandParseResult {
	return remainder ? failure() : success(command);
}

export function parseObserveCommand(args: string): ObserveCommandParseResult {
	const normalized = args.trim();
	if (!normalized) return success({ kind: "status" });
	const { action, remainder } = actionAndRemainder(normalized);
	switch (action) {
		case "setup":
			return parseSetup(remainder);
		case "status":
			return noArguments(remainder, { kind: "status" });
		case "on":
			return noArguments(remainder, { kind: "on" });
		case "off":
			return noArguments(remainder, { kind: "off" });
		case "review":
			return noArguments(remainder, { kind: "review" });
		case "save":
			return noArguments(remainder, { kind: "save" });
		case "memo":
			return noArguments(remainder, { kind: "memo" });
		case "settings":
			return noArguments(remainder, { kind: "settings-unavailable" });
		default:
			return failure();
	}
}

const OBSERVE_ACTION_DESCRIPTIONS: Readonly<Record<string, string>> = {
	setup: "Create or select a Notebook (absolute or relative path)",
	status: "Inspect Episode, working set, and Notebook health",
	on: "Start or resume continuous Sidecar observation",
	off: "Turn Observer Off while preserving the Episode",
	"add-hypothesis": "Add a hypothesis and review current context through it",
	material:
		"Observe supplied or retrieved material without changing Observer Mode",
	memo: "Reconcile working Memos and Inquiries without preparing a save",
	review: "Reconcile pending work and prepare an inspectable save proposal",
	save: "Inspect and approve an already prepared proposal",
	settings: "Open the Observer control center",
};

export function completeObserveArgs(prefix: string): Array<{
	readonly value: string;
	readonly label: string;
	readonly description: string;
}> | null {
	const normalized = prefix.trim();
	if (prefix.trimStart().startsWith("material ")) {
		const remainder = prefix.trimStart().slice("material ".length).trim();
		return [
			{
				value: "material retry",
				label: "material retry",
				description:
					"Resume the exact pending material review for one agent run",
			},
			{
				value: "material cancel",
				label: "material cancel",
				description:
					"Cancel the pending material review without changing Mode or Episode",
			},
		].filter((item) =>
			item.value.slice("material ".length).startsWith(remainder),
		);
	}
	if (normalized.includes(" ")) return null;
	const matches = OBSERVE_ACTIONS.filter((action) =>
		action.startsWith(normalized),
	);
	return matches.length > 0
		? matches.map((action) => ({
				value: action,
				label: action,
				description: OBSERVE_ACTION_DESCRIPTIONS[action] ?? action,
			}))
		: null;
}
