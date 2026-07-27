export interface Order {
	id: string;
	lineIds: string[];
}

export function validateOrder(input: unknown): void {
	if (!input || typeof input !== "object") throw new Error("invalid order");
	const candidate = input as Record<string, unknown>;
	if (typeof candidate.id !== "string") throw new Error("invalid order id");
	if (!Array.isArray(candidate.lineIds)) throw new Error("invalid order lines");
}

export function decodeOrder(input: unknown): Order {
	validateOrder(input);
	return input as Order;
}

export const persistedOrders: Order[] = [];

export function persistOrder(input: unknown): void {
	persistedOrders.push(decodeOrder(input));
}
