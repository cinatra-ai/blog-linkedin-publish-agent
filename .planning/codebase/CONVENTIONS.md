# Coding Conventions

**Analysis Date:** 2026-06-09

## Repository Type

This is a content-only Cinatra agent extension. It ships no TypeScript `src/` — the agent behavior is declared entirely in:
- `skills/blog-linkedin-publish-agent/SKILL.md` — LLM-facing prompt / recipe
- `cinatra/oas.json` — machine-readable agent OAS surface
- `extension-kind-gate.mjs` — self-contained CI gate script (Node ESM, no deps)
- `package.json` — extension manifest

There is no application code to lint or format beyond `extension-kind-gate.mjs`.

## Naming Patterns

**Files:**
- `kebab-case` throughout: `extension-kind-gate.mjs`, `blog-linkedin-publish-agent/SKILL.md`
- Script files use `.mjs` extension (ESM, executable via plain `node`)
- Cinatra artifact directory is always `cinatra/` (lowercase)

**Functions (in `extension-kind-gate.mjs`):**
- `camelCase` for all exported and internal functions: `parseArgs`, `validateAgent`, `validateWorkflow`, `validateBpmnSanity`, `findWorkflowSidecars`, `runGate`, `walkLlmStrings`, `scanOasString`
- Boolean-returning helpers use `validate*` prefix
- Walking helpers use `walk*` or `find*` prefix

**Variables:**
- `camelCase` for local variables and parameters
- `UPPER_SNAKE_CASE` for module-level constants: `LLM_VISIBLE_FIELDS`, `BANNED_PRIMITIVES`, `BANNED_TYPEHINTS`, `PRIMITIVE_PATTERNS`, `OBJECTS_LIST_CRM_RE`, `BPMN_MODEL_NS`, `WORKFLOW_PACKAGE_NAME_RE`

**Types:**
- No TypeScript types in `extension-kind-gate.mjs` (pure JS)
- `tsconfig.json` is present for future `src/` TypeScript — targets ES2023, ESNext modules, `strict: true`, `noImplicitAny: false`

## Code Style

**Formatting:**
- No formatter config file detected (no `.prettierrc`, no `biome.json`, no `eslint.config.*`)
- `extension-kind-gate.mjs` uses 2-space indentation consistently
- Semicolons present throughout
- Double quotes for strings

**Linting:**
- No ESLint or Biome config detected
- The CI gate (`extension-kind-gate.mjs`) itself acts as the quality gate — it validates OAS content, not JS style

## Import Organization

**Style:** Node built-ins only in `extension-kind-gate.mjs`

**Order:**
1. Named imports from `node:fs`
2. Named imports from `node:path`

**Example (from `extension-kind-gate.mjs` lines 36–37):**
```js
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join, basename, dirname, relative } from "node:path";
```

**Path Aliases:** None — all imports are bare `node:` specifiers.

## Error Handling

**Pattern:** Pure functions return `string[]` error arrays; callers push errors and return early on fatal conditions.

```js
// From extension-kind-gate.mjs
export function validateAgent(packageRoot) {
  const errors = [];
  if (!existsSync(oasPath)) return errors;  // early return on missing optional file
  try {
    parsed = JSON.parse(readFileSync(oasPath, "utf8"));
  } catch (err) {
    errors.push(`cinatra/oas.json failed to parse: ${err instanceof Error ? err.message : String(err)}`);
    return errors;
  }
  ...
  return errors;
}
```

- `try/catch` used only around I/O and JSON.parse
- Error messages use template literals with human-readable context
- `err instanceof Error ? err.message : String(err)` pattern for safe error coercion
- `main()` wrapped in `try/catch` with `process.exit(1)` on unexpected errors

**SKILL.md agent error envelope** — when the agent takes an error path it always returns a typed JSON envelope:
```json
{
  "projectId": "...",
  "postId": "...",
  "linkedinDraftId": "<draftId or empty>",
  "linkedinPostUrl": "",
  "approved": false,
  "summary": "<one-line operator-readable explanation>"
}
```

## Logging

**Framework:** `console.log` / `console.error` (Node built-ins)

**Patterns:**
- Success: `console.log("✓ extension-kind-gate: ...")`
- Failures: `console.error("✗ extension-kind-gate: ...")` with bullet-point list
- Unexpected errors: `console.error("extension-kind-gate: unexpected error", err)`
- No structured logging library

## Comments

**When to Comment:**
- Block comments at top of functions describing scope and intentional limitations
- Inline comments explain WHY a branch exists, not what it does
- Long comment blocks document external contracts (e.g., marketplace-side validation not re-run here)

**Style:**
```js
// The OAS is optional at this gate: an agent without a generated OAS has no
// LLM-visible prompt strings to scan, so there is nothing to fail on. The
// marketplace-side validation owns the "agent MUST ship an OAS" contract.
```

- Single-line `//` comments throughout; no JSDoc
- Section separators use `// ---...---` banners with section titles

## Module Design

**Exports:** Named exports only from `extension-kind-gate.mjs`

```js
export function parseArgs(argv) { ... }
export function validateAgent(packageRoot) { ... }
export function validateWorkflowPackageShape(pkg) { ... }
export function validateBpmnSanity(xml) { ... }
export function findWorkflowSidecars(packageRoot) { ... }
export function validateWorkflow(packageRoot) { ... }
export function runGate(packageRoot) { ... }
```

**`main()` guard pattern:**
```js
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (invokedDirectly) {
  try { main(); } catch (err) { ... }
}
```
This allows `extension-kind-gate.mjs` to be both directly executed AND imported in tests.

**Barrel Files:** Not applicable — single-file script repo.

## Agent Prompt Conventions (SKILL.md)

**Tool discipline:** The SKILL.md declares exactly which MCP primitives the agent may call (7 tools listed). No other tools permitted.

**Output contract:** The agent returns a single JSON object — no prose, no extra fields.

**Polling pattern:** Every polling loop specifies cadence (5 s), max cycles (60), and explicit terminal status handling for `succeeded`, `failed`, `stopped`.

**HITL gate naming:** Gates use `:kebab-case` identifiers (`:draft-review`), with a `x-renderer` field using the full scoped package path `@cinatra-ai/blog-linkedin-publish-agent:draft-review`.

---

*Convention analysis: 2026-06-09*
