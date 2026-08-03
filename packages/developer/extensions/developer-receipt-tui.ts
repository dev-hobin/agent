import {
	copyToClipboard,
	type ExtensionContext,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import {
	type Keybinding,
	type KeybindingsManager,
	type KeyId,
	matchesKey,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";

import {
	isProjectionCoordinatorFault,
	projectionReadTarget,
	type ProjectionCoordinatorState,
	type ProjectionPublication,
} from "../src/projection-coordinator.ts";
import {
	isReceiptProjectionError,
	readCurrentReceiptPage,
	verifyReceiptPage,
	type DeveloperReceipt,
	type ReceiptPage,
	type ReceiptPageCursor,
} from "../src/receipt-projection.ts";
import type { Sha256Digest } from "../src/runtime-protocol.ts";

export const DEVELOPER_RECEIPT_TUI_PAGE_SIZE = 20;

export type DeveloperReceiptTuiRead = () => Readonly<{
	state: ProjectionCoordinatorState;
	publication: ProjectionPublication | null;
}>;

export type DeveloperReceiptView =
	| Readonly<{
			kind: "unavailable";
			reason: string;
	  }>
	| Readonly<{
			kind: "refreshing";
			requestedRevisionSha256: Sha256Digest;
	  }>
	| Readonly<{
			kind: "current";
			projectionSha256: Sha256Digest;
			receiptCount: number;
			page: ReceiptPage;
	  }>;

export interface DeveloperReceiptViewInput {
	readonly readCurrent: DeveloperReceiptTuiRead;
	readonly cursor: ReceiptPageCursor | null;
	readonly pageSize?: number;
}

export interface DeveloperReceiptWidgetInput {
	readonly view: DeveloperReceiptView;
	readonly maxLines: number;
}

export interface DeveloperReceiptSurfaceOptions {
	readonly readCurrent: DeveloperReceiptTuiRead;
	readonly theme: Theme;
	readonly keybindings?: KeybindingsManager;
	readonly done: () => void;
	readonly copy?: (text: string) => void;
	readonly requestRender: () => void;
	readonly pageSize?: number;
}

function unavailable(reason: string): DeveloperReceiptView {
	return Object.freeze({ kind: "unavailable", reason });
}

export function readDeveloperReceiptView(
	input: DeveloperReceiptViewInput,
): DeveloperReceiptView {
	try {
		const current = input.readCurrent();
		const target = projectionReadTarget({
			state: current.state,
			publication: current.publication,
		});
		if (!target.ok) return unavailable(target.error.code);
		if (target.target.kind === "refreshing") {
			return Object.freeze({
				kind: "refreshing",
				requestedRevisionSha256: target.target.requestedRevisionSha256,
			});
		}
		const page = readCurrentReceiptPage(target.target, {
			cursor: input.cursor,
			pageSize: input.pageSize ?? DEVELOPER_RECEIPT_TUI_PAGE_SIZE,
		});
		verifyReceiptPage(target.target.projection, page);
		return Object.freeze({
			kind: "current",
			projectionSha256: target.target.projection.projectionSha256,
			receiptCount: target.target.projection.receiptCount,
			page,
		});
	} catch (error: unknown) {
		if (isProjectionCoordinatorFault(error)) {
			return unavailable(error.code);
		}
		if (isReceiptProjectionError(error)) {
			return unavailable(error.code);
		}
		throw error;
	}
}

export const DEVELOPER_RECEIPT_KIND_LABELS: Readonly<
	Record<DeveloperReceipt["kind"], string>
> = Object.freeze({
	"work-scope-opened": "scope opened",
	"work-scope-closed": "scope closed",
	"route-frame-opened": "frame opened",
	"route-frame-replaced": "frame replaced",
	"routing-snapshot-opened": "routing snapshot",
	"routing-page-accounted": "routing page",
	"routing-coverage-completed": "routing complete",
	"can-serve-basis-created": "can-serve basis",
	"ready-assignment-recorded": "assignment ready",
	"skill-invocation-started": "invocation started",
	"invocation-settled": "invocation settled",
	"support-observed": "support observed",
	"frame-contribution-admitted": "contribution admitted",
	"frame-blocker-resolved": "blocker resolved",
	"obligation-discharged": "obligation discharged",
	"route-frame-concluded": "frame concluded",
	"change-authorized": "change authorized",
	"implementation-landing-recorded": "landing recorded",
});

export function developerReceiptSummary(receipt: DeveloperReceipt): string {
	const label = DEVELOPER_RECEIPT_KIND_LABELS[receipt.kind];
	if (receipt.kind === "work-scope-opened")
		return `${label} · ${receipt.workScopeId}`;
	if (receipt.kind === "work-scope-closed")
		return `${label} · ${receipt.workScopeId} · reason ${receipt.reasonSha256}`;
	if (receipt.kind === "route-frame-opened")
		return `${label} · ${receipt.frameId} r${receipt.frameRevision} · ${receipt.routeDefinitionId} · obligations ${receipt.obligationCount}`;
	if (receipt.kind === "route-frame-replaced")
		return `${label} · ${receipt.frameId} r${receipt.frameRevision} · ${receipt.routeDefinitionId} · obligations ${receipt.obligationCount}`;
	if (receipt.kind === "routing-snapshot-opened")
		return `${label} · ${receipt.snapshotId} · candidates ${receipt.candidateCount} · pages ${receipt.pageCount}`;
	if (receipt.kind === "routing-page-accounted")
		return `${label} ${receipt.pageIndex} · ${receipt.snapshotId} · candidates ${receipt.candidateCount} · dispositions ${receipt.dispositionCount}`;
	if (receipt.kind === "routing-coverage-completed")
		return `${label} · ${receipt.snapshotId} · ${receipt.coverageSha256}`;
	if (receipt.kind === "can-serve-basis-created")
		return `${label} · ${receipt.basisId} · candidate ${receipt.candidateId} · targets ${receipt.targetCount}`;
	if (receipt.kind === "ready-assignment-recorded")
		return `${label} · ${receipt.assignmentId} · capability ${receipt.skillCapabilityId} · targets ${receipt.targetCount}`;
	if (receipt.kind === "skill-invocation-started")
		return `${label} · ${receipt.invocationId} · assignment ${receipt.assignmentId}`;
	if (receipt.kind === "invocation-settled")
		return `${label} · ${receipt.invocationId} · ${receipt.outcome}`;
	if (receipt.kind === "support-observed")
		return `${label} · ${receipt.supportId} · ${receipt.sourceKind} · ${receipt.sourceId}`;
	if (receipt.kind === "frame-contribution-admitted")
		return `${label} · ${receipt.contributionId} · ${receipt.frameId} r${receipt.frameRevision} · targets ${receipt.targetCount}`;
	if (receipt.kind === "frame-blocker-resolved")
		return `${label} · ${receipt.blockerId} · frame ${receipt.frameId}`;
	if (receipt.kind === "obligation-discharged")
		return `${label} · ${receipt.obligationId} · contributions ${receipt.contributionCount}`;
	if (receipt.kind === "route-frame-concluded")
		return `${label} · ${receipt.frameId} r${receipt.frameRevision} · discharges ${receipt.dischargeCount}`;
	if (receipt.kind === "change-authorized")
		return `${label} · ${receipt.authorizationId} · frame ${receipt.frameId} r${receipt.frameRevision}`;
	if (receipt.kind === "implementation-landing-recorded")
		return `${label} · ${receipt.landingId} · paths ${receipt.changedPathCount} · verification ${receipt.verificationCount}`;
	throw new Error(`Unsupported Developer receipt: ${receipt.kind}`);
}

export function developerReceiptStatus(
	view: DeveloperReceiptView,
): string | undefined {
	if (view.kind === "unavailable") return "developer v8 · receipts unavailable";
	if (view.kind === "refreshing") return "developer v8 · receipts refreshing";
	if (view.receiptCount === 0) return undefined;
	return `developer v8 · receipts ${view.receiptCount}`;
}

function pageRange(
	view: Extract<DeveloperReceiptView, { kind: "current" }>,
): string {
	if (view.receiptCount === 0) return "0 receipts";
	const first = view.page.startOrdinal + 1;
	const last = view.page.startOrdinal + view.page.entries.length;
	return `receipts ${first}-${last} of ${view.receiptCount}`;
}

export function developerReceiptViewMessage(
	view: DeveloperReceiptView,
): string {
	if (view.kind === "unavailable") {
		return `Developer v8 receipts unavailable (${view.reason}).`;
	}
	if (view.kind === "refreshing") {
		return `Developer v8 receipts refreshing (${view.requestedRevisionSha256}).`;
	}
	return `Developer v8 ${pageRange(view)} · projection ${view.projectionSha256}.`;
}

export function developerReceiptWidgetLines(
	input: DeveloperReceiptWidgetInput,
): readonly string[] {
	const { view, maxLines } = input;
	if (maxLines < 1) return Object.freeze([]);
	if (view.kind !== "current") {
		return Object.freeze([developerReceiptViewMessage(view)]);
	}
	if (view.receiptCount === 0) return Object.freeze([]);
	const lines = [pageRange(view)];
	const entryLimit = Math.max(0, maxLines - 1);
	for (const projected of view.page.entries.slice(0, entryLimit)) {
		lines.push(
			`#${projected.ref.ordinal + 1} ${developerReceiptSummary(projected.receipt)}`,
		);
	}
	const omitted = view.page.entries.length - entryLimit;
	if (omitted > 0 && lines.length === maxLines) {
		lines[maxLines - 1] = `… ${omitted + 1} more on this page; open /developer`;
	}
	return Object.freeze(lines.slice(0, maxLines));
}

function fit(input: {
	readonly value: string;
	readonly width: number;
}): string {
	const safeWidth = Math.max(1, input.width);
	const truncated = truncateToWidth(input.value, safeWidth, "…", true);
	return (
		truncated + " ".repeat(Math.max(0, safeWidth - visibleWidth(truncated)))
	);
}

function semanticPageText(view: DeveloperReceiptView): string {
	if (view.kind !== "current") return developerReceiptViewMessage(view);
	return [
		developerReceiptViewMessage(view),
		...view.page.entries.map(
			(projected) =>
				`#${projected.ref.ordinal + 1} ${developerReceiptSummary(projected.receipt)}`,
		),
	].join("\n");
}

type ReceiptSurfaceIntent =
	| "close"
	| "next"
	| "previous"
	| "first"
	| "refresh"
	| "copy";

function keyMatches(input: {
	readonly keybindings: KeybindingsManager | undefined;
	readonly data: string;
	readonly binding: Keybinding;
	readonly fallback: KeyId;
}): boolean {
	return input.keybindings
		? input.keybindings.matches(input.data, input.binding)
		: matchesKey(input.data, input.fallback);
}

function receiptSurfaceIntent(input: {
	readonly keybindings: KeybindingsManager | undefined;
	readonly data: string;
}): ReceiptSurfaceIntent | null {
	const matches = (key: {
		readonly binding: Keybinding;
		readonly fallback: KeyId;
	}) => keyMatches({ ...input, ...key });
	if (matches({ binding: "tui.select.cancel", fallback: "escape" }))
		return "close";
	if (
		matches({ binding: "tui.select.down", fallback: "down" }) ||
		matches({ binding: "tui.select.pageDown", fallback: "pageDown" }) ||
		matches({ binding: "tui.select.confirm", fallback: "enter" }) ||
		input.data === "j" ||
		input.data === "l" ||
		input.data === "n"
	) {
		return "next";
	}
	if (
		matches({ binding: "tui.select.up", fallback: "up" }) ||
		matches({ binding: "tui.select.pageUp", fallback: "pageUp" }) ||
		input.data === "k" ||
		input.data === "h" ||
		input.data === "p"
	) {
		return "previous";
	}
	if (matchesKey(input.data, "home") || input.data === "g") return "first";
	if (input.data === "r") return "refresh";
	if (input.data === "y") return "copy";
	return null;
}

function renderReceiptSurface(input: {
	readonly view: DeveloperReceiptView;
	readonly theme: Theme;
	readonly width: number;
	readonly maximumHeight?: number;
}): string[] {
	const height = Math.max(6, input.maximumHeight ?? 24);
	const contentWidth = Math.max(1, input.width);
	const header = [
		input.theme.fg("accent", input.theme.bold("Developer v8 receipts")),
		input.theme.fg("muted", developerReceiptViewMessage(input.view)),
		"",
	];
	const body: string[] = [];
	if (input.view.kind === "current") {
		for (const projected of input.view.page.entries) {
			body.push(
				`#${projected.ref.ordinal + 1} ${developerReceiptSummary(projected.receipt)}`,
			);
		}
		if (input.view.page.entries.length === 0) body.push("No receipts.");
	} else {
		body.push("No current receipt page is available.");
	}
	const footer = [
		"",
		input.theme.fg(
			"muted",
			"↑/PgUp previous · ↓/PgDn/Enter next · g first · r refresh · y copy · Esc close",
		),
	];
	const bodySlots = Math.max(1, height - header.length - footer.length);
	const visibleBody = body.slice(0, bodySlots);
	if (body.length > bodySlots) {
		const shown = Math.max(0, bodySlots - 1);
		visibleBody.splice(
			shown,
			visibleBody.length - shown,
			`… ${body.length - shown} more receipts on this page`,
		);
	}
	const visible = [...header, ...visibleBody, ...footer];
	while (visible.length < height) visible.splice(visible.length - 2, 0, "");
	return visible.map((line) => fit({ value: line, width: contentWidth }));
}

export interface DeveloperReceiptSurface {
	handleInput(data: string): void;
	render(input: {
		readonly width: number;
		readonly maximumHeight?: number;
	}): string[];
	invalidate(): void;
}

export function createDeveloperReceiptSurface(
	options: DeveloperReceiptSurfaceOptions,
): DeveloperReceiptSurface {
	let boundProjectionSha256: Sha256Digest | null = null;
	const cursors: Array<ReceiptPageCursor | null> = [null];
	const pageSize = options.pageSize ?? DEVELOPER_RECEIPT_TUI_PAGE_SIZE;
	const readView = (cursor: ReceiptPageCursor | null): DeveloperReceiptView => {
		const next = readDeveloperReceiptView({
			readCurrent: options.readCurrent,
			cursor,
			pageSize,
		});
		if (next.kind !== "current") return next;
		if (boundProjectionSha256 === null) {
			boundProjectionSha256 = next.projectionSha256;
			return next;
		}
		if (next.projectionSha256 !== boundProjectionSha256) {
			return unavailable("projection-changed-reopen");
		}
		return next;
	};
	let view = readView(null);
	const load = (cursor: ReceiptPageCursor | null) => {
		view = readView(cursor);
		options.requestRender();
	};
	return {
		handleInput(data) {
			const intent = receiptSurfaceIntent({
				keybindings: options.keybindings,
				data,
			});
			if (intent === "close") options.done();
			else if (
				intent === "next" &&
				view.kind === "current" &&
				view.page.nextCursor !== null
			) {
				cursors.push(view.page.nextCursor);
				load(view.page.nextCursor);
			} else if (intent === "previous" && cursors.length > 1) {
				cursors.pop();
				load(cursors.at(-1) ?? null);
			} else if (intent === "first") {
				cursors.splice(1);
				load(null);
			} else if (intent === "refresh") {
				load(cursors.at(-1) ?? null);
			} else if (intent === "copy") {
				options.copy?.(semanticPageText(view));
			}
		},
		render(input) {
			return renderReceiptSurface({
				view,
				theme: options.theme,
				...input,
			});
		},
		invalidate() {},
	};
}

export async function showDeveloperReceiptTui(input: {
	readonly ctx: ExtensionContext;
	readonly readCurrent: DeveloperReceiptTuiRead;
}): Promise<void> {
	await input.ctx.ui.custom<null>(
		(...args) => {
			const [tui, theme, keybindings, done] = args;
			const surface = createDeveloperReceiptSurface({
				readCurrent: input.readCurrent,
				theme,
				keybindings,
				done: () => done(null),
				copy: (text: string) => {
					void copyToClipboard(text).then(
						() => input.ctx.ui.notify("Developer receipts copied.", "info"),
						(error: unknown) =>
							input.ctx.ui.notify(
								`Could not copy Developer receipts: ${error instanceof Error ? error.message : String(error)}`,
								"error",
							),
					);
				},
				requestRender: () => tui.requestRender(),
			});
			return {
				render: (width) =>
					surface.render({
						width,
						maximumHeight: Math.max(8, tui.terminal.rows),
					}),
				handleInput: (data) => surface.handleInput(data),
				invalidate: () => surface.invalidate(),
			};
		},
		{
			overlay: true,
			overlayOptions: {
				anchor: "top-center",
				width: "100%",
				maxHeight: "100%",
			},
		},
	);
}
