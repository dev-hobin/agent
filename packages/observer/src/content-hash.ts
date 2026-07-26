import { createHash } from "node:crypto";

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

export function sha256Text(content: string): string {
	return createHash("sha256").update(content, "utf8").digest("hex");
}

export function isSha256(value: unknown): value is string {
	return typeof value === "string" && SHA256_PATTERN.test(value);
}
