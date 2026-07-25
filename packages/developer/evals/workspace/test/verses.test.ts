import assert from "node:assert/strict";
import test from "node:test";

import { verse } from "../src/verses.ts";

const expected = [
	"0 bottles of beer; no bottles remain.",
	"1 bottle of beer; take one down; 0 bottles remain.",
	"2 bottles of beer; take one down; 1 bottle remains.",
	"3 bottles of beer; take one down; 2 bottles remain.",
];

for (const [count, output] of expected.entries()) {
	test(`verse ${count} has exact output`, () => {
		assert.equal(verse(count), output);
	});
}
