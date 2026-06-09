# Testing Patterns

**Analysis Date:** 2026-06-09

## Repository Context

This is a content-only Cinatra agent extension with no `src/` directory. The only executable code is `extension-kind-gate.mjs`. There are no test files in the repository; the `package.json` declares no test script and no test framework dependency.

The CI pipeline (`ci.yml`) runs `corepack pnpm test --if-present` — the `--if-present` flag means the test step is silently skipped when no `test` script is defined.

## Test Framework

**Runner:** Not detected — no test framework installed or configured.

**Config:** No `jest.config.*`, `vitest.config.*`, or equivalent detected.

**Run Commands:**
```bash
# No test command defined — CI skips with --if-present
corepack pnpm test --if-present
```

## What IS Tested (CI Gates)

Although there are no unit tests, the repo is validated by two CI jobs in `.github/workflows/ci.yml`:

**Job: `build`**
1. Dependency shape validation — inline Node script asserts no `@cinatra-ai/*` packages appear in `dependencies`/`devDependencies`/`optionalDependencies`.
2. Install (skipped for source mirrors with first-party peers).
3. Typecheck (skipped — no TypeScript sources tracked).
4. `npm pack --dry-run` — validates publish payload shape.

**Job: `kind-gates`** (runs after `build`)
- `node extension-kind-gate.mjs --package-root .`
- For `kind: "agent"`: parses `cinatra/oas.json` and scans all LLM-visible fields (`system`, `user`, `description`) for retired CRM primitives listed in `BANNED_PRIMITIVES` and `BANNED_TYPEHINTS`.
- Exit 0 = pass, exit 1 = violations found.

## Testable Logic in `extension-kind-gate.mjs`

The gate script is designed to be testable — all validation logic is exported as pure functions:

| Export | Purpose | Input → Output |
|--------|---------|----------------|
| `parseArgs(argv)` | Parse CLI args | `string[]` → `{ packageRoot: string }` |
| `validateAgent(packageRoot)` | Scan OAS for banned primitives | `string` → `string[]` errors |
| `validateWorkflowPackageShape(pkg)` | Validate package.json shape | `object` → `string[]` errors |
| `validateBpmnSanity(xml)` | BPMN well-formedness check | `string` → `string[]` errors |
| `findWorkflowSidecars(packageRoot)` | Locate BPMN sidecar files | `string` → `string[]` paths |
| `validateWorkflow(packageRoot)` | Combined workflow validation | `string` → `string[]` errors |
| `runGate(packageRoot)` | Dispatch by kind | `string` → `{ kind, errors }` |

All validation functions are pure (string[] in → string[] out), making them unit-testable without file system mocking (except `validateAgent`, `validateWorkflow`, `findWorkflowSidecars`, `runGate` which use `readFileSync`/`existsSync`).

## Test File Organization

**Location:** No test files exist.

**Pattern if added:** Given the ESM module format (`"type": "module"` in `package.json`) and Node 24 target (CI), tests should use a Node-compatible ESM test runner.

**Recommended placement:**
```
extension-kind-gate.test.mjs   # co-located with the gate script
```

## Mocking

**Framework:** Not applicable — no tests exist.

**If added:** The gate's I/O functions (`readFileSync`, `existsSync`) are imported directly from `node:fs`. To test error paths, either:
1. Use temp directories with real fixture files (integration style — preferred since the functions are pure against the filesystem)
2. Use `--experimental-vm-modules` with ESM mock support if a Jest-compatible runner is adopted

## Fixtures and Factories

**Test Data:** Not applicable.

**Natural fixtures for future tests:**
- `cinatra/oas.json` — a real agent OAS (valid case baseline)
- Inline BPMN XML strings (invalid/valid cases for `validateBpmnSanity`)

## Coverage

**Requirements:** None enforced.

**View Coverage:** Not configured.

## Test Types

**Unit Tests:** Not present. Pure functions in `extension-kind-gate.mjs` are amenable to unit testing.

**Integration Tests:** Not present. CI's `node extension-kind-gate.mjs --package-root .` acts as a functional integration test against the live repo content.

**E2E Tests:** Not applicable.

## Adding Tests

If tests are added:

1. Add a test runner to `package.json` devDependencies (e.g., `node:test` built-in requires no install on Node 24).
2. Add a `"test"` script to `package.json`:
   ```json
   "scripts": {
     "test": "node --test extension-kind-gate.test.mjs"
   }
   ```
3. Import the named exports from `extension-kind-gate.mjs` directly — the `invokedDirectly` guard ensures `main()` does not run on import.
4. Use `node:assert` or `node:test` built-ins to keep the zero-dependency constraint.

**Example pattern (Node built-in test runner):**
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBpmnSanity } from "./extension-kind-gate.mjs";

test("valid BPMN passes sanity check", () => {
  const xml = `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
    <bpmn:process id="p1" /></bpmn:definitions>`;
  assert.deepEqual(validateBpmnSanity(xml), []);
});
```

---

*Testing analysis: 2026-06-09*
