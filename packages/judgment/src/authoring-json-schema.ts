export const JudgmentAuthoringJsonSchema = Object.freeze({
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "https://raw.githubusercontent.com/dev-hobin/agent/main/packages/judgment/schemas/judgment-authoring.schema.json",
	title: "Judgment Authoring Policy",
	description:
		"Declares when an enclosing capability should be used unless excluded, and when each package-local prepared reference is relevant. Owner identity and runtime questions are supplied outside this file.",
	type: "object",
	additionalProperties: false,
	required: ["specVersion", "when", "unless", "references"],
	properties: {
		$schema: {
			title: "Schema location",
			description:
				"Canonical editor-discovery URL. It does not enter semantic policy identity.",
			type: "string",
			format: "uri",
			examples: [
				"https://raw.githubusercontent.com/dev-hobin/agent/main/packages/judgment/schemas/judgment-authoring.schema.json",
			],
		},
		specVersion: {
			title: "Authoring specification version",
			description:
				"Version of this human authoring vocabulary, distinct from package and runtime event versions.",
			const: "0.1",
			examples: ["0.1"],
		},
		when: {
			title: "When to use the owning capability",
			description:
				"Observable situations that positively establish applicability for the enclosing skill or adapter operation.",
			$ref: "#/$defs/statements",
			examples: [
				["Caller-facing operations and ownership still need to be invented."],
			],
		},
		unless: {
			title: "When not to use the owning capability",
			description:
				"Explicit exclusions that override matching root when statements. Ambiguous evidence concerns do not belong here.",
			$ref: "#/$defs/statements",
			examples: [
				[
					"A concrete candidate already exists and only its stability must be reviewed.",
				],
			],
		},
		references: {
			title: "Prepared references",
			description:
				"Package-local references with complete, independent relevance conditions.",
			type: "array",
			minItems: 1,
			maxItems: 128,
			items: { $ref: "#/$defs/reference" },
			examples: [
				[
					{
						path: "references/book-continuity.md",
						when: [
							"A chapter needs a wider-book terminology, dependency, or example-order relation.",
						],
					},
				],
			],
		},
	},
	$defs: {
		statement: {
			type: "string",
			minLength: 1,
			maxLength: 2_000,
			pattern: "\\S",
		},
		statements: {
			type: "array",
			minItems: 1,
			maxItems: 64,
			uniqueItems: true,
			items: { $ref: "#/$defs/statement" },
		},
		reference: {
			title: "Prepared package reference",
			description:
				"One contained package-local file and complete statements of when its material distinction is relevant.",
			type: "object",
			additionalProperties: false,
			required: ["path", "when"],
			properties: {
				path: {
					title: "Reference path",
					description:
						"Normalized relative POSIX path from the policy directory. Absolute paths, backslashes, empty segments, dot segments, traversal, and physical escape are rejected by the parser and sealer.",
					type: "string",
					minLength: 1,
					maxLength: 1_024,
					pattern: "\\S",
					examples: ["references/book-continuity.md"],
				},
				when: {
					title: "When this reference is relevant",
					description:
						"Complete relevance statements combining an observable situation or pressure with the material distinction this reference can add.",
					$ref: "#/$defs/statements",
					examples: [
						[
							"A chapter needs a wider-book terminology, dependency, or example-order relation.",
						],
					],
				},
			},
		},
	},
});
