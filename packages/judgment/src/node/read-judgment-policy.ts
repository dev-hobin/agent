import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { parseJudgmentAuthoringPolicyJson } from "../authoring.ts";
import {
	compileJudgmentPolicy,
	type CompiledJudgmentPolicy,
	type PolicyOwner,
} from "../compiled-policy.ts";
import { JudgmentParseError } from "../errors.ts";
import { sha256 } from "../json.ts";

export const MAX_JUDGMENT_POLICY_BYTES = 128_000;

export interface LoadedJudgmentPolicy {
	readonly path: string;
	readonly root: string;
	readonly sourceSha256: string;
	readonly policy: CompiledJudgmentPolicy;
}

export type OptionalJudgmentPolicyLoad =
	| { readonly kind: "absent" }
	| { readonly kind: "loaded"; readonly value: LoadedJudgmentPolicy }
	| { readonly kind: "invalid"; readonly diagnostic: string };

function contained(root: string, candidate: string): boolean {
	const path = relative(root, candidate);
	return path === "" || (!path.startsWith("..") && !path.startsWith("/"));
}

function missingFile(error: unknown): boolean {
	if (typeof error !== "object" || error === null || !("code" in error))
		return false;
	return error.code === "ENOENT";
}

async function readUtf8(
	path: string,
	maxBytes: number,
): Promise<{ readonly source: string; readonly realPath: string }> {
	const realPath = await realpath(path);
	const metadata = await stat(realPath);
	if (!metadata.isFile())
		throw new JudgmentParseError(
			`Judgment policy is not a regular file: ${path}.`,
		);
	if (metadata.size > maxBytes)
		throw new JudgmentParseError(
			`Judgment policy exceeds its byte limit: ${path}.`,
		);
	const bytes = await readFile(realPath);
	if (bytes.byteLength > maxBytes)
		throw new JudgmentParseError(
			`Judgment policy grew beyond its byte limit: ${path}.`,
		);
	try {
		return Object.freeze({
			source: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
			realPath,
		});
	} catch (error) {
		throw new JudgmentParseError(
			`Judgment policy is not valid UTF-8: ${path}.`,
			{},
			{ cause: error },
		);
	}
}

export async function readJudgmentPolicyFile(input: {
	readonly path: string;
	readonly owner: PolicyOwner;
	readonly allowedRoot?: string;
	readonly maxBytes?: number;
}): Promise<LoadedJudgmentPolicy> {
	const lexicalPath = resolve(input.path);
	const lexicalRoot = dirname(lexicalPath);
	const lexicalAllowedRoot = resolve(input.allowedRoot ?? lexicalRoot);
	if (!contained(lexicalAllowedRoot, lexicalPath))
		throw new JudgmentParseError(
			"Judgment policy is outside its allowed root.",
		);
	try {
		const [{ source, realPath }, realRoot, realAllowedRoot] = await Promise.all(
			[
				readUtf8(lexicalPath, input.maxBytes ?? MAX_JUDGMENT_POLICY_BYTES),
				realpath(lexicalRoot),
				realpath(lexicalAllowedRoot),
			],
		);
		if (!contained(realAllowedRoot, realPath))
			throw new JudgmentParseError(
				"Judgment policy physically escapes its allowed root.",
			);
		const authoring = parseJudgmentAuthoringPolicyJson(source);
		for (const reference of authoring.references) {
			const lexicalReference = resolve(lexicalRoot, reference.path);
			if (!contained(lexicalRoot, lexicalReference))
				throw new JudgmentParseError(
					`Prepared reference escapes its policy root: ${reference.path}.`,
				);
			const realReference = await realpath(lexicalReference);
			if (
				!contained(realRoot, realReference) ||
				!contained(realAllowedRoot, realReference)
			)
				throw new JudgmentParseError(
					`Prepared reference symlink escapes its policy root: ${reference.path}.`,
				);
			const metadata = await stat(realReference);
			if (!metadata.isFile())
				throw new JudgmentParseError(
					`Prepared reference is not a regular file: ${reference.path}.`,
				);
		}
		return Object.freeze({
			path: lexicalPath,
			root: lexicalRoot,
			sourceSha256: sha256(source),
			policy: compileJudgmentPolicy({ owner: input.owner, policy: authoring }),
		});
	} catch (error) {
		if (error instanceof JudgmentParseError) throw error;
		throw new JudgmentParseError(
			`Unable to read Judgment policy: ${input.path}.`,
			{},
			{ cause: error },
		);
	}
}

export async function loadOptionalJudgmentPolicyFile(input: {
	readonly path: string;
	readonly owner: PolicyOwner;
	readonly allowedRoot?: string;
}): Promise<OptionalJudgmentPolicyLoad> {
	try {
		return Object.freeze({
			kind: "loaded",
			value: await readJudgmentPolicyFile(input),
		});
	} catch (error) {
		if (
			missingFile(error) ||
			(error instanceof JudgmentParseError && missingFile(error.cause))
		)
			return Object.freeze({ kind: "absent" });
		return Object.freeze({
			kind: "invalid",
			diagnostic: error instanceof Error ? error.message : String(error),
		});
	}
}
