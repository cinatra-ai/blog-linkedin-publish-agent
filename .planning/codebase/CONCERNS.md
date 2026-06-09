# Codebase Concerns

**Analysis Date:** 2026-06-09

## Tech Debt

**No `src/` directory — TypeScript config is orphaned:**
- Issue: `tsconfig.json` declares `"rootDir": "src"` and `"include": ["src/**/*.ts", "src/**/*.tsx"]`, but no `src/` directory exists in the repo. The entire agent logic lives in `skills/blog-linkedin-publish-agent/SKILL.md` (LLM prompt instructions) rather than TypeScript source code.
- Files: `tsconfig.json`
- Impact: Running `tsc` on this repo produces a TS18003 "No inputs were found" error. The CI workflow anticipates this and skips typecheck for content-only extensions, but the dead `tsconfig.json` is misleading for contributors.
- Fix approach: Either remove `tsconfig.json` from the repo entirely (since there is no TypeScript to compile), or add a comment in `tsconfig.json` clarifying it is a placeholder for potential future TypeScript additions.

**`package.json` declares no `cinatra.kind` field:**
- Issue: `package.json` has `"cinatra": { "apiVersion": "cinatra.ai/v1", "kind": "agent", "dependencies": [] }`. The `kind` field IS present, but the CI classification in `.github/workflows/ci.yml` checks for first-party `@cinatra-ai/*` peers to determine if it is a "source mirror" or "standalone" repo. This repo has neither first-party peers nor any `peerDependencies` at all, so it runs as a "standalone" repo — but it has nothing to install, typecheck, or test. The CI exits cleanly only because of the "No TypeScript sources tracked" guard.
- Files: `package.json`, `.github/workflows/ci.yml`
- Impact: Low risk today, but adding any dependency in future requires careful triage to avoid breaking the source-mirror classification logic.
- Fix approach: Document in `package.json` or a comment block that this is an intentionally content-only extension.

**Agent orchestration logic entirely in LLM prompt strings — no executable code:**
- Issue: All step-by-step orchestration (polling, draft discovery, artifact ref resolution, HITL gate, conditional edit flow) is encoded in `skills/blog-linkedin-publish-agent/SKILL.md` and mirrored into the `system` prompt string inside `cinatra/oas.json`. There is no deterministic code path; correctness depends entirely on the LLM following the recipe.
- Files: `skills/blog-linkedin-publish-agent/SKILL.md`, `cinatra/oas.json`
- Impact: Any subtle prompt regression (model update, context truncation, token budget pressure) can silently change agent behavior — e.g., skipping the `artifact_authoring_emit` step before `blog_post_publish_linkedin_update`, or misidentifying the polling terminal condition (`"succeeded"` vs `"completed"`).
- Fix approach: Add integration-level smoke tests (golden-path and rejection path) against a mock MCP server. At minimum, document a manual test checklist in the README.

**`cinatra/oas.json` `system` prompt duplicates SKILL.md — risk of drift:**
- Issue: The `system` field in the `publish` ApiNode inside `cinatra/oas.json` contains a condensed but overlapping version of the instructions in `skills/blog-linkedin-publish-agent/SKILL.md`. If SKILL.md is updated, the `oas.json` system prompt must be updated independently.
- Files: `cinatra/oas.json` (line 365), `skills/blog-linkedin-publish-agent/SKILL.md`
- Impact: Silent behavioral divergence between what the skill document says and what the live agent does at runtime.
- Fix approach: Establish a single source of truth — either generate `oas.json` from SKILL.md programmatically or add a linting step that flags when key instruction sections diverge.

## Known Bugs

**Polling ambiguity: `operation === undefined` treated as "draft ready":**
- Symptoms: SKILL.md Step 2 says break out if `status === "succeeded"` AND `(operation === "draft" OR operation === undefined)`. An `undefined` operation could indicate a stale or uninitialized state rather than a completed draft.
- Files: `skills/blog-linkedin-publish-agent/SKILL.md` (line 76)
- Trigger: If a project's `linkedinDraftGeneration` is in a legacy or uninitialized state where `operation` is absent, the agent could incorrectly proceed to Step 3 and fail to find a valid draft entry.
- Workaround: The Step 3 draft-not-found path returns an error envelope, providing a partial safety net.

**Draft matching: multiple-match tie-breaking relies on `updatedAt` sort — field not guaranteed:**
- Symptoms: Step 3 selects the draft with the latest `updatedAt` when multiple entries match. If `updatedAt` is absent or equal for two entries, behavior is undefined.
- Files: `skills/blog-linkedin-publish-agent/SKILL.md` (line 97)
- Trigger: Concurrent re-runs or rapid retries of the same publish operation.
- Workaround: None specified in the recipe.

## Security Considerations

**LLM prompt injection via user-supplied inputs:**
- Risk: All 8 agent inputs (`projectId`, `postId`, `linkedinAccountId`, `linkedinAccountName`, `destinationType`, `destinationId`, `destinationName`, `blogPostUrl`) are interpolated directly into the LLM `user` prompt template in `cinatra/oas.json` (line 366) without sanitization. A malicious `linkedinAccountName` or `destinationName` containing prompt-injection text could redirect the agent to call unauthorized tools or skip the HITL gate.
- Files: `cinatra/oas.json` (line 366)
- Current mitigation: The `system` prompt explicitly restricts the agent to 7 named MCP primitives and prohibits `web_search`, `objects_*`, etc. The HITL gate also provides a human checkpoint before publish.
- Recommendations: Add server-side input validation / length limits on string fields before they reach the LLM bridge. Consider stripping or escaping instruction-like patterns from free-text inputs (`linkedinAccountName`, `destinationName`).

**`.npmrc` present — note only:**
- `.npmrc` file exists at repo root. Contents not read. Verify it does not contain registry auth tokens that could be exposed in CI logs or forks.
- Files: `.npmrc`

**`CINATRA_BASE_URL` is a bare template variable with no validation:**
- Risk: The `publish` ApiNode in `cinatra/oas.json` makes an HTTP POST to `{{CINATRA_BASE_URL}}/api/llm-bridge`. If this variable is misconfigured or overridden in a deployment environment, agent traffic could be redirected to an arbitrary endpoint, leaking all inputs including `linkedinAccountId`.
- Files: `cinatra/oas.json` (line 362)
- Current mitigation: Variable substitution is controlled by the Cinatra runtime, not by end users.
- Recommendations: Document the expected format and origin of `CINATRA_BASE_URL` so operators can verify it at deploy time.

## Performance Bottlenecks

**Polling cadence is fixed at 5-second intervals — no backoff:**
- Problem: Both the draft-generation poll (Step 2) and publish-confirmation poll (Step 6) use a fixed 5-second cadence for up to 60 cycles (5-minute cap each). Fast completions still wait a full 5 seconds per cycle.
- Files: `skills/blog-linkedin-publish-agent/SKILL.md` (lines 68, 189)
- Cause: The recipe does not specify exponential or adaptive backoff.
- Improvement path: Allow the LLM or the Cinatra bridge to support webhook/event-driven completion signals instead of polling, or implement adaptive backoff (e.g., 2s → 4s → 8s) in the bridge layer.

**No streaming — full draft content loaded into HITL before display:**
- Problem: `artifact_representation_get` retrieves the full draft content bytes before the HITL renderer shows anything to the operator. For very long LinkedIn drafts this adds latency.
- Files: `skills/blog-linkedin-publish-agent/SKILL.md` (line 99)
- Cause: The artifact resolution protocol is a single synchronous fetch.
- Improvement path: Streaming artifact representation could reduce time-to-first-render in the HITL UI.

## Fragile Areas

**Extension-kind gate retired-primitive scan is hardcoded in `extension-kind-gate.mjs`:**
- Files: `extension-kind-gate.mjs` (lines 65–71)
- Why fragile: The list of `BANNED_PRIMITIVES` and `BANNED_TYPEHINTS` is hardcoded in this file. If the monorepo's authoritative list (`scripts/audit/oas-banned-primitives-gate.mjs`) is updated, this extracted-repo copy must be manually synced. The file header acknowledges this ("ported verbatim — stay in lock-step") but there is no automated sync mechanism.
- Safe modification: Treat `BANNED_PRIMITIVES` and `BANNED_TYPEHINTS` as append-only. Never remove an entry without confirming the monorepo list was also updated.
- Test coverage: The gate's logic (`validateAgent`, `validateBpmnSanity`, `findWorkflowSidecars`, etc.) has no test file in this repo. Tests live in the monorepo.

**Single ApiNode architecture — no retry or circuit-breaker:**
- Files: `cinatra/oas.json` (lines 358–439)
- Why fragile: The entire 6-step orchestration runs inside a single `ApiNode` call to `/api/llm-bridge`. If the bridge call times out or returns a 5xx mid-flow, the entire run fails with no partial-state recovery. The HITL gate approval cannot be replayed without restarting from Step 1.
- Safe modification: Do not split the flow into multiple ApiNodes without updating the SKILL.md recipe accordingly, as the LLM holds intermediate state (draft id, artifact refs) in its context window between steps.
- Test coverage: No automated tests in this repo.

## Scaling Limits

**5-minute hard cap on draft generation and publish polling:**
- Current capacity: 60 poll cycles × 5 seconds = 300 seconds per operation.
- Limit: If the backend LinkedIn draft generation or publish operation takes more than 5 minutes, the agent returns a timeout error envelope and the operator must restart from scratch.
- Scaling path: Expose the poll cap as a configurable input, or implement a resume mechanism that accepts an in-progress `linkedinDraftId` to skip Step 1.

## Dependencies at Risk

**No external npm dependencies — no package-level dependency risk.**
- The `package.json` declares no `dependencies`, `devDependencies`, or `peerDependencies`. All runtime behavior depends on the Cinatra platform (MCP primitives, LLM bridge, artifact storage).
- Risk: Deep coupling to the Cinatra-internal MCP API surface. Any rename or deprecation of `blog_post_publish_linkedin_*`, `artifact_authoring_emit`, or `artifact_representation_get` primitives requires updating both SKILL.md and `cinatra/oas.json`.

## Missing Critical Features

**No automated tests:**
- Problem: There are no test files anywhere in the repo (`*.test.*`, `*.spec.*`). The CI `test` step runs `pnpm test --if-present`, which silently passes when no test script is defined.
- Blocks: Regression detection for prompt changes, polling logic edge cases, and HITL approval/rejection paths.

**No input validation schema enforcement at the agent boundary:**
- Problem: `destinationType` is constrained to `"member" | "organization"` by a JSON schema enum in `cinatra/oas.json`, but the other required string inputs (`projectId`, `postId`, `linkedinAccountId`, `destinationId`, `destinationName`, `blogPostUrl`) have no format validation (e.g., URL format for `blogPostUrl`, non-empty checks).
- Blocks: Early error surfacing before the LLM starts executing steps.

**No idempotency / duplicate-run guard:**
- Problem: If the same `(projectId, postId, linkedinAccountId, destinationId, blogPostUrl)` tuple is submitted twice concurrently, both runs will call `blog_post_publish_linkedin_start`, potentially creating two drafts and causing confusion in Step 3's draft-matching logic.
- Blocks: Safe retry UX for operators.

## Test Coverage Gaps

**All orchestration logic untested:**
- What's not tested: Step 2 polling terminal conditions, Step 3 draft-matching with multiple candidates, Step 4 HITL payload shape, Step 5 cancel-on-reject, Step 6 conditional `artifact_authoring_emit` skip when content is unchanged.
- Files: `skills/blog-linkedin-publish-agent/SKILL.md`, `cinatra/oas.json`
- Risk: Silent regressions when SKILL.md is updated or the LLM model is swapped (`gpt-5.5` is pinned in `cinatra/oas.json` line 369 but not version-locked).
- Priority: High

**`extension-kind-gate.mjs` logic untested in this repo:**
- What's not tested: `validateAgent`, `validateBpmnSanity`, `validateWorkflowPackageShape`, `findWorkflowSidecars`, `parseArgs` functions.
- Files: `extension-kind-gate.mjs`
- Risk: A bug introduced during manual sync from the monorepo gate would not be caught before CI runs on a real push.
- Priority: Medium

---

*Concerns audit: 2026-06-09*
