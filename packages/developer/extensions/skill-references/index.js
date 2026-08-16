import { open, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

export const MAX_REFERENCES_BYTES = 32 * 1024;

const DISCLOSURE_ORIGIN = "developer-skill-references";
const EXPANDED_SKILL_PATTERN = /^<skill name="([^"\n]+)" location="([^"\n]+)">\n/;

function escapeXml(value) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("'", "&apos;");
}

function resolveRequestedPath(path, cwd) {
	const withoutAt = path.startsWith("@") ? path.slice(1) : path;
	return isAbsolute(withoutAt) ? resolve(withoutAt) : resolve(cwd, withoutAt);
}

async function canonicalPath(path, cwd) {
	const resolved = resolveRequestedPath(path, cwd);
	try {
		return await realpath(resolved);
	} catch {
		return resolved;
	}
}

async function indexDiscoveredSkills(skills, cwd) {
	const entries = await Promise.all(
		(skills ?? [])
			.filter(
				(skill) =>
					typeof skill?.name === "string" &&
					typeof skill?.filePath === "string",
			)
			.map(async (skill) => [await canonicalPath(skill.filePath, cwd), skill]),
	);
	return new Map(entries);
}

async function readBoundedJson(path) {
	let file;
	try {
		file = await open(path, "r");
		const buffer = Buffer.alloc(MAX_REFERENCES_BYTES + 1);
		let bytesRead = 0;

		while (bytesRead < buffer.length) {
			const result = await file.read(
				buffer,
				bytesRead,
				buffer.length - bytesRead,
				bytesRead,
			);
			if (result.bytesRead === 0) break;
			bytesRead += result.bytesRead;
		}

		if (bytesRead > MAX_REFERENCES_BYTES) return undefined;

		const raw = buffer.subarray(0, bytesRead).toString("utf8");
		const jsonText = raw.startsWith("\uFEFF") ? raw.slice(1) : raw;
		JSON.parse(jsonText);
		return jsonText.trim();
	} catch {
		return undefined;
	} finally {
		await file?.close().catch(() => {});
	}
}

function disclosureMarker(referencesPath) {
	return `data-origin="${DISCLOSURE_ORIGIN}" path="${escapeXml(referencesPath)}"`;
}

function formatDisclosure(skill, referencesPath, references) {
	const skillDir = dirname(skill.filePath);
	return [
		`<skill_references ${disclosureMarker(referencesPath)} skill="${escapeXml(skill.name)}" base_dir="${escapeXml(skillDir)}">`,
		"This bounded sibling JSON is selection metadata from the selected Skill. It does not select a Reference by itself. Interpret it in the Skill's context, resolve relative paths from base_dir, and read only materially applicable References.",
		references,
		"</skill_references>",
	].join("\n");
}

async function disclosureFor(skill) {
	const referencesPath = join(dirname(skill.filePath), "references.json");
	const references = await readBoundedJson(referencesPath);
	if (references === undefined) return undefined;
	return {
		text: formatDisclosure(skill, referencesPath, references),
		details: {
			skillName: skill.name,
			skillPath: skill.filePath,
			referencesPath,
		},
	};
}

async function findExpandedSkill(prompt, skillsByPath, cwd) {
	const match = prompt.match(EXPANDED_SKILL_PATTERN);
	if (!match) return undefined;

	const [, name, location] = match;
	const skill = skillsByPath.get(await canonicalPath(location, cwd));
	return skill?.name === name ? skill : undefined;
}

export default function skillReferencesDisclosure(pi) {
	let skillsByPath = new Map();
	const disclosedToolResults = new Set();

	pi.on("before_agent_start", async (event) => {
		try {
			const cwd = event.systemPromptOptions.cwd;
			skillsByPath = await indexDiscoveredSkills(
				event.systemPromptOptions.skills,
				cwd,
			);

			const skill = await findExpandedSkill(event.prompt, skillsByPath, cwd);
			if (!skill) return undefined;

			const disclosure = await disclosureFor(skill);
			if (!disclosure) return undefined;

			return {
				message: {
					customType: "developer-skill-references",
					content: disclosure.text,
					display: false,
					details: disclosure.details,
				},
			};
		} catch {
			return undefined;
		}
	});

	pi.on("tool_result", async (event, ctx) => {
		try {
			if (
				event.toolName !== "read" ||
				event.isError ||
				typeof event.input?.path !== "string" ||
				!Array.isArray(event.content)
			) {
				return undefined;
			}

			const requestedPath = await canonicalPath(event.input.path, ctx.cwd);
			const skill = skillsByPath.get(requestedPath);
			if (!skill) return undefined;

			const disclosure = await disclosureFor(skill);
			if (!disclosure) return undefined;

			const disclosureKey = `${event.toolCallId}\0${disclosure.details.referencesPath}`;
			if (disclosedToolResults.has(disclosureKey)) return undefined;
			disclosedToolResults.add(disclosureKey);

			pi.sendMessage(
				{
					customType: "developer-skill-references",
					content: disclosure.text,
					display: false,
					details: disclosure.details,
				},
				{ deliverAs: "steer" },
			);
			return undefined;
		} catch {
			return undefined;
		}
	});
}
