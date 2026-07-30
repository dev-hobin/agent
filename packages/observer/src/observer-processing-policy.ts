import { mkdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";

import { atomicReplaceTextFile } from "./atomic-file.ts";

export const OBSERVER_PROCESSING_SCHEMA: "observer-processing/v1" =
	"observer-processing/v1";

export type ObserverProcessingMode = "off" | "piggyback" | "local";

export interface ObserverLocalModelRef {
	readonly provider: string;
	readonly model_id: string;
}

export interface ObserverProcessingPolicy {
	readonly observer_processing: typeof OBSERVER_PROCESSING_SCHEMA;
	readonly mode: ObserverProcessingMode;
	readonly local_model: ObserverLocalModelRef | null;
}

export const DEFAULT_OBSERVER_PROCESSING_POLICY: ObserverProcessingPolicy = {
	observer_processing: OBSERVER_PROCESSING_SCHEMA,
	mode: "piggyback",
	local_model: null,
};

export type ObserverProcessingPolicyLoad =
	| { readonly ok: true; readonly policy: ObserverProcessingPolicy }
	| {
			readonly ok: false;
			readonly policy: ObserverProcessingPolicy;
			readonly message: string;
	  };

export interface ObserverProcessingPolicyStore {
	readonly location: string;
	load(): Promise<ObserverProcessingPolicyLoad>;
	save(policy: ObserverProcessingPolicy): Promise<void>;
}

export interface ObserverModelIdentity {
	readonly provider: string;
	readonly id: string;
}

interface ObserverModelLike extends ObserverModelIdentity {
	readonly baseUrl: string;
}

/**
 * Pi 0.83 exposes a resolved session scope. An absent scope (older Pi) and an
 * explicit empty scope both mean that every available model remains eligible.
 */
export function modelsInObserverSessionScope<
	Model extends ObserverModelIdentity,
>(
	available: readonly Model[],
	scoped: readonly ObserverModelIdentity[] | undefined,
): Model[] {
	if (!scoped || scoped.length === 0) return [...available];
	const allowed = new Set(
		scoped.map((model) => `${model.provider}\u0000${model.id}`),
	);
	return available.filter((model) =>
		allowed.has(`${model.provider}\u0000${model.id}`),
	);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
	value: Readonly<Record<string, unknown>>,
	expected: readonly string[],
): boolean {
	const keys = Object.keys(value);
	return (
		keys.length === expected.length &&
		keys.every((key) => expected.includes(key))
	);
}

export function decodeObserverProcessingPolicy(
	value: unknown,
): ObserverProcessingPolicyLoad {
	if (
		!isObject(value) ||
		!exactKeys(value, ["observer_processing", "mode", "local_model"]) ||
		value.observer_processing !== OBSERVER_PROCESSING_SCHEMA ||
		(value.mode !== "off" &&
			value.mode !== "piggyback" &&
			value.mode !== "local")
	) {
		return {
			ok: false,
			policy: DEFAULT_OBSERVER_PROCESSING_POLICY,
			message:
				"Observer processing settings are invalid; Piggyback was restored without starting a background model.",
		};
	}
	let localModel: ObserverLocalModelRef | null = null;
	if (value.local_model !== null) {
		if (
			!isObject(value.local_model) ||
			!exactKeys(value.local_model, ["provider", "model_id"]) ||
			typeof value.local_model.provider !== "string" ||
			!value.local_model.provider.trim() ||
			typeof value.local_model.model_id !== "string" ||
			!value.local_model.model_id.trim()
		) {
			return {
				ok: false,
				policy: DEFAULT_OBSERVER_PROCESSING_POLICY,
				message:
					"Observer local-model settings are invalid; Piggyback was restored without starting a background model.",
			};
		}
		localModel = {
			provider: value.local_model.provider,
			model_id: value.local_model.model_id,
		};
	}
	if (value.mode === "local" && !localModel) {
		return {
			ok: false,
			policy: DEFAULT_OBSERVER_PROCESSING_POLICY,
			message:
				"Local background requires an explicit loopback model; Piggyback was restored.",
		};
	}
	return {
		ok: true,
		policy: {
			observer_processing: OBSERVER_PROCESSING_SCHEMA,
			mode: value.mode,
			local_model: localModel,
		},
	};
}

function errorCode(value: unknown): string | undefined {
	return isObject(value) && typeof value.code === "string"
		? value.code
		: undefined;
}

export function fileObserverProcessingPolicyStore(
	location: string,
): ObserverProcessingPolicyStore {
	if (!isAbsolute(location)) {
		throw new Error("Observer processing policy path must be absolute.");
	}
	return {
		location,
		async load() {
			let source: string;
			try {
				source = await readFile(location, "utf8");
			} catch (error) {
				if (errorCode(error) === "ENOENT") {
					return { ok: true, policy: DEFAULT_OBSERVER_PROCESSING_POLICY };
				}
				return {
					ok: false,
					policy: DEFAULT_OBSERVER_PROCESSING_POLICY,
					message:
						"Observer processing settings could not be read; Piggyback was restored.",
				};
			}
			try {
				return decodeObserverProcessingPolicy(JSON.parse(source));
			} catch {
				return decodeObserverProcessingPolicy(source);
			}
		},
		async save(policy) {
			const decoded = decodeObserverProcessingPolicy(policy);
			if (!decoded.ok) throw new Error(decoded.message);
			await mkdir(dirname(location), { recursive: true });
			await atomicReplaceTextFile(
				location,
				`${JSON.stringify(decoded.policy, null, 2)}\n`,
			);
		},
	};
}

function loopbackHostname(hostname: string): boolean {
	const normalized = hostname.toLowerCase().replace(/^\[|\]$/gu, "");
	return (
		normalized === "localhost" ||
		normalized === "::1" ||
		normalized === "0.0.0.0" ||
		normalized === "127.0.0.1" ||
		normalized.startsWith("127.")
	);
}

/** Cost metadata is not trusted: only loopback endpoints qualify as local. */
export function isLocalObserverModel(model: ObserverModelLike): boolean {
	try {
		const endpoint = new URL(model.baseUrl);
		return (
			(endpoint.protocol === "http:" || endpoint.protocol === "https:") &&
			loopbackHostname(endpoint.hostname)
		);
	} catch {
		return false;
	}
}

export function observerLocalModelRef(
	model: ObserverModelLike,
): ObserverLocalModelRef {
	return { provider: model.provider, model_id: model.id };
}

export function processingPolicy(
	mode: ObserverProcessingMode,
	localModel: ObserverLocalModelRef | null = null,
): ObserverProcessingPolicy {
	return {
		observer_processing: OBSERVER_PROCESSING_SCHEMA,
		mode,
		local_model: mode === "local" ? localModel : null,
	};
}
