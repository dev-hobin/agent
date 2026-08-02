import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function judgmentEvalProbe(pi: ExtensionAPI): void {
	pi.registerCommand("judgment-eval-status", {
		description: "Report Judgment resources for repository evaluation",
		handler: (_args, ctx) => {
			const tools = pi
				.getAllTools()
				.flatMap((tool) =>
					tool.name.startsWith("judgment_")
						? [
								{
									name: tool.name,
									path: tool.sourceInfo.path,
									source: tool.sourceInfo.source,
								},
							]
						: [],
				)
				.toSorted((left, right) => left.name.localeCompare(right.name));
			const activeTools = pi
				.getActiveTools()
				.filter((name) => name.startsWith("judgment_"))
				.toSorted((left, right) => left.localeCompare(right));
			ctx.ui.notify(JSON.stringify({ activeTools, tools }), "info");
			return Promise.resolve();
		},
	});
}
