// THE CONTRACT THIS AGENT IS FOR (cinatra-ai/cinatra#3035, plan section 6.1
// step 7): "the LinkedIn step, converted the same way, posts the LinkedIn
// artifact with that address; both return receipts, not artifacts".
//
// The pack ships no runtime of its own — an agent's product IS its manifest and
// its flow — so every case below reads those two files. Each names the sentence
// it serves.

import { expect, test } from "vitest";

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
} from "./__tests__/contract-readers.mjs";

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
  expect(inputs, "linkedinArtifactId is an input").toContain("linkedinArtifactId");
  expect(
    inputs,
    "the revision the person continued with is an input",
  ).toContain("linkedinRepresentationRevisionId");
  expect(inputs, "the blog project id is gone").not.toContain("projectId");
  expect(inputs, "the blog post record id is gone").not.toContain("postId");
});

test("the artifact reference is what the person is asked for", () => {
  const meta = node("start").metadata.cinatra;
  expect(meta.required).toEqual([
    "linkedinArtifactId",
    "linkedinRepresentationRevisionId",
    "linkedinAccountId",
    "destinationType",
    "destinationId",
    "destinationName",
  ]);
  expect(
    meta.hidden,
    "the blog address is filled in at the publishing step, never guessed at the start",
  ).toContain("blogPostUrl");
});

test("the copy comes from the PINNED revision, read through the host's primitive", () => {
  const read = passthroughNodes().get("artifact_content_read");
  expect(read, "a deterministic node reads the artifact's content").toBeTruthy();
  expect(read.data.input.artifactId).toBe("{{ linkedinArtifactId }}");
  expect(
    read.data.input.representationRevisionId,
    "the read is pinned to the revision the person continued with, never the latest",
  ).toBe("{{ linkedinRepresentationRevisionId }}");
  expect(read.metadata.cinatra.riskClass).toBe("read_only");
});

test("the read is admitted by a declared artifact dependency", () => {
  expect(
    artifactDependencies(),
    "the type's owning package is declared, which is what admits the read",
  ).toContain("@cinatra-ai/linkedin-artifacts");
  for (const primitive of ["artifacts_get", "artifact_content_read"]) {
    expect(
      consumedPrimitives(),
      `${primitive} is declared in cinatra.consumes`,
    ).toContain(primitive);
  }
});

test("the copy the orchestration posts is that read, not text of its own", () => {
  const fed = oas.data_flow_connections.find(
    (e) =>
      e.source_node.$component_ref === "read_post_text" &&
      e.source_output === "text" &&
      e.destination_node.$component_ref === "publish",
  );
  expect(fed, "the pinned revision's text feeds the orchestration node").toBeTruthy();
  expect(
    bridgeNode().data.system,
    "the recipe forbids drafting: the writer made the post, this agent publishes it",
  ).toMatch(/YOU DO NOT WRITE\./);
});

// ---------------------------------------------------------------------------
// 2. "both return receipts, not artifacts" + the address written back
// ---------------------------------------------------------------------------

test("the agent emits no new artifact — it annotates the one it was handed", () => {
  expect(consumedPrimitives()).not.toContain("artifact_authoring_emit");
  expect(oasText()).not.toContain("artifact_authoring_emit");
  // And so it declares no produced type. The only write this flow makes is the
  // three-key address patch merged onto the artifact it was given: an address
  // recorded on an existing row, not a revision of the post's words. A produced
  // type would have to name a revision this flow persists, and there is none —
  // the writer agent authors the post-draft and declares it against its own end
  // node's binding.
  expect(
    manifest.cinatra.produces,
    "the publisher annotates the post-draft it was handed, and produces nothing",
  ).toEqual([]);
});

test("the address is written back onto the SAME artifact, through the host's write-back primitive", () => {
  const write = passthroughNodes().get("objects_update");
  expect(write, "a deterministic node writes through objects_update").toBeTruthy();
  expect(
    write.data.input.objectId,
    "the write lands on the artifact that was read, never a new row",
  ).toBe("{{ linkedinArtifactId }}");
  expect(write.data.input.data).toBe("{{ addressPatch }}");
  expect(
    write.metadata.cinatra.riskClass,
    "a persisting node is never labelled read_only",
  ).not.toBe("read_only");
  expect(consumedPrimitives()).toContain("objects_update");
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
    expect(
      text,
      `${forbidden} is gone from the flow — the publish is not keyed by a blog record`,
    ).not.toContain(forbidden);
    expect(
      consumedPrimitives(),
      `${forbidden} is gone from cinatra.consumes`,
    ).not.toContain(forbidden);
  }
});

test("the patch carries exactly the three address keys", () => {
  const system = bridgeNode().data.system;
  for (const key of ADDRESS_KEYS) {
    expect(system, `the recipe names ${key}`).toContain(`"${key}"`);
  }
  const patchOutput = bridgeNode().outputs.find((o) => o.title === "addressPatch");
  expect(patchOutput, "the orchestration emits the patch").toBeTruthy();
  expect(patchOutput.type).toBe("object");
});

test("nothing published means nothing written", () => {
  expect(
    bridgeNode().data.system,
    "the recipe states the empty patch, so no empty address is ever merged",
  ).toMatch(/`addressPatch` is `\{\}` exactly/);
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
    expect(outputs, `${t} is a declared output`).toContain(t);
  }
  expect(titles(node("end").outputs)).toEqual(outputs);
  expect(outputs, "the blog-record draft id is not an output").not.toContain("linkedinDraftId");
});

test("the person confirms BEFORE anything goes out", () => {
  const system = bridgeNode().data.system;
  const gate = system.indexOf("### Step 1 — the confirmation");
  const post = system.indexOf("### Step 2 — post it");
  expect(gate, "the recipe opens with the confirmation").toBeGreaterThan(0);
  expect(post, "the publish comes after it").toBeGreaterThan(gate);
  expect(oas.metadata.cinatra.hitlScreens).toEqual([
    "@cinatra-ai/blog-linkedin-publish-agent:draft-review",
  ]);
});

test("the publish goes through the declared connector", () => {
  expect(consumedPrimitives()).toContain("linkedin_post_publish");
  expect(bridgeNode().data.system).toContain("linkedin_post_publish");
  const declared = (manifest.cinatra.dependencies ?? []).map((d) => d.packageName);
  expect(declared).toContain("@cinatra-ai/linkedin-connector");
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
    expect(src, `edge source ${e.source_node.$component_ref} exists`).toBeTruthy();
    expect(dst, `edge destination ${e.destination_node.$component_ref} exists`).toBeTruthy();
    expect(
      titles(src.outputs ?? src.inputs),
      `${e.name}: ${e.source_node.$component_ref} emits ${e.source_output}`,
    ).toContain(e.source_output);
    expect(
      titles(dst.inputs ?? dst.outputs),
      `${e.name}: ${e.destination_node.$component_ref} takes ${e.destination_input}`,
    ).toContain(e.destination_input);
  }
  for (const [id, c] of Object.entries(comps)) {
    if (id === "start") continue;
    for (const input of titles(c.inputs)) {
      expect([...fed], `${id}.${input} has an inbound edge`).toContain(`${id}.${input}`);
    }
  }
});

test("the HITL screen shows the pinned copy and does not edit it", () => {
  const renderer = source("src/renderers/draft-review.tsx");
  expect(renderer).toMatch(/linkedinArtifactId/);
  expect(renderer).toMatch(/linkedinRepresentationRevisionId/);
  expect(renderer, "the blog-record draft id is gone from the screen").not.toContain(
    "linkedinDraftId",
  );
  expect(
    renderer,
    "the screen no longer edits the copy — what is published is the revision the person continued with",
  ).not.toContain("Textarea");
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
  expect(titles(read.outputs), "the host's read reports truncation").toContain("truncated");
  expect(
    titles(bridgeNode().inputs),
    "the orchestration step is told about it",
  ).toContain("truncated");
  expect(
    dataEdge("read_post_text", "truncated", "publish", "truncated"),
    "and it is actually wired, not merely declared",
  ).toBeTruthy();
  const recipe = bridgeNode().data.system;
  expect(recipe).toMatch(/When `truncated` is true/);
  expect(recipe).toMatch(/Never post a cut-short copy/);
});

test("the run reports the address as written only when a patch was built", () => {
  expect(
    titles(bridgeNode().outputs),
    "the orchestration step says whether it built a patch",
  ).toContain("addressWritten");
  const e = edgeInto("end", "addressWritten");
  expect(e, "the end node's addressWritten is fed").toBeTruthy();
  expect(
    e.source_node.$component_ref,
    "from the step that knows whether there was an address — the write node's ok is true for an empty patch too",
  ).toBe("publish");
  expect(e.source_output).toBe("addressWritten");
});

test("the patch's key space is declared closed, not only described", () => {
  const write = passthroughNodes().get("objects_update");
  expect(
    write.metadata.cinatra.addressPatchKeys,
    "the allowlist is a declaration the next leg can read",
  ).toEqual(ADDRESS_KEYS);
  const recipe = bridgeNode().data.system;
  expect(recipe).toMatch(/The patch's key space is CLOSED/);
  expect(
    recipe,
    "an invented key would land on the artifact's own data",
  ).toMatch(/never a field of the artifact itself/);
});
