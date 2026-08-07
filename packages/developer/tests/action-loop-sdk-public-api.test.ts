import assert from "node:assert/strict";
import test from "node:test";

import * as sdk from "../dist/sdk.mjs";

test("built SDK surface exposes canonical preparation, routing, and decision control", () => {
	assert.equal(typeof sdk.parseTocBytes, "function");
	assert.equal(typeof sdk.bindCapability, "function");
	assert.equal(typeof sdk.createPiSdkDecisionRunner, "function");
	assert.equal(typeof sdk.routeStructuredCapabilityWithSdk, "function");
});
