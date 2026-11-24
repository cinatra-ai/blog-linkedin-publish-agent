// THE REVIEW BEFORE THE PUBLISH (cinatra-ai/cinatra#4762, #4150; design
// app-lifecycle-cards section XV). The host opens a publish card only after an
// approved review earlier in the SAME run. A run with no review stops at the
// publishing step with "No approved review came before this change outside
// Cinatra." and never reaches the card.
//
// The pack's part is a review step in its own flow, in the form the host reads:
//
//   - the host's compiler copies `metadata.cinatra.artifactReview.targetsInput`
//     of an InputMessageNode onto the compiled step; the executor then reads the
//     input that marker names as the review target set and asks its review core
//     to open the host's review card over exactly those revisions (one gate per
//     artifact, task id `wayflow-<task>`), while the run parks there;
//   - on the pinned runtime a gate's input values reach the host only when the
//     gate sets `surfaceGateInputs: true` (the loader renders them into the
//     gate's message, and the host parses that message);
//   - the set is a JSON text of `[{ artifactId, representationRevisionId }]`.
//
// The pack check (`agent-publish-gate`) refuses a waiting step DIRECTLY in front
// of a publishing step (it walks back through branching steps only), so the
// deterministic reads stand between the review and the publish.

import { expect, test } from "vitest";

import { manifest, node, oas, titles } from "./__tests__/contract-readers.mjs";

const GATHER = "gather_review_target";
const REVIEW = "post_review_gate";
const PUBLISH = "publish";

const ref = (r) => r?.$component_ref;
const edges = (oas.control_flow_connections ?? []).map((e) => [ref(e.from_node), ref(e.to_node)]);
const dataInto = (id, input) =>
  (oas.data_flow_connections ?? [])
    .filter((e) => ref(e.destination_node) === id && e.destination_input === input)
    .map((e) => `${ref(e.source_node)}.${e.source_output}`);

/** The node ids in control-flow order, from the start node. */
function chain() {
  const out = [];
  for (let at = ref(oas.start_node); at && !out.includes(at); ) {
    out.push(at);
    const next = edges.filter(([from]) => from === at).map(([, to]) => to);
    at = next.length === 1 ? next[0] : undefined;
  }
  return out;
}

test("a review step comes before the publishing step in the run (red: the review removed, moved after the publish, or the publish reachable without it)", () => {
  const order = chain();
  expect(order.indexOf(REVIEW)).toBeGreaterThan(-1);
  expect(order.indexOf(PUBLISH)).toBeGreaterThan(order.indexOf(REVIEW));
  // The flow has no branch, so every road to the publish passes the review.
  expect(new Set(edges.map(([from]) => from)).size).toBe(edges.length);
  expect(order.slice(0, 5)).toEqual(["start", GATHER, REVIEW, "read_post_record", "read_post_text"]);
});

test("the review step is declared in the form the host reads (red: the marker, the surfacing flag or the target input changed)", () => {
  const review = node(REVIEW);
  expect(review.component_type).toBe("InputMessageNode");
  const cinatra = review.metadata.cinatra;
  expect(cinatra.artifactReview).toEqual({ targetsInput: "reviewTargets" });
  expect(cinatra.surfaceGateInputs, "strict true: the loader's identity check").toBe(true);
  expect(cinatra.requiresApproval).toBe(true);
  expect(titles(review.inputs)).toEqual(["reviewTargets"]);
  expect(review.inputs[0].type).toBe("string");
  expect(cinatra.publishes, "the review publishes nothing").toBeUndefined();
});

test("the review pins the revision the run started with, and the read takes the revision its answer approved (red: the target set fed from anything but the two start inputs, or the read fed from the start revision)", () => {
  expect(dataInto(REVIEW, "reviewTargets")).toEqual([`${GATHER}.reviewTargets`]);
  for (const input of ["linkedinArtifactId", "linkedinRepresentationRevisionId"]) {
    expect(dataInto(GATHER, input)).toEqual([`start.${input}`]);
  }
  // The answer names the approved revision (publish-the-approved-revision.test.mjs).
  expect(dataInto("read_post_text", "reviewApproval")).toEqual([`${REVIEW}.reviewApproval`]);
  expect(dataInto("read_post_text", "linkedinArtifactId"), "the artifact under review").toEqual(["start.linkedinArtifactId"]);
  expect(dataInto("read_post_text", "linkedinRepresentationRevisionId")).toEqual([]);
  const gather = node(GATHER);
  expect(gather.url).toBe("{{CINATRA_BASE_URL}}/api/agents/passthrough");
  expect(gather.data.tool).toBe("artifacts_get");
  expect(gather.data.result_input_passthrough).toBe(true);
  expect(gather.data.input.artifactId).toBe("{{ linkedinArtifactId }}");
  expect(gather.metadata.cinatra.riskClass).toBe("read_only");
  expect(titles(gather.outputs)).toEqual(["reviewTargets"]);
  // Rendered with sample ids, the set is the one target the host's core accepts.
  const rendered = gather.data.input.reviewTargets
    .replace("{{ linkedinArtifactId }}", "art-1")
    .replace("{{ linkedinRepresentationRevisionId }}", "rev-1");
  expect(JSON.parse(rendered)).toEqual([{ artifactId: "art-1", representationRevisionId: "rev-1" }]);
});

test("the review is not a confirm step of the pack's own (red: the review directly in front of the publish, or a screen shipped for it)", () => {
  const into = edges.filter(([, to]) => to === PUBLISH).map(([from]) => node(from).component_type);
  expect(into).not.toContain("InputMessageNode");
  expect(JSON.stringify(node(REVIEW))).not.toMatch(/a2uiSurfaceId|renderer/);
  expect((manifest.cinatra.fieldRenderers ?? []).filter((r) => Object.hasOwn(r, "component"))).toEqual([]);
  expect(manifest.cinatra.hasApprovalGates, "the manifest says the flow waits for a person").toBe(true);
});
