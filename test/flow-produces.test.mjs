// The flow document and the manifest must say the same thing about what this
// agent produces — and for this agent that is NOTHING. It publishes the post
// revision a person continued with and merges the published address onto that
// same artifact; it authors no words and persists no new revision, so the
// declaration is empty in both files. (The writer agent is the producer of the
// LinkedIn post-draft, and it declares it against a real end-node binding.)
//
// The declaration is not merely empty, though: the second block below reads
// this pack's own two files against the three materialization roads, in both
// directions, so an empty declaration stays a statement about the flow rather
// than a way to say less than the flow does.

import { expect, test } from "vitest";

import { manifest, oas, oasText } from "./__tests__/contract-readers.mjs";

const EXPECTED = [];

test("the manifest declares no produced type", () => {
  expect(manifest.cinatra.produces).toEqual(EXPECTED);
});

test("the flow's produces mirrors the manifest's, typed", () => {
  expect(oas.metadata.cinatra.produces).toEqual(manifest.cinatra.produces);
  for (const entry of oas.metadata.cinatra.produces) {
    expect(typeof entry.objectTypeId).toBe("string");
    expect(entry.objectTypeId.length).toBeGreaterThan(0);
  }
});

test("a produced type would come from a declared artifact dependency", () => {
  const deps = (manifest.cinatra.dependencies ?? []).map((d) => d.packageName);
  for (const entry of manifest.cinatra.produces) {
    expect(
      deps,
      `${entry.extension} is produced but not declared as a dependency`,
    ).toContain(entry.extension);
  }
});

// ---------------------------------------------------------------------------
// The materialization contract, mirrored (cinatra#924).
//
// The registry refuses a package whose `cinatra.produces` names an extension
// that no materialization road reaches. It accepts exactly three roads, and
// what follows is that covered-set logic read back onto this pack's own two
// files:
//
//   * an EndNode `outputs[].cinatra.artifact` binding — the end node hands the
//     pipeline a value to persist as an artifact;
//   * an `artifact_materialize` passthrough node — the flow persists one
//     mid-run (top-level components AND FlowNode subflows: the tool fires
//     anywhere);
//   * a REQUIRED `artifact_authoring_emit` claim in `cinatra.consumes`, which
//     resolves a SINGLE-entry declaration only: the claim names a capability,
//     not a target, so on a multi-entry declaration it would absolve entries
//     the emit may never reach.
//
// Both directions are asserted. A declared type no road reaches is the rule's
// own finding. A road whose extension is undeclared is the collectors' parity
// error — and it is what keeps an empty declaration honest rather than merely
// quiet: were this flow to grow a road, the empty declaration would redden
// here.

const AUTHORING_EMIT = "artifact_authoring_emit";
const MATERIALIZE_TOOL = "artifact_materialize";

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/** Road 1 — EndNode output bindings, top-level components only. */
function bindingExtensions() {
  const found = new Set();
  for (const c of Object.values(oas.$referenced_components ?? {})) {
    if (!isObject(c) || c.component_type !== "EndNode") continue;
    for (const out of Array.isArray(c.outputs) ? c.outputs : []) {
      const binding = isObject(out) && isObject(out.cinatra) ? out.cinatra.artifact : undefined;
      if (isObject(binding) && typeof binding.extension === "string") {
        found.add(binding.extension);
      }
    }
  }
  return found;
}

/** Road 2 — artifact_materialize passthrough nodes, subflows included. */
function materializeExtensions() {
  const found = new Set();
  const visit = (value) => {
    if (!isObject(value)) return;
    if (value.component_type === "ApiNode" && String(value.url ?? "").includes("/api/agents/passthrough")) {
      let data = value.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          data = null;
        }
      }
      if (isObject(data) && data.tool === MATERIALIZE_TOOL && isObject(data.input)) {
        if (typeof data.input.extension === "string") found.add(data.input.extension);
      }
    }
    if (isObject(value.$referenced_components)) {
      for (const child of Object.values(value.$referenced_components)) visit(child);
    }
    if (isObject(value.subflow)) visit(value.subflow);
  };
  visit(oas);
  return found;
}

/** Road 3 — the REQUIRED authoring-emit claim, single-entry declarations only. */
const authoringEmitResolves = () =>
  (manifest.cinatra.consumes ?? []).some(
    (c) => c && c.primitive === AUTHORING_EMIT && c.requirement === "required",
  ) && (manifest.cinatra.produces ?? []).length === 1;

const roadExtensions = () => new Set([...bindingExtensions(), ...materializeExtensions()]);

test("every declared type has a materialization road the flow executes", () => {
  const covered = roadExtensions();
  const emitResolves = authoringEmitResolves();
  const uncovered = (manifest.cinatra.produces ?? [])
    .map((e) => e.extension)
    .filter((ext) => !covered.has(ext) && !emitResolves);
  expect(
    uncovered,
    `declared with no road: ${uncovered.join(", ")} — an EndNode output binding, ` +
      `an ${MATERIALIZE_TOOL} node or a required ${AUTHORING_EMIT} claim, or declare nothing`,
  ).toEqual([]);
});

test("every materialization road the flow executes is declared", () => {
  const declared = new Set((manifest.cinatra.produces ?? []).map((e) => e.extension));
  const undeclared = [...roadExtensions()].filter((ext) => !declared.has(ext));
  expect(
    undeclared,
    `a road persists ${undeclared.join(", ")} without declaring it`,
  ).toEqual([]);
});

test("this agent claims no authoring capability at all", () => {
  expect(
    (manifest.cinatra.consumes ?? []).some((c) => c && c.primitive === AUTHORING_EMIT),
    "the writer authors the post; this agent publishes the revision it is handed",
  ).toBe(false);
  expect(oasText()).not.toContain(AUTHORING_EMIT);
});
