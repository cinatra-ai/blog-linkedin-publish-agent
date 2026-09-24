// THE CONFIRMATION IS A GATE THE FLOW STOPS AT, not prose inside the
// orchestration's instructions (cinatra-ai/cinatra#3564).
//
// The host raises a pack's screen as a pause in exactly one way: an authored
// `InputMessageNode` in the flow, whose renderer is named in its
// metadata.cinatra and whose single string output carries the person's answer
// back into the flow. A sentence in a bridge node's system prompt reaches no
// such road, so a run that only "asks" there never stops. This file pins the
// gate as a node, on the only control road into `publish`, in the shape the
// pinned runtime can mount, and pins the answer the screen hands back as the
// value `publish` reads.
//
// The pack ships no runtime of its own, so the flow cases read the two
// declaration files; the decision case imports the renderer's pure decision
// module, which has no imports of its own and needs no DOM.

import { expect, test } from "vitest";

import {
  bridgeNode,
  components,
  manifest,
  node,
  oas,
  source,
  titles,
} from "./__tests__/contract-readers.mjs";

import { draftReviewDecision } from "../src/renderers/draft-review-decision.ts";

const RENDERER = "@cinatra-ai/blog-linkedin-publish-agent:draft-review";
const PLAIN_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const gates = () =>
  Object.entries(components).filter(([, c]) => c?.component_type === "InputMessageNode");

const controlEdges = () =>
  (oas.control_flow_connections ?? []).map((e) => [
    e.from_node.$component_ref,
    e.to_node.$component_ref,
  ]);

/** Whether `to` is reachable from `from` over the control edges, never entering `avoid`. */
function reachable(from, to, avoid) {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length > 0) {
    const at = queue.shift();
    if (at === to) return true;
    for (const [a, b] of controlEdges()) {
      if (a !== at || b === avoid || seen.has(b)) continue;
      seen.add(b);
      queue.push(b);
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// (i) the gate exists, and it is the only road into `publish`
// ---------------------------------------------------------------------------

test("exactly one InputMessageNode gate stands on every control path from start to publish", () => {
  const found = gates();
  expect(found.map(([id]) => id), "the flow carries exactly one gate node").toHaveLength(1);
  const [gateId] = found[0];
  expect(
    oas.nodes.map((n) => n.$component_ref),
    "the gate is one of the flow's nodes, not only a referenced component",
  ).toContain(gateId);
  expect(reachable("start", gateId), "the run reaches the gate").toBe(true);
  expect(reachable(gateId, "publish"), "the gate leads on to the publish step").toBe(true);
  expect(
    reachable("start", "publish", gateId),
    "no control path reaches the publish step except through the gate",
  ).toBe(false);
  expect(
    controlEdges()
      .filter(([, b]) => b === "publish")
      .map(([a]) => a),
    "the one control edge into publish comes from the gate",
  ).toEqual([gateId]);
});

// ---------------------------------------------------------------------------
// (ii) the gate has the shape the pinned runtime mounts (OAS-RUNTIME-013)
// ---------------------------------------------------------------------------

test("the gate names the pack's screen and has the mountable gate shape", () => {
  const [[gateId, gate]] = gates();
  const meta = gate.metadata?.cinatra ?? {};
  expect(meta.renderer, "the gate raises the screen the flow declares").toBe(
    oas.metadata.cinatra.hitlScreens[0],
  );
  expect(meta.renderer, "and the screen the manifest registers").toBe(
    manifest.cinatra.fieldRenderers[0].id,
  );
  expect(meta.renderer).toBe(RENDERER);
  expect(meta.requiresApproval, "the gate is an approval").toBe(true);
  expect(meta.surfaceGateInputs, "the gate hands its inputs to the screen").toBe(true);
  expect(meta.riskClass).toBe("approval");

  expect(gate.outputs, "a gate returns exactly one output").toHaveLength(1);
  expect(gate.outputs[0].type, "and it is the answer as a string").toBe("string");
  expect(gate.outputs[0].title).toBe("userResponse");
  expect(gate.message_template, "the runtime synthesizes the message itself").toBeUndefined();
  expect(
    Object.values(components).some((c) => c?.component_type === "PluginInputMessageNode"),
    "the reconciled form is never authored",
  ).toBe(false);

  const inputTitles = titles(gate.inputs);
  for (const t of inputTitles) {
    expect(t, `${t} is a plain identifier`).toMatch(PLAIN_IDENTIFIER);
  }
  expect(new Set(inputTitles).size, "every input title is unique").toBe(inputTitles.length);

  const expectedFeeds = {
    linkedinArtifactId: "start.linkedinArtifactId",
    linkedinRepresentationRevisionId: "start.linkedinRepresentationRevisionId",
    linkedinAccountName: "start.linkedinAccountName",
    destinationName: "start.destinationName",
    destinationType: "start.destinationType",
    blogPostUrl: "start.blogPostUrl",
    content: "read_post_text.text",
  };
  expect([...inputTitles].sort()).toEqual(Object.keys(expectedFeeds).sort());
  for (const [input, feed] of Object.entries(expectedFeeds)) {
    const edges = oas.data_flow_connections.filter(
      (e) => e.destination_node.$component_ref === gateId && e.destination_input === input,
    );
    expect(edges, `${gateId}.${input} is fed by exactly one data edge`).toHaveLength(1);
    expect(`${edges[0].source_node.$component_ref}.${edges[0].source_output}`).toBe(feed);
  }
});

// ---------------------------------------------------------------------------
// (iii) the publish step reads the answer the person gave on the screen
// ---------------------------------------------------------------------------

test("the publish step takes the gate's answer as its confirmation input", () => {
  const [[gateId]] = gates();
  const publish = node("publish");
  const confirmation = (publish.inputs ?? []).find((i) => i.title === "confirmation");
  expect(confirmation, "publish declares a confirmation input").toBeTruthy();
  expect(confirmation.type).toBe("string");
  const fed = oas.data_flow_connections.filter(
    (e) =>
      e.destination_node.$component_ref === "publish" && e.destination_input === "confirmation",
  );
  expect(fed, "the confirmation input is fed by one data edge").toHaveLength(1);
  expect(fed[0].source_node.$component_ref).toBe(gateId);
  expect(fed[0].source_output).toBe("userResponse");
  expect(
    bridgeNode().data.system,
    "the recipe no longer asks the model to raise the screen itself",
  ).not.toContain("Emit INTERRUPT");

  // The answer is rendered into the step's own message, and the recipe posts
  // only on an approval of exactly this artifact revision.
  const user = bridgeNode().data.user;
  expect(user, "the input hint names the confirmation").toMatch(
    /pyagentspec-input-hint:[^#]*\{\{ confirmation \}\}[^#]*#\}/,
  );
  expect(user, "the confirmation is rendered into the message").toContain(
    "- confirmation: {{ confirmation }}",
  );
  const system = bridgeNode().data.system;
  const step1 = system.indexOf("### Step 1");
  const step2 = system.indexOf("### Step 2");
  expect(step1, "Step 1 exists").toBeGreaterThan(-1);
  expect(step2, "the confirmation precedes the post").toBeGreaterThan(step1);
  const rule = system.slice(step1, step2);
  expect(rule).toContain(
    "The post goes out ONLY when `confirmation` parses as a JSON object whose `approved` is `true`, whose `linkedinArtifactId` equals `linkedinArtifactId` and whose `linkedinRepresentationRevisionId` equals `linkedinRepresentationRevisionId`.",
  );
  for (const refused of [
    "a decline (`approved: false`)",
    "a reference to another artifact or revision",
    "an empty answer",
    "text that is not a JSON object",
    "the bare marker `[Approved by operator]`",
  ]) {
    expect(rule, `${refused} is not a confirmation`).toContain(refused);
  }
  expect(rule).toContain(
    "On anything but a confirmation, post nothing and return the envelope of Step 4 with `approved: false`",
  );
  expect(rule, "a refused answer writes nothing onto the artifact").toContain("`addressPatch: {}`");
});

// ---------------------------------------------------------------------------
// (iv) the screen's decision rides the answer the host hands the flow
// ---------------------------------------------------------------------------

test("the screen's decision is carried in the answer, for a post and for a decline", () => {
  for (const approved of [true, false]) {
    const decision = draftReviewDecision(approved, "artifact-1", "revision-7");
    expect(decision.approved).toBe(approved);
    expect(decision.linkedinArtifactId).toBe("artifact-1");
    expect(decision.linkedinRepresentationRevisionId).toBe("revision-7");
    expect(typeof decision.userResponse).toBe("string");
    expect(JSON.parse(decision.userResponse)).toEqual({
      approved,
      linkedinArtifactId: "artifact-1",
      linkedinRepresentationRevisionId: "revision-7",
    });
  }

  // Both buttons hand the host the decision module's output, so the answer the
  // host resumes the flow with is never the bare approval marker. The suite
  // mounts no DOM, so the renderer is read as source, as the pack's other
  // renderer arms do.
  const renderer = source("src/renderers/draft-review.tsx");
  expect(renderer).toContain('import { draftReviewDecision } from "./draft-review-decision";');
  const calls = renderer.match(/onChangeRef\.current\(/g) ?? [];
  expect(calls, "the renderer hands the host one kind of value").toHaveLength(1);
  expect(renderer).toMatch(/onChangeRef\.current\(\s*draftReviewDecision\(/);
  expect(renderer, "the approve button decides true").toContain("onClick={decide(true)}");
  expect(renderer, "the decline button decides false").toContain("onClick={decide(false)}");
});
