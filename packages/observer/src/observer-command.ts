import { isAbsolute } from "node:path";

import type { EpisodeLanguage } from "./lifecycle.ts";

export const OBSERVE_ACTIONS = [
	"setup",
	"status",
	"on",
	"off",
	"wrap",
	"memo",
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
	| { readonly kind: "wrap" }
	| { readonly kind: "memo-unavailable" }
	| { readonly kind: "settings-unavailable" };

export type ObserveCommandParseResult =
	| { readonly ok: true; readonly command: ObserveCommand }
	| { readonly ok: false; readonly message: string };

const USAGE =
	"사용법: /observe setup <ko|en> <절대 경로> | status | on | off | wrap | memo | settings";

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
	if (
		(split.action !== "ko" && split.action !== "en") ||
		!split.remainder ||
		!isAbsolute(split.remainder)
	) {
		return failure(
			"setup에는 ko 또는 en과 명시적인 notebook 절대 경로가 필요합니다.",
		);
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
		case "wrap":
			return noArguments(remainder, { kind: "wrap" });
		case "memo":
			return noArguments(remainder, { kind: "memo-unavailable" });
		case "settings":
			return noArguments(remainder, { kind: "settings-unavailable" });
		default:
			return failure();
	}
}

export function completeObserveArgs(prefix: string):
	| Array<{ readonly value: string; readonly label: string }>
	| null {
	const normalized = prefix.trim();
	if (normalized.includes(" ")) return null;
	const matches = OBSERVE_ACTIONS.filter((action) =>
		action.startsWith(normalized),
	);
	return matches.length > 0
		? matches.map((action) => ({ value: action, label: action }))
		: null;
}
