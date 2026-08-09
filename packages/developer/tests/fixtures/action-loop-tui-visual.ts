import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { showActionLoopWorkbench } from "../../extensions/action-loop-workbench-tui.ts";
import type { ActionLoopWorkbenchSnapshot } from "../../extensions/action-loop-workbench.ts";

const snapshot = {
	status: "waiting",
	statusLabel: "Waiting",
	headline: "외부 패키지 검증이 끝나면 안전하게 릴리스한다",
	next: "Send a normal update when the external condition changes.",
	sections: Object.freeze<ActionLoopWorkbenchSnapshot["sections"]>([
		{
			id: "overview",
			label: "Overview",
			value: "Waiting",
			items: Object.freeze([
				{
					title: "Status",
					summary: "Waiting",
					tone: "warning",
					details: Object.freeze([]),
				},
				{
					title: "Waiting for",
					summary: "패키지 registry가 새 release를 반환하지 않음",
					tone: "warning",
					details: Object.freeze([
						{
							label: "Continue when",
							lines: Object.freeze([
								"bounded registry probe가 expected release를 반환함",
							]),
						},
					]),
				},
			]),
		},
		{
			id: "judgments",
			label: "Judgments",
			value: "1",
			items: Object.freeze([
				{
					title: "Claim Assurance · open",
					summary: "현재 evidence가 release claim을 지지하는가?",
					tone: "warning",
					details: Object.freeze([
						{
							label: "Needed contributions",
							lines: Object.freeze([
								"registry provenance",
								"packed install smoke",
							]),
						},
					]),
				},
			]),
		},
		{
			id: "evidence",
			label: "Evidence",
			value: "1",
			items: Object.freeze([
				{
					title: "Contribution",
					summary: "local pack and isolated install passed",
					tone: "success",
					details: Object.freeze([]),
				},
			]),
		},
		{
			id: "actions",
			label: "Actions & Effects",
			value: "1",
			items: Object.freeze([
				{
					title: "Effect assessment",
					summary: "external registry remains pending",
					tone: "warning",
					details: Object.freeze([]),
				},
			]),
		},
		{
			id: "continuity",
			label: "Continuity",
			value: "1",
			items: Object.freeze([
				{
					title: "Waiting for",
					summary: "패키지 registry가 expected release를 반환함",
					tone: "warning",
					details: Object.freeze([]),
				},
			]),
		},
		{
			id: "history",
			label: "History",
			value: "4",
			items: Object.freeze([
				{
					title: "Work Case waiting",
					summary: "Durably accepted canonical checkpoint",
					tone: "warning",
					details: Object.freeze([]),
				},
			]),
		},
		{
			id: "settings",
			label: "Settings",
			value: "On",
			items: Object.freeze([
				{
					title: "Activation",
					summary: "Developer is on",
					tone: "success",
					details: Object.freeze([]),
				},
			]),
		},
	]),
} as const satisfies ActionLoopWorkbenchSnapshot;

export default function actionLoopTuiVisual(pi: ExtensionAPI): void {
	pi.registerCommand("developer-tui-qa", {
		description: "Open the canonical Developer Workbench visual fixture",
		handler: async (_args, ctx) => {
			await showActionLoopWorkbench(ctx, snapshot, "overview");
		},
	});
}
