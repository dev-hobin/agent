import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { JudgmentAuthoringJsonSchema } from "../src/authoring-json-schema.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
await writeFile(
	join(root, "schemas/judgment-authoring.schema.json"),
	`${JSON.stringify(JudgmentAuthoringJsonSchema, null, 2)}\n`,
	"utf8",
);
