import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";

export type NotebookPathKind = "absolute" | "home-relative" | "cwd-relative";

export type NotebookPathResolution =
	| {
			readonly ok: true;
			readonly path: string;
			readonly kind: NotebookPathKind;
	  }
	| { readonly ok: false; readonly message: string };

/** Resolve user-facing Notebook syntax before the absolute-only notebook boundary. */
export function resolveNotebookPath(
	value: string,
	cwd: string,
	home = homedir(),
): NotebookPathResolution {
	const input = value.trim();
	if (!input) return { ok: false, message: "Enter a Notebook path." };
	if (input === "~") {
		return { ok: true, path: resolve(home), kind: "home-relative" };
	}
	if (input.startsWith("~/")) {
		return {
			ok: true,
			path: resolve(home, input.slice(2)),
			kind: "home-relative",
		};
	}
	if (input.startsWith("~")) {
		return {
			ok: false,
			message:
				"Only ~ or ~/… home paths are supported; ~user paths are not expanded.",
		};
	}
	return {
		ok: true,
		path: resolve(cwd, input),
		kind: isAbsolute(input) ? "absolute" : "cwd-relative",
	};
}

export function notebookPathKindLabel(kind: NotebookPathKind): string {
	switch (kind) {
		case "absolute":
			return "Absolute path";
		case "home-relative":
			return "Home-relative path (~)";
		case "cwd-relative":
			return "Path relative to Pi working directory";
		default:
			throw new Error(`Unknown Notebook path kind: ${String(kind)}`);
	}
}
