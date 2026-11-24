// THE PUBLISH DECLARATION (cinatra-ai/cinatra#4150): the run stops in front of
// the step that publishes and waits for one person's answer on the host's
// publish card. The pack's part is a declaration in its flow, read by two
// readers this file mirrors:
//
//   - the host's flow compiler: `metadata.cinatra.publishes` is the JSON
//     boolean `true` on the publishing step, a top-level node of an action
//     kind; beside it, `metadata.cinatra.publishRows` lists the one or two rows
//     the card shows, each `{ label, input }`, the label one line of 1 to 60
//     characters with no edge space, the input the title of one of that
//     step's own inputs (the values the stop holds), no input twice. The key
//     is refused anywhere else.
//   - the pack check (`agent-publish-gate`): every step that can reach a
//     connector declares a boolean `publishes`, no id takes the host's gate
//     prefix, and the pack keeps no confirm step of its own in front of a
//     publishing step (no root `hitlScreens` entry beside it, no waiting node,
//     no `requiresApproval` other than false).
//
// So the prompt-level confirmation and its screen are gone: the host's card is
// the one stop. The package keeps declaring the former screen's id, without a
// component, only for a run that paused there before this version (the last
// case below). The step's prompt runs only after the person approved on that
// card, so every branch of it returns `approved: true`; a failure shows in the
// other outputs.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

import { manifest, node, oas, titles } from "./__tests__/contract-readers.mjs";

const GATE_PREFIX = "cinatra_publish_gate__";
const ACTION_KINDS = new Set(["ApiNode", "AgentNode", "FlowNode", "ParallelFlowNode"]);
const NO_CONNECTOR_KINDS = new Set([
  "StartNode",
  "EndNode",
  "InputMessageNode",
  "OutputMessageNode",
  "BranchingNode",
]);

const components = oas.$referenced_components ?? {};
const topLevel = (oas.nodes ?? []).map((n) => n.$component_ref);
const cinatraOf = (c) => c?.metadata?.cinatra ?? {};
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/** Every object in the flow file, the root included, with the path to it. */
function everyObject(value, path = "$", out = []) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => everyObject(item, `${path}[${i}]`, out));
  } else if (value && typeof value === "object") {
    out.push([path, value]);
    for (const [k, v] of Object.entries(value)) everyObject(v, `${path}.${k}`, out);
  }
  return out;
}

test("the publishing step is declared, as the only one, on a top-level action node", () => {
  const declared = Object.entries(components)
    .filter(([, c]) => cinatraOf(c).publishes === true)
    .map(([id]) => id);
  expect(declared, "exactly the publish step publishes").toEqual(["publish"]);
  const publish = node("publish");
  expect(publish.metadata.cinatra.publishes, "the literal JSON boolean true").toBe(true);
  expect(topLevel, "a top-level node, where the host can stop in front of it").toContain(
    "publish",
  );
  expect(ACTION_KINDS.has(publish.component_type)).toBe(true);
});

test("the write-back step writes but does not publish", () => {
  expect(node("write_address").metadata.cinatra.publishes).toBe(false);
});

test("every step that can reach a connector declares publishes, and no id takes the gate prefix", () => {
  const undeclared = [];
  const malformed = [];
  for (const [id, c] of Object.entries(components)) {
    const meta = cinatraOf(c);
    if (has(meta, "publishes")) {
      if (typeof meta.publishes !== "boolean") malformed.push(id);
      continue;
    }
    if (NO_CONNECTOR_KINDS.has(c.component_type)) continue;
    if (meta.riskClass === "read_only") continue;
    undeclared.push(id);
  }
  expect(undeclared, "the pack check refuses an undeclared step").toEqual([]);
  expect(malformed, "publishes is a JSON boolean or absent").toEqual([]);
  // The flow's whole publishes key set is two steps, both declared on purpose.
  expect(
    Object.entries(components)
      .filter(([, c]) => has(cinatraOf(c), "publishes"))
      .map(([id]) => id)
      .sort(),
  ).toEqual(["publish", "write_address"]);
  const reserved = everyObject(oas)
    .flatMap(([path, o]) => [
      ...[o.id, o.$component_ref].filter((v) => typeof v === "string").map((v) => [path, v]),
      ...(o.$referenced_components ? Object.keys(o.$referenced_components) : []).map((k) => [
        path,
        k,
      ]),
    ])
    .filter(([, v]) => v.startsWith(GATE_PREFIX));
  expect(reserved, "the gate prefix belongs to the host").toEqual([]);
});

test("the card's rows are declared in the compiler's form, from the step's own inputs", () => {
  const publish = node("publish");
  const rows = publish.metadata.cinatra.publishRows;
  expect(Array.isArray(rows), "publishRows is a list").toBe(true);
  expect(rows.length).toBeGreaterThanOrEqual(1);
  expect(rows.length).toBeLessThanOrEqual(2);
  const inputs = new Set(titles(publish.inputs));
  const seen = new Set();
  for (const row of rows) {
    expect(Object.keys(row).sort(), "exactly the keys label and input").toEqual([
      "input",
      "label",
    ]);
    expect(typeof row.label).toBe("string");
    expect(row.label.length).toBeGreaterThanOrEqual(1);
    expect(row.label.length).toBeLessThanOrEqual(60);
    expect(row.label, "no leading or trailing space").toBe(row.label.trim());
    expect(/[\p{Cc}\u2028\u2029]/u.test(row.label), "one line").toBe(false);
    expect(inputs.has(row.input), `${row.input} is an input of the publish step`).toBe(true);
    expect(seen.has(row.input), "no input shown twice").toBe(false);
    seen.add(row.input);
  }
  // The two rows the drawing draws: the post, and where it goes.
  expect(rows).toEqual([
    { label: "Post", input: "postText" },
    { label: "Destination", input: "destinationName" },
  ]);
  // The key is valid only beside publishes: true; nothing else carries it.
  const carriers = everyObject(oas)
    .filter(([, o]) => o.cinatra && typeof o.cinatra === "object" && has(o.cinatra, "publishRows"))
    .map(([path]) => path);
  expect(carriers).toEqual(["$.$referenced_components.publish.metadata"]);
});

test("the pack keeps no confirm step of its own in front of the publish", () => {
  expect(
    has(cinatraOf(oas), "hitlScreens"),
    "no root hitlScreens beside the publishing step",
  ).toBe(false);
  const into = (oas.control_flow_connections ?? [])
    .filter((e) => e.to_node?.$component_ref === "publish")
    .map((e) => components[e.from_node.$component_ref]?.component_type);
  expect(into, "nothing waits for a person on the way into the publish").not.toContain(
    "InputMessageNode",
  );
  expect(node("publish").metadata.cinatra.requiresApproval).toBe(false);
  const system = node("publish").data.system;
  expect(system, "the recipe pauses at no screen of its own").not.toMatch(/INTERRUPT/);
  expect(system).not.toMatch(/x-renderer/);
  expect(system).not.toMatch(/HITL Gate/);
});

test("the pack declares no field renderer and ships no screen", () => {
  expect(has(manifest.cinatra, "fieldRenderers"), "no field renderer is declared").toBe(false);
  const renderers = fileURLToPath(new URL("../src/renderers", import.meta.url));
  expect(existsSync(renderers), "the package ships no screen source").toBe(false);
  expect(JSON.stringify(oas), "no step of the flow names a renderer").not.toMatch(/x-renderer/);
});

// The branches of the step's prompt that run after the card. The person
// approved before the step started, so each returns approved: true. Each branch
// is read in its own section of the prompt (split on the "### " headings).
const section = (pattern) => {
  const found = node("publish")
    .data.system.split(/\n(?=### )/)
    .filter((s) => pattern.test(s));
  return found.length === 1 ? found[0] : null;
};
const approvedValues = (text) =>
  [...text.matchAll(/approved"?: (true|false)/g)].map((m) => m[1]);

test("the cut-short-read branch returns approved: true after the card approved", () => {
  const text = section(/When `truncated` is true/);
  expect(text, "the prompt has one section for the cut-short read").not.toBeNull();
  expect(
    approvedValues(text),
    "the cut-short-read branch returns approved: true after the card approved",
  ).toEqual(["true"]);
});

test("the failed-site-call branch returns approved: true after the card approved", () => {
  const text = section(/If the call throws/);
  expect(text, "the prompt has one section for the failed call").not.toBeNull();
  expect(
    approvedValues(text),
    "the failed-site-call branch returns approved: true after the card approved",
  ).toEqual(["true"]);
});

test("the published branch returns approved: true after the card approved", () => {
  const text = section(/^### Step \d+ \u2014 return/m);
  expect(text, "the prompt has one return section").not.toBeNull();
  expect(
    approvedValues(text),
    "both envelopes of the return step carry approved: true after the card approved",
  ).toEqual(["true", "true"]);
});

test("every failure branch returns the failure envelope of the return step", () => {
  for (const pattern of [/When `truncated` is true/, /If the call throws/]) {
    const text = section(pattern);
    expect(text).toMatch(/return the failure envelope of Step 3/);
    expect(text, "no failure branch asks for an empty object as the patch").not.toMatch(
      /addressPatch: \{\}/,
    );
  }
});

// ---------------------------------------------------------------------------
// Every envelope the step documents is a valid answer under its declared outputs.
// The runtime asks the model for a strict structured output: every declared
// output and every declared member of addressPatch must appear, and no other
// key may (docker/wayflow/agent_loader.py in cinatra, _strict_declared_subschema).
// The checks below read the envelopes from the JSON blocks of the return step
// and validate them against that contract, structurally.
// ---------------------------------------------------------------------------

const PRIMITIVE = { string: "string", boolean: "boolean", integer: "number", number: "number" };

/** Every reason `value` is not a valid answer for the declared subschema at `path`. */
const strictViolations = (schema, value, path) => {
  const type = schema.json_schema?.type ?? schema.type;
  if (type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return [`${path} is not an object`];
    }
    const members = schema.json_schema?.properties ?? schema.properties ?? {};
    const problems = [];
    for (const name of Object.keys(members)) {
      if (!has(value, name)) problems.push(`${path}.${name} is missing`);
      else problems.push(...strictViolations(members[name], value[name], `${path}.${name}`));
    }
    for (const name of Object.keys(value)) {
      if (!has(members, name)) problems.push(`${path}.${name} is not declared`);
    }
    return problems;
  }
  return typeof value === PRIMITIVE[type] ? [] : [`${path} is not a ${type}`];
};

/** The answer as the declared outputs of the step read it. */
const answerViolations = (answer) =>
  strictViolations(
    { type: "object", properties: Object.fromEntries(node("publish").outputs.map((o) => [o.title, o])) },
    answer,
    "answer",
  );

/** The JSON blocks of the return step, parsed. */
const returnEnvelopes = () =>
  [...section(/^### Step \d+ \u2014 return/m).matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) =>
    JSON.parse(m[1]),
  );

/** The members of the declared address patch. */
const patchMembers = () =>
  Object.keys(node("publish").outputs.find((o) => o.title === "addressPatch").json_schema.properties);

test("the return step documents one published envelope and one failure envelope", () => {
  expect(returnEnvelopes().map((e) => e.addressWritten)).toEqual([true, false]);
});

test("every documented envelope is a valid answer under the declared outputs", () => {
  for (const envelope of returnEnvelopes()) {
    expect(answerViolations(envelope)).toEqual([]);
  }
});

test("the failure envelope publishes nothing and gives the write step nothing to write", () => {
  const failure = returnEnvelopes().find((e) => e.addressWritten === false);
  expect(failure.approved).toBe(true);
  expect(failure.linkedinPostUrl).toBe("");
  expect(failure.linkedinPostExternalId).toBe("");
  expect(Object.keys(failure.addressPatch)).toEqual(patchMembers());
  expect(Object.values(failure.addressPatch).every((v) => v === "")).toBe(true);
});

test("the published envelope fills every member of the patch", () => {
  const published = returnEnvelopes().find((e) => e.addressWritten === true);
  expect(Object.keys(published.addressPatch)).toEqual(patchMembers());
  expect(Object.values(published.addressPatch).every((v) => v !== "")).toBe(true);
});

test("the strict check refuses the empty object as an address patch", () => {
  const failure = returnEnvelopes().find((e) => e.addressWritten === false);
  expect(answerViolations({ ...failure, addressPatch: {} })).toEqual(
    patchMembers().map((name) => `answer.addressPatch.${name} is missing`),
  );
});

test("the write step writes the patch only when every declared member is non-empty", () => {
  const leaf = node("write_address").data.input.data;
  const gate = leaf.match(/\{% if ([^%]*) %\}\{\{ addressPatch \| tojson \}\}\{% else %\}\{\}\{% endif %\}/);
  expect(gate, "the leaf renders the patch under one condition, else {}").not.toBeNull();
  expect(gate[1], "the condition asks each declared member to be present and non-empty").toBe(
    patchMembers()
      .map((name) => `('${name}' in addressPatch and addressPatch['${name}'])`)
      .join(" and "),
  );
});
