// An ApiNode's declared inputs and the placeholders its template body renders
// must be the SAME set, in both directions. A declared input the body never
// references is a value the step is promised and never sees; a placeholder no
// input declares is a value the step renders and never receives. Either way the
// flow is rejected when it is mounted.
//
// This is the pack-side mirror of the host's ApiNode placeholder/inputs parity
// rule, and it is deliberately written to the host's EXACT semantics rather than
// to a friendlier approximation — a guard that is more permissive than the rule
// it guards is green while the real gate is red, which is worse than no guard.
// Four things are load-bearing and must not be "improved":
//
//   * the placeholder pattern matches a BARE reference only. A filtered form
//     such as {{ x | tojson }} does NOT count as a reference; a template that
//     needs the filter exposes the name through a {# pyagentspec-input-hint #}
//     comment instead, which this pattern does see.
//   * ALL SIX placeholder-carrying fields are scanned, not just the body.
//   * an ALL-CAPS placeholder is an environment substitution performed before
//     the flow is read, so it is never a flow input.
//   * a node with no inputs[] at all is SKIPPED. Absent inputs[] means every
//     placeholder is inferred as an input, so parity cannot be violated; only
//     an explicit inputs[] (an empty one included) is an assertion to check.

import { test } from "node:test";
import assert from "node:assert/strict";

import { components } from "./oas-contract.test.mjs";

const PLACEHOLDER_SOURCES = [
  "url",
  "http_method",
  "api_spec_uri",
  "data",
  "query_params",
  "headers",
];
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;
const ENV_VAR = /^[A-Z_][A-Z0-9_]*$/;

/** Every field a placeholder may hide in, as one text. */
const placeholderSource = (node) =>
  PLACEHOLDER_SOURCES.filter((k) => node[k] !== undefined)
    .map((k) => JSON.stringify(node[k]))
    .join("\n");

/** The names the flow renders, environment substitutions excluded. */
function rendered(text) {
  const names = new Set();
  PLACEHOLDER.lastIndex = 0;
  for (let m; (m = PLACEHOLDER.exec(text)) !== null; ) {
    if (m[1] && !ENV_VAR.test(m[1])) names.add(m[1]);
  }
  return names;
}

/** The names the node declares. Null when inputs[] is absent entirely. */
function declared(node) {
  if (!Array.isArray(node.inputs)) return null;
  return new Set(
    node.inputs
      .filter((e) => e && typeof e === "object" && typeof e.title === "string")
      .map((e) => e.title),
  );
}

const apiNodes = () =>
  Object.entries(components).filter(([, c]) => c?.component_type === "ApiNode");

const missingFrom = (a, b) => [...a].filter((x) => !b.has(x));

test("the flow declares ApiNodes with explicit inputs to check", () => {
  const nodes = apiNodes();
  assert.ok(nodes.length > 0, "the flow declares no ApiNode at all");
  const checked = nodes.filter(([, c]) => declared(c) !== null);
  assert.ok(
    checked.length > 0,
    "no ApiNode declares inputs[], so the parity scan below checks nothing",
  );
});

test("no ApiNode declares an input its template never renders", () => {
  const dead = [];
  for (const [id, c] of apiNodes()) {
    const names = declared(c);
    if (names === null) continue;
    for (const name of missingFrom(names, rendered(placeholderSource(c)))) {
      dead.push(`${id}.${name}`);
    }
  }
  assert.deepEqual(dead, [], `inputs no template renders: ${dead.join(", ")}`);
});

test("no ApiNode renders a placeholder its inputs never declare", () => {
  const undeclared = [];
  for (const [id, c] of apiNodes()) {
    const names = declared(c);
    if (names === null) continue;
    for (const name of missingFrom(rendered(placeholderSource(c)), names)) {
      undeclared.push(`${id}.${name}`);
    }
  }
  assert.deepEqual(
    undeclared,
    [],
    `placeholders no input declares: ${undeclared.join(", ")}`,
  );
});
