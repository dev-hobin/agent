export type JudgmentErrorCode =
	| "JUDGMENT_PARSE_INVALID"
	| "JUDGMENT_CONTEXT_SEAL_FAILED"
	| "JUDGMENT_TRANSITION_INVALID";

export interface JudgmentErrorDetails {
	readonly [key: string]: unknown;
}

export class JudgmentError extends Error {
	readonly code: JudgmentErrorCode;
	readonly details: JudgmentErrorDetails;

	constructor(
		code: JudgmentErrorCode,
		message: string,
		details: JudgmentErrorDetails = {},
		options?: ErrorOptions,
	) {
		super(message, options);
		this.name = new.target.name;
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

export class JudgmentParseError extends JudgmentError {
	constructor(
		message: string,
		details: JudgmentErrorDetails = {},
		options?: ErrorOptions,
	) {
		super("JUDGMENT_PARSE_INVALID", message, details, options);
	}
}

export class ContextSealError extends JudgmentError {
	constructor(
		message: string,
		details: JudgmentErrorDetails = {},
		options?: ErrorOptions,
	) {
		super("JUDGMENT_CONTEXT_SEAL_FAILED", message, details, options);
	}
}

export class JudgmentTransitionError extends JudgmentError {
	constructor(
		message: string,
		details: JudgmentErrorDetails = {},
		options?: ErrorOptions,
	) {
		super("JUDGMENT_TRANSITION_INVALID", message, details, options);
	}
}
