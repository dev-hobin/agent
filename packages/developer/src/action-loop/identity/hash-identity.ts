import { createHash } from "node:crypto";

export type IdentityPart = string | Uint8Array;

export function sha256Bytes(bytes: Uint8Array): string {
	return `sha256_${createHash("sha256").update(bytes).digest("hex")}`;
}

export function hashIdentity(
	prefix: string,
	domain: string,
	parts: readonly IdentityPart[],
): string {
	const hash = createHash("sha256");
	for (const part of [domain, ...parts]) {
		const bytes = typeof part === "string" ? Buffer.from(part, "utf8") : part;
		const length = Buffer.alloc(8);
		length.writeBigUInt64BE(BigInt(bytes.byteLength));
		hash.update(length);
		hash.update(bytes);
	}
	return `${prefix}_${hash.digest("hex")}`;
}
