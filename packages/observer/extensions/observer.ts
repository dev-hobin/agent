import { randomUUID } from "node:crypto";
import { join } from "node:path";

import {
	getAgentDir,
	type ExtensionAPI,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";

import {
	completeObserveArgs,
	createObserverController,
	type ObserverCommandPort,
	type ObserverControllerIds,
} from "../src/observer-controller.ts";
import { fileNotebookSelectionStore } from "../src/notebook-selection-store.ts";

const OBSERVER_STATUS_KEY = "observer";

function systemIds(): ObserverControllerIds {
	return {
		episodeId() {
			return `episode-${randomUUID()}`;
		},
		attemptId() {
			return `attempt-${randomUUID()}`;
		},
		receiptId(): `receipt-${string}` {
			return `receipt-${randomUUID()}`;
		},
	};
}

function commandPort(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
): ObserverCommandPort {
	const sessionManager = ctx.sessionManager;
	const ui = ctx.ui;
	return {
		branchEntries: sessionManager.getBranch.bind(sessionManager),
		sessionFile: sessionManager.getSessionFile.bind(sessionManager),
		appendEntry: pi.appendEntry.bind(pi),
		input: ui.input.bind(ui),
		select: ui.select.bind(ui),
		confirm: ui.confirm.bind(ui),
		notify: ui.notify.bind(ui),
		setStatus(text) {
			ui.setStatus(OBSERVER_STATUS_KEY, text);
		},
	};
}

export default function observerExtension(pi: ExtensionAPI): void {
	const controller = createObserverController({
		selectionStore: fileNotebookSelectionStore(
			join(getAgentDir(), "observer", "selection.json"),
		),
		ids: systemIds(),
	});

	pi.registerCommand("observe", {
		description: "Observer 설정, 상태, on/off, wrap lifecycle 제어",
		getArgumentCompletions: completeObserveArgs,
		async handler(args, ctx) {
			await controller.command(args, commandPort(pi, ctx));
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		await controller.bind(commandPort(pi, ctx));
	});
	pi.on("session_tree", async (_event, ctx) => {
		await controller.bind(commandPort(pi, ctx));
	});
	pi.on("session_compact", async (_event, ctx) => {
		await controller.refresh(commandPort(pi, ctx));
	});
	pi.on("session_shutdown", (_event, ctx) => {
		controller.unbind();
		ctx.ui.setStatus(OBSERVER_STATUS_KEY, undefined);
	});
}
