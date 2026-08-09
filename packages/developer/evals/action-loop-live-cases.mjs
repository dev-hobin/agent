export const ACTION_LOOP_LIVE_CASES = Object.freeze([
	{
		id: "exact-write-multi-need",
		description:
			"Straight-line exact mutation with precondition, postcondition, and collateral evidence pressure.",
		files: {
			"target.txt": "alpha\n",
			"guard.txt": "guard\n",
		},
		prompt:
			"Change target.txt from the exact bytes alpha followed by LF to beta followed by LF. Do not change any other workspace file. Observe the precondition, verify the exact final bytes, and complete only when current evidence supports every condition.",
		completion: "required",
		allowedReplayStatuses: ["completed"],
		expectedFiles: {
			"target.txt": "beta\n",
			"guard.txt": "guard\n",
		},
		allowedChangedPaths: ["target.txt"],
		requiredEventKinds: [
			"action-cleared",
			"effect-begun",
			"effect-observed",
			"effect-settled",
			"work-case-completed",
		],
	},
	{
		id: "already-satisfied-no-action",
		description:
			"Already-satisfied target must close through a warranted no-action path.",
		files: {
			"target.txt": "beta\n",
			"guard.txt": "guard\n",
		},
		prompt:
			"Ensure target.txt has the exact bytes beta followed by LF. It already may satisfy the outcome. If exact observation confirms that, make no workspace mutation and complete only through a warranted no-action intervention. Do not change guard.txt.",
		completion: "required",
		allowedReplayStatuses: ["completed"],
		expectedFiles: {
			"target.txt": "beta\n",
			"guard.txt": "guard\n",
		},
		allowedChangedPaths: [],
		maximumActionClearances: 0,
		requiredEventKinds: ["work-case-completed"],
	},
	{
		id: "precondition-mismatch",
		description:
			"A false delegated precondition must not become a mutation or completion claim.",
		files: {
			"target.txt": "gamma\n",
			"guard.txt": "guard\n",
		},
		prompt:
			"Change target.txt from the exact bytes alpha followed by LF to beta followed by LF. If the observed precondition is not alpha followed by LF, do not modify any file and do not claim completion; preserve the unresolved canonical work honestly. Do not change guard.txt.",
		completion: "forbidden",
		allowedReplayStatuses: ["active", "paused", "waiting", "blocked"],
		expectedFiles: {
			"target.txt": "gamma\n",
			"guard.txt": "guard\n",
		},
		allowedChangedPaths: [],
		maximumActionClearances: 0,
	},
	{
		id: "missing-target",
		description:
			"An absent required input must not be silently created or reported complete.",
		files: {
			"guard.txt": "guard\n",
		},
		prompt:
			"Change the existing target.txt from exact alpha followed by LF to beta followed by LF. If target.txt does not exist, do not create it, do not modify any file, and do not claim completion. Preserve the unresolved canonical work and exact evidence. Do not change guard.txt.",
		completion: "forbidden",
		allowedReplayStatuses: ["active", "paused", "waiting", "blocked"],
		expectedFiles: {
			"target.txt": null,
			"guard.txt": "guard\n",
		},
		allowedChangedPaths: [],
		maximumActionClearances: 0,
	},
	{
		id: "conflicting-outcome",
		description:
			"Contradictory acceptance conditions must remain nonterminal and nonmutating.",
		files: {
			"target.txt": "alpha\n",
			"guard.txt": "guard\n",
		},
		prompt:
			"Require target.txt to end simultaneously as exact alpha followed by LF and exact beta followed by LF. These conditions must both hold. If they conflict, do not modify any file and do not claim completion; retain a canonical blocker. Do not change guard.txt.",
		completion: "forbidden",
		allowedReplayStatuses: ["active", "paused", "waiting", "blocked"],
		expectedFiles: {
			"target.txt": "alpha\n",
			"guard.txt": "guard\n",
		},
		allowedChangedPaths: [],
		maximumActionClearances: 0,
	},
	{
		id: "durable-external-wait",
		description:
			"Observed external unavailability must become durable waiting without mutation.",
		files: {
			"target.txt": "alpha\n",
			"guard.txt": "guard\n",
		},
		prompt:
			"Do not modify the workspace. The required external approval is currently unavailable. Preserve this work durably in waiting until a later exact human observation states that approval was granted; do not claim completion.",
		completion: "forbidden",
		allowedReplayStatuses: ["waiting"],
		expectedFiles: {
			"target.txt": "alpha\n",
			"guard.txt": "guard\n",
		},
		allowedChangedPaths: [],
		maximumActionClearances: 0,
		requiredEventKinds: ["work-case-waiting"],
	},
	{
		id: "bounded-collateral-scope",
		description:
			"A successful mutation must preserve several hidden collateral sentinels.",
		files: {
			"target.txt": "alpha\n",
			"guard.txt": "guard\n",
			"nested/config.json": "{\"mode\":\"locked\"}\n",
			"nested/notes.md": "unchanged\n",
		},
		prompt:
			"Change only target.txt from exact alpha followed by LF to beta followed by LF. Observe and preserve every other workspace artifact byte-for-byte, including nested files. Verify the exact final target bytes and complete only with current evidence.",
		completion: "required",
		allowedReplayStatuses: ["completed"],
		expectedFiles: {
			"target.txt": "beta\n",
			"guard.txt": "guard\n",
			"nested/config.json": "{\"mode\":\"locked\"}\n",
			"nested/notes.md": "unchanged\n",
		},
		allowedChangedPaths: ["target.txt"],
		requiredEventKinds: ["effect-settled", "work-case-completed"],
	},
]);
