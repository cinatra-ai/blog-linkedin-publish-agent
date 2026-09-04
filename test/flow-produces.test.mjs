// The flow document and the manifest must say the same thing about what this
// agent produces: same extension, same exact type. The declaration table of the
// lifecycle plan gives this agent one produced type — the LinkedIn post-draft
// it re-targets mid-run — and a reader of either file must find it there.

import { test } from "node:test";
import assert from "node:assert/strict";

import { manifest, oas } from "./oas-contract.test.mjs";

const EXPECTED = [
  {
    extension: "@cinatra-ai/linkedin-artifacts",
    objectTypeId: "@cinatra-ai/linkedin:post-draft",
  },
];

test("the manifest declares the produced LinkedIn post-draft", () => {
  assert.deepEqual(manifest.cinatra.produces, EXPECTED);
});

test("the flow's produces mirrors the manifest's, typed", () => {
  assert.deepEqual(oas.metadata.cinatra.produces, manifest.cinatra.produces);
  for (const entry of oas.metadata.cinatra.produces) {
    assert.equal(typeof entry.objectTypeId, "string");
    assert.ok(entry.objectTypeId.length > 0);
  }
});

test("the produced type comes from a declared artifact dependency", () => {
  const deps = (manifest.cinatra.dependencies ?? []).map((d) => d.packageName);
  for (const entry of manifest.cinatra.produces) {
    assert.ok(
      deps.includes(entry.extension),
      `${entry.extension} is produced but not declared as a dependency`,
    );
  }
});
