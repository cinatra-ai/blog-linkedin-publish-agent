// THE CONTRACT THIS AGENT IS FOR (cinatra-ai/cinatra#3035, plan section 6.1
// step 7): "the LinkedIn step, converted the same way, posts the LinkedIn
// artifact with that address; both return receipts, not artifacts".
//
// The pack ships no runtime of its own — an agent's product IS its manifest and
// its flow — so every case below reads those two files. Each names the sentence
// it serves.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  artifactDependencies,
  bridgeNode,
  consumedPrimitives,
  manifest,
  node,
  oas,
  oasText,
  passthroughNodes,
  source,
  titles,
} from "./oas-contract.test.mjs";

const ADDRESS_KEYS = [
  "linkedinPublishedUrl",
  "linkedinPublishedExternalId",
  "linkedinPublishedRevisionId",
];

// ---------------------------------------------------------------------------
// 1. "the revision the person continued with published FROM THE ARTIFACT"
// ---------------------------------------------------------------------------

test("the flow takes an artifact reference, not a blog record", () => {
  const inputs = titles(oas.inputs);
  assert.ok(inputs.includes("linkedinArtifactId"), "linkedinArtifactId is an input");
  assert.ok(
    inputs.includes("linkedinRepresentationRevisionId"),
    "the revision the person continued with is an input",
  );
  assert.ok(!inputs.includes("projectId"), "the blog project id is gone");
  assert.ok(!inputs.includes("postId"), "the blog post record id is gone");
});

test("the artifact reference is what the person is asked for", () => {
  const meta = node("start").metadata.cinatra;
  assert.deepEqual(meta.required, [
    "linkedinArtifactId",
    "linkedinRepresentationRevisionId",
    "linkedinAccountId",
    "destinationType",
    "destinationId",
    "destinationName",
  ]);
  assert.ok(
    meta.hidden.includes("blogPostUrl"),
    "the blog address is filled in at the publishing step, never guessed at the start",
  );
});

test("the copy comes from the PINNED revision, read through the host's primitive", () => {
  const read = passthroughNodes().get("artifact_content_read");
  assert.ok(read, "a deterministic node reads the artifact's content");
  assert.equal(read.data.input.artifactId, "{{ linkedinArtifactId }}");
  assert.equal(
    read.data.input.representationRevisionId,
    "{{ linkedinRepresentationRevisionId }}",
    "the read is pinned to the revision the person continued with, never the latest",
  );
  assert.equal(read.metadata.cinatra.riskClass, "read_only");
});

test("the read is admitted by a declared artifact dependency", () => {
  assert.ok(
    artifactDependencies().includes("@cinatra-ai/linkedin-artifacts"),
    "the type's owning package is declared, which is what admits the read",
  );
  for (const primitive of ["artifacts_get", "artifact_content_read"]) {
    assert.ok(
      consumedPrimitives().includes(primitive),
      `${primitive} is declared in cinatra.consumes`,
    );
  }
});

test("the copy the orchestration posts is that read, not text of its own", () => {
  const fed = oas.data_flow_connections.find(
    (e) =>
      e.source_node.$component_ref === "read_post_text" &&
      e.source_output === "text" &&
      e.destination_node.$component_ref === "publish",
  );
  assert.ok(fed, "the pinned revision's text feeds the orchestration node");
  assert.match(
    bridgeNode().data.system,
    /YOU DO NOT WRITE\./,
    "the recipe forbids drafting: the writer made the post, this agent publishes it",
  );
});

// ---------------------------------------------------------------------------
// 2. "both return receipts, not artifacts" + the address written back
// ---------------------------------------------------------------------------

test("the agent emits no new artifact — it re-targets the one it was handed", () => {
  assert.ok(!consumedPrimitives().includes("artifact_authoring_emit"));
  assert.ok(!oasText().includes("artifact_authoring_emit"));
  // The declaration table gives this agent one produced type: the LinkedIn
  // post-draft it re-targets mid-run. Producing it is a write onto the artifact
  // it was given, never an authoring emit and never a second artifact.
  assert.deepEqual(
    manifest.cinatra.produces.map((e) => e.objectTypeId),
    ["@cinatra-ai/linkedin:post-draft"],
    "the publisher re-targets the post-draft it was handed, and nothing else",
  );
});

test("the address is written back onto the SAME artifact, through the host's write-back primitive", () => {
  const write = passthroughNodes().get("objects_update");
  assert.ok(write, "a deterministic node writes through objects_update");
  assert.equal(
    write.data.input.objectId,
    "{{ linkedinArtifactId }}",
    "the write lands on the artifact that was read, never a new row",
  );
  assert.equal(write.data.input.data, "{{ addressPatch }}");
  assert.notEqual(
    write.metadata.cinatra.riskClass,
    "read_only",
    "a persisting node is never labelled read_only",
  );
  assert.ok(consumedPrimitives().includes("objects_update"));
});

test("the address never travels a side channel", () => {
  const text = oasText();
  for (const forbidden of [
    "blog_post_publish_linkedin_start",
    "blog_post_publish_linkedin_update",
    "blog_post_publish_linkedin_publish",
    "blog_post_publish_linkedin_cancel",
    "blog_project_get",
  ]) {
    assert.ok(
      !text.includes(forbidden),
      `${forbidden} is gone from the flow — the publish is not keyed by a blog record`,
    );
    assert.ok(
      !consumedPrimitives().includes(forbidden),
      `${forbidden} is gone from cinatra.consumes`,
    );
  }
});

test("the patch carries exactly the three address keys", () => {
  const system = bridgeNode().data.system;
  for (const key of ADDRESS_KEYS) {
    assert.ok(system.includes(`"${key}"`), `the recipe names ${key}`);
  }
  const patchOutput = bridgeNode().outputs.find((o) => o.title === "addressPatch");
  assert.ok(patchOutput, "the orchestration emits the patch");
  assert.equal(patchOutput.type, "object");
});

test("nothing published means nothing written", () => {
  assert.match(
    bridgeNode().data.system,
    /`addressPatch` is `\{\}` exactly/,
    "the recipe states the empty patch, so no empty address is ever merged",
  );
});

// ---------------------------------------------------------------------------
// 3. "the declared inputs/outputs updated so the pipeline's end node can bind"
// ---------------------------------------------------------------------------

test("the end node hands the pipeline the address it published", () => {
  const outputs = titles(oas.outputs);
  for (const t of [
    "linkedinArtifactId",
    "linkedinRepresentationRevisionId",
    "linkedinPostUrl",
    "linkedinPostExternalId",
    "approved",
    "addressWritten",
    "summary",
  ]) {
    assert.ok(outputs.includes(t), `${t} is a declared output`);
  }
  assert.deepEqual(titles(node("end").outputs), outputs);
  assert.ok(!outputs.includes("linkedinDraftId"), "the blog-record draft id is not an output");
});

test("the person confirms BEFORE anything goes out", () => {
  const system = bridgeNode().data.system;
  const gate = system.indexOf("### Step 1 — the confirmation");
  const post = system.indexOf("### Step 2 — post it");
  assert.ok(gate > 0, "the recipe opens with the confirmation");
  assert.ok(post > gate, "the publish comes after it");
  assert.deepEqual(oas.metadata.cinatra.hitlScreens, [
    "@cinatra-ai/blog-linkedin-publish-agent:draft-review",
  ]);
});

test("the publish goes through the declared connector", () => {
  assert.ok(consumedPrimitives().includes("linkedin_post_publish"));
  assert.ok(bridgeNode().data.system.includes("linkedin_post_publish"));
  const declared = (manifest.cinatra.dependencies ?? []).map((d) => d.packageName);
  assert.ok(declared.includes("@cinatra-ai/linkedin-connector"));
});

// ---------------------------------------------------------------------------
// The flow's own integrity — a typo in a reference is a broken agent.
// ---------------------------------------------------------------------------

test("every node input is fed and every edge resolves", () => {
  const comps = oas.$referenced_components;
  const fed = new Set(
    oas.data_flow_connections.map(
      (e) => `${e.destination_node.$component_ref}.${e.destination_input}`,
    ),
  );
  for (const e of oas.data_flow_connections) {
    const src = comps[e.source_node.$component_ref];
    const dst = comps[e.destination_node.$component_ref];
    assert.ok(src, `edge source ${e.source_node.$component_ref} exists`);
    assert.ok(dst, `edge destination ${e.destination_node.$component_ref} exists`);
    assert.ok(
      titles(src.outputs ?? src.inputs).includes(e.source_output),
      `${e.name}: ${e.source_node.$component_ref} emits ${e.source_output}`,
    );
    assert.ok(
      titles(dst.inputs ?? dst.outputs).includes(e.destination_input),
      `${e.name}: ${e.destination_node.$component_ref} takes ${e.destination_input}`,
    );
  }
  for (const [id, c] of Object.entries(comps)) {
    if (id === "start") continue;
    for (const input of titles(c.inputs)) {
      assert.ok(fed.has(`${id}.${input}`), `${id}.${input} has an inbound edge`);
    }
  }
});

test("the HITL screen shows the pinned copy and does not edit it", () => {
  const renderer = source("src/renderers/draft-review.tsx");
  assert.match(renderer, /linkedinArtifactId/);
  assert.match(renderer, /linkedinRepresentationRevisionId/);
  assert.ok(!renderer.includes("linkedinDraftId"), "the blog-record draft id is gone from the screen");
  assert.ok(
    !renderer.includes("Textarea"),
    "the screen no longer edits the copy — what is published is the revision the person continued with",
  );
});

// ---------------------------------------------------------------------------
// 7. The convergence round: what the pinned revision means at the edges
// ---------------------------------------------------------------------------

const dataEdge = (s, so, dn, di) =>
  (oas.data_flow_connections ?? []).find(
    (c) =>
      c.source_node?.$component_ref === s &&
      c.source_output === so &&
      c.destination_node?.$component_ref === dn &&
      c.destination_input === di,
  );
const edgeInto = (dn, di) =>
  (oas.data_flow_connections ?? []).find(
    (c) => c.destination_node?.$component_ref === dn && c.destination_input === di,
  );

test("a cut-short read is never posted as the pinned revision", () => {
  const read = passthroughNodes().get("artifact_content_read");
  assert.ok(
    titles(read.outputs).includes("truncated"),
    "the host's read reports truncation",
  );
  assert.ok(
    titles(bridgeNode().inputs).includes("truncated"),
    "the orchestration step is told about it",
  );
  assert.ok(
    dataEdge("read_post_text", "truncated", "publish", "truncated"),
    "and it is actually wired, not merely declared",
  );
  const recipe = bridgeNode().data.system;
  assert.match(recipe, /When `truncated` is true/);
  assert.match(recipe, /Never post a cut-short copy/);
});

test("the run reports the address as written only when a patch was built", () => {
  assert.ok(
    titles(bridgeNode().outputs).includes("addressWritten"),
    "the orchestration step says whether it built a patch",
  );
  const e = edgeInto("end", "addressWritten");
  assert.ok(e, "the end node's addressWritten is fed");
  assert.equal(
    e.source_node.$component_ref,
    "publish",
    "from the step that knows whether there was an address — the write node's ok is true for an empty patch too",
  );
  assert.equal(e.source_output, "addressWritten");
});

test("the patch's key space is declared closed, not only described", () => {
  const write = passthroughNodes().get("objects_update");
  assert.deepEqual(
    write.metadata.cinatra.addressPatchKeys,
    ADDRESS_KEYS,
    "the allowlist is a declaration the next leg can read",
  );
  const recipe = bridgeNode().data.system;
  assert.match(recipe, /The patch's key space is CLOSED/);
  assert.match(
    recipe,
    /never a field of the artifact itself/,
    "an invented key would land on the artifact's own data",
  );
});
