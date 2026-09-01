// Pins that the LinkedIn publisher mints its edited revision on the LINKEDIN
// type. Before this conversion it minted on the blog-post extension, so an
// operator's edit to a LinkedIn post landed as another blog post.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const oasText = readFileSync(join(root, "cinatra", "oas.json"), "utf8");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

test("the flow never names the blog-post extension any more", () => {
  assert.equal(
    oasText.includes("@cinatra-ai/blog-post-artifact"),
    false,
    "the edited revision is minted on the LinkedIn type, not on the blog post",
  );
});

test("the mid-run emit names the LinkedIn extension", () => {
  assert.ok(oasText.includes("@cinatra-ai/linkedin-artifacts"));
});

test("the produces entry is typed to the LinkedIn post draft", () => {
  assert.deepEqual(manifest.cinatra.produces, [
    {
      extension: "@cinatra-ai/linkedin-artifacts",
      objectTypeId: "@cinatra-ai/linkedin:post-draft",
    },
  ]);
});

test("the one artifact dependency edge is the LinkedIn type", () => {
  const names = (manifest.cinatra.dependencies || [])
    .filter((d) => d.kind === "artifact")
    .map((d) => d.packageName);
  assert.deepEqual(names, ["@cinatra-ai/linkedin-artifacts"]);
});
