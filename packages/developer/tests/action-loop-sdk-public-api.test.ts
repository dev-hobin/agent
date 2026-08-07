import assert from "node:assert/strict";
import test from "node:test";

import * as sdk from "../dist/sdk.mjs";

test("built SDK surface exposes canonical preparation, routing, and decision control", () => {
	assert.equal(typeof sdk.parseTocBytes, "function");
	assert.equal(typeof sdk.bindCapability, "function");
	assert.equal(typeof sdk.createPiSdkDecisionRunner, "function");
	assert.equal(typeof sdk.openWorkCaseWithSdk, "function");
	assert.equal(typeof sdk.openJudgmentWithSdk, "function");
	assert.equal(typeof sdk.assessCapabilityInventoryWithSdk, "function");
	assert.equal(typeof sdk.routeStructuredCapabilityWithSdk, "function");
	assert.equal(typeof sdk.selectStructuredReferencesWithSdk, "function");
	assert.equal(typeof sdk.sealCapabilityContextWithSdk, "function");
	assert.equal(typeof sdk.inspectCapabilityContextProgress, "function");
	assert.equal(typeof sdk.contributeSkillWithSdk, "function");
	assert.equal(typeof sdk.assessNeedCoverageWithSdk, "function");
	assert.equal(typeof sdk.concludeJudgmentWithSdk, "function");
	assert.equal(typeof sdk.inspectContributionProgress, "function");
	assert.equal(typeof sdk.inspectCoverageProgress, "function");
});
