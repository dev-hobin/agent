import assert from "node:assert/strict";
import test from "node:test";

import { observerWorkerMaterial } from "../src/observer-worker-material.ts";

test("Observer worker material preserves bounded tool inputs, text, and images", () => {
	const images = Array.from({ length: 10 }, (_, index) => ({
		type: "image" as const,
		data: `image-${index}`,
		mimeType: "image/png",
	}));
	const material = observerWorkerMaterial({
		entries: [],
		nominatableToolResults: [
			{
				toolCallId: "tool-call-worker-material",
				toolName: "read",
				isError: false,
				capturedAt: "2026-08-02T00:00:00.000Z",
				input: { path: "/tmp/source.md", offset: 4 },
				content: [
					{ type: "text", text: "Exact retrieved source text." },
					...images,
				],
			},
		],
	});

	assert.match(
		material.text,
		/eligible_tool_call_id=tool-call-worker-material/u,
	);
	assert.match(material.text, /"path":"\/tmp\/source.md"/u);
	assert.match(material.text, /Exact retrieved source text\./u);
	assert.match(material.text, /attached_image_indexes=\[0,1,2,3,4,5,6,7\]/u);
	assert.equal(material.images.length, 8);
	assert.equal(material.images[0]?.data, "image-0");
	assert.equal(material.images[7]?.data, "image-7");
});
