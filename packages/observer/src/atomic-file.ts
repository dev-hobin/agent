import { randomUUID } from "node:crypto";
import { link, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

function temporaryPath(path: string): string {
	return join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
}

async function removeTemporary(path: string): Promise<void> {
	try {
		await rm(path, { force: true });
	} catch {
		// A cleanup failure cannot change whether publication already occurred.
	}
}

export async function atomicCreateTextFile(
	path: string,
	content: string,
): Promise<void> {
	const temporary = temporaryPath(path);
	try {
		await writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
		await link(temporary, path);
	} finally {
		await removeTemporary(temporary);
	}
}

export async function atomicReplaceTextFile(
	path: string,
	content: string,
): Promise<void> {
	const temporary = temporaryPath(path);
	try {
		await writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
		await rename(temporary, path);
	} finally {
		await removeTemporary(temporary);
	}
}
