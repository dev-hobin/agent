export type Schedule = readonly [
	timezone: string,
	epochStart: number,
	epochEnd: number,
];

export function isActiveAt(schedule: Schedule, epoch: number): boolean {
	return schedule[1] <= epoch && epoch < schedule[2];
}

export function scheduleSummary(schedule: Schedule): string {
	return `${schedule[0]}:${schedule[1]}-${schedule[2]}`;
}
