// The publish follows the person's decision (cinatra-ai/cinatra#3745, the
// pack's side).
//
// A run of this agent posts to LinkedIn on a person's behalf. The platform
// holds a post tool of a run until the person's decision on that run's action
// is recorded, and it holds it by the tool's name. This suite pins the two
// things the FLOW itself owes that rule, over cinatra/oas.json and
// package.json:
//
//   1. The post is made in one step only, and that step is reached only
//      through the steps in front of it. No step is a way round it, no step
//      branches, and no other step names a tool the platform holds for a
//      decision.
//   2. The person's decision stands in front of the post, in the form the pack
//      holds it: either the step declares that it publishes and the
//      application asks on its own card before the step runs, or the step's
//      recipe asks first on the pack's own confirmation screen. The step
//      reaches the post tool through the host's own tool service, by the name
//      the platform holds, and the manifest consumes that tool.
//
// The pack's flow does not evaluate the decision itself, so there is no road
// of its own to keep: the flow and the platform's hold are the two halves.
//
// The pins hold at the base: they guard it. Each test names the change that
// turns it red.
//
// Known limits
//   - A tool name is read as a snake_case word (it has an underscore) or as a
//     name followed directly by "(" in the call data of an ApiNode step. A
//     tool named by one plain word with no parenthesis is not seen.
//   - OUTWARD below is a copy of the platform's list of the tools it holds
//     for a decision. It is a change detector: when the platform changes its
//     list, this one is changed in the same commit.
//   - This package's own CI classifies it as a source mirror and skips the
//     standalone test step; the suite runs where the package is installed.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

const root = new URL("../", import.meta.url);
const readJson = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, root)), "utf8"));
const oas = readJson("cinatra/oas.json");
const manifest = readJson("package.json");

const steps = oas.$referenced_components ?? {};
const refOf = (r) => r?.$component_ref;
const edges = (oas.control_flow_connections ?? []).map((e) => ({
  from: refOf(e.from_node),
  to: refOf(e.to_node),
  branch: e.from_branch,
}));
const into = (id) => edges.filter((e) => e.to === id);
const outOf = (id) => edges.filter((e) => e.from === id);

const START = "start";
const GATHER_REVIEW = "gather_review_target";
const REVIEW = "post_review_gate";
const READ_RECORD = "read_post_record";
const READ_TEXT = "read_post_text";
const PUBLISH = "publish";
const WRITE_BACK = "write_address";
const END = "end";
const CHAIN = [START, GATHER_REVIEW, REVIEW, READ_RECORD, READ_TEXT, PUBLISH, WRITE_BACK, END];

const POST_TOOL = "linkedin_post_publish";

// The tools the platform holds for the person's recorded decision on a run.
const OUTWARD = [
  "agent_creation_request_decide",
  "agent_creation_request_propose",
  "agent_creation_request_retry_publish",
  "agent_registry_publish",
  "agent_run_resume",
  "agent_source_publish",
  "approvals_decide",
  "artifact_source_publish",
  "blog_post_publish_linkedin_publish",
  "email_outreach_send_initial_cancel",
  "email_outreach_send_initial_start",
  "email_outreach_send_test_start",
  "email_outreach_system_jobs_initial_send_run",
  "email_outreach_system_process_due_follow_ups",
  "email_send",
  "email_test_delivery_run_send",
  "gmail_email_send",
  "linkedin_post_publish",
  "permissions_members_invite",
  "skill_source_publish",
  "social_media_publish",
];

const TEMPLATE = /\{\{[\s\S]*?\}\}|\{#[\s\S]*?#\}/g;
const SNAKE_NAME = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;
const CALLED_NAME = /\b([A-Za-z_][A-Za-z0-9_]*)\(/g;

function stringsOf(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) stringsOf(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) stringsOf(v, out);
  return out;
}

/** Every tool-shaped name in a step's call data, template slots and comments left out. */
function namesIn(step) {
  const names = new Set();
  for (const raw of stringsOf(step.data ?? {})) {
    const text = raw.replace(TEMPLATE, " ");
    for (const m of text.matchAll(SNAKE_NAME)) names.add(m[0]);
    for (const m of text.matchAll(CALLED_NAME)) names.add(m[1]);
  }
  if (typeof step.data?.tool === "string") names.add(step.data.tool);
  return [...names].sort();
}

const apiSteps = () => Object.entries(steps).filter(([, c]) => c.component_type === "ApiNode");
const isModelStep = (c) => /\/api\/llm-bridge$/.test(c.url ?? "");
const publish = steps[PUBLISH];

// ---------------------------------------------------------------------------
// 1. One step posts, and it is reached only through the steps in front of it
// ---------------------------------------------------------------------------

test("the flow is the one chain of steps this suite names, with no branch and no nested flow (red: a step added or removed, an edge around the publish step, a branching step, a nested flow or a second waiting step)", () => {
  const nodeIds = (oas.nodes ?? []).map(refOf);
  expect([...nodeIds].sort()).toEqual([...CHAIN].sort());
  expect(Object.keys(steps).sort()).toEqual([...CHAIN].sort());
  expect(refOf(oas.start_node)).toBe(START);
  expect(edges.map((e) => `${e.from}>${e.to}`)).toEqual(CHAIN.slice(1).map((id, i) => `${CHAIN[i]}>${id}`));
  expect(edges.filter((e) => e.branch !== undefined)).toEqual([]);
  const odd = Object.values(steps).filter((c) =>
    ["BranchingNode", "FlowNode", "Flow", "ParallelFlowNode"].includes(c.component_type),
  );
  expect(odd).toEqual([]);
  // The one step that waits for a person is the host's review (cinatra-ai/cinatra#4762).
  const waiting = Object.entries(steps).filter(([, c]) => c.component_type === "InputMessageNode").map(([id]) => id);
  expect(waiting).toEqual([REVIEW]);
  expect(steps[START].component_type).toBe("StartNode");
  expect(steps[END].component_type).toBe("EndNode");
});

test("the publish step is the only model step and is reached only from the read of the pinned words (red: a second way into the publish step, or a second model step)", () => {
  expect(into(PUBLISH).map((e) => e.from)).toEqual([READ_TEXT]);
  expect(outOf(PUBLISH).map((e) => e.to)).toEqual([WRITE_BACK]);
  expect(apiSteps().filter(([, c]) => isModelStep(c)).map(([id]) => id)).toEqual([PUBLISH]);
  expect(publish.component_type).toBe("ApiNode");
  expect(publish.metadata?.cinatra?.riskClass).toBe("write");
});

test("only the publish step names a tool the platform holds for a decision, and it names the post tool alone (red: a held tool named by any other step, or a second held tool named by the publish step)", () => {
  for (const [id, step] of apiSteps()) {
    const held = namesIn(step).filter((name) => OUTWARD.includes(name));
    expect(held, id).toEqual(id === PUBLISH ? [POST_TOOL] : []);
  }
});

test("the steps around the publish step are the host's own reads, the read of the approved revision through the pack's declared tool, and the write-back, none of them a send or a publish (red: another tool or another passthrough step)", () => {
  const tools = Object.fromEntries(
    apiSteps()
      .filter(([, c]) => !isModelStep(c))
      .map(([id, c]) => [id, c.data?.tool]),
  );
  expect(tools).toEqual({
    [GATHER_REVIEW]: "artifacts_get",
    [READ_RECORD]: "artifacts_get",
    [READ_TEXT]: "extension_tool",
    [WRITE_BACK]: "objects_update",
  });
  for (const id of [GATHER_REVIEW, READ_RECORD, READ_TEXT]) expect(steps[id].metadata.cinatra.riskClass).toBe("read_only");
  expect(steps[READ_TEXT].data.input.name).toBe("approved_post_text");
});

// ---------------------------------------------------------------------------
// 2. The decision stands in front of the post
// ---------------------------------------------------------------------------

const recipe = () => String(publish.data?.system ?? "");

test("the person's decision stands in front of the post, held by the application or asked by the step's own screen (red: neither form, both forms at once, or the confirmation after the post)", () => {
  const cinatra = publish.metadata.cinatra;
  const hitl = oas.metadata?.cinatra?.hitlScreens;
  if (cinatra.publishes === true) {
    // The application holds the run in front of this step and asks on its own
    // card; the recipe asks nothing and the pack names no screen of its own.
    expect(Array.isArray(cinatra.publishRows)).toBe(true);
    expect(cinatra.publishRows.length).toBeGreaterThanOrEqual(1);
    expect(cinatra.publishRows.length).toBeLessThanOrEqual(2);
    expect(recipe()).not.toMatch(/INTERRUPT/);
    expect(hitl ?? []).toEqual([]);
    return;
  }
  expect(cinatra.publishes).toBeUndefined();
  expect(cinatra.publishRows).toBeUndefined();
  expect(Array.isArray(hitl) && hitl.length === 1).toBe(true);
  expect(recipe()).toMatch(/INTERRUPT/);
  const confirmation = recipe().search(/^### Step \d+ — the confirmation/m);
  const post = recipe().search(/^### Step \d+ — post it/m);
  expect(confirmation).toBeGreaterThan(0);
  expect(post).toBeGreaterThan(confirmation);
});

test("the publish step reaches the post tool through the host's own tool service, by the name the platform holds, and the manifest consumes that tool (red: a toolbox on the step, a tool list that holds more than the post tool, another name for the tool, a tool the manifest does not consume or a connector it does not depend on)", () => {
  expect(Object.hasOwn(publish.metadata.cinatra, "toolboxes")).toBe(false);
  // A list the step declares for its tool offer holds the post tool and no other.
  if (Object.hasOwn(publish.metadata.cinatra, "tools")) expect(publish.metadata.cinatra.tools).toEqual([POST_TOOL]);
  expect(namesIn(publish)).toEqual([POST_TOOL]);
  expect(recipe()).toContain(POST_TOOL);
  const consumed = (manifest.cinatra?.consumes ?? []).map((c) => c.primitive);
  expect(consumed).toContain(POST_TOOL);
  expect(consumed.filter((name) => OUTWARD.includes(name))).toEqual([POST_TOOL]);
  const dependsOn = (manifest.cinatra?.dependencies ?? []).map((d) => d.packageName);
  expect(dependsOn).toContain("@cinatra-ai/linkedin-connector");
});
