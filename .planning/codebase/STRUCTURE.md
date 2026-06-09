# Codebase Structure

**Analysis Date:** 2026-06-09

## Directory Layout

```
blog-linkedin-publish-agent/
├── cinatra/
│   └── oas.json              # Cinatra Flow definition (StartNode, ApiNode, EndNode, schemas)
├── skills/
│   └── blog-linkedin-publish-agent/
│       └── SKILL.md          # LLM prompt recipe — step-by-step agent instructions
├── .github/
│   └── workflows/
│       ├── ci.yml            # Standalone CI: build, typecheck, test, pack dry-run, kind-gate
│       └── release.yml       # Release workflow
├── .planning/
│   └── codebase/             # GSD planning documents (this directory)
├── extension-kind-gate.mjs   # Zero-dependency CI validator for agent/workflow extensions
├── package.json              # Package manifest (cinatra.kind: "agent", no runtime deps)
├── tsconfig.json             # TypeScript config (repo ships no .ts sources — used by CI)
├── .npmrc                    # npm/pnpm registry config
└── LICENSE                   # Apache-2.0
```

## Directory Purposes

**`cinatra/`:**
- Purpose: Cinatra platform artefacts consumed at agent invocation and marketplace publish
- Contains: `oas.json` — the full declarative flow graph with node schemas, data-flow edges, metadata, and LLM prompt strings
- Key files: `cinatra/oas.json`

**`skills/blog-linkedin-publish-agent/`:**
- Purpose: The agent's canonical LLM instruction set in Markdown
- Contains: `SKILL.md` — tool discipline, hard contract facts, 6-step recipe, error envelope format
- Key files: `skills/blog-linkedin-publish-agent/SKILL.md`

**`.github/workflows/`:**
- Purpose: Standalone CI pipeline for this extracted extension repo
- Contains: `ci.yml` (build + kind-gate), `release.yml`
- Key files: `.github/workflows/ci.yml`, `.github/workflows/release.yml`

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents produced by `/gsd-map-codebase`
- Generated: Yes (by GSD tooling)
- Committed: Yes

## Key File Locations

**Entry Points:**
- `cinatra/oas.json`: Full Flow definition — the runtime contract between the Cinatra platform and this agent
- `extension-kind-gate.mjs`: CLI entry point for CI validation (`node extension-kind-gate.mjs --package-root .`)

**Configuration:**
- `package.json`: Package name (`@cinatra-ai/blog-linkedin-publish-agent`), version, license, `cinatra.kind: "agent"`, zero `dependencies`
- `tsconfig.json`: TypeScript compiler config (no tracked `.ts` sources in this repo; present for CI compatibility)
- `.npmrc`: Registry authentication config (existence noted; contents not read)

**Core Logic:**
- `skills/blog-linkedin-publish-agent/SKILL.md`: All agent behaviour — the LLM reads this as its system prompt
- `cinatra/oas.json`: ApiNode `data.system` field mirrors SKILL.md instructions; `data.user` template fills in the 8 inputs at runtime

**CI/Validation:**
- `extension-kind-gate.mjs`: Exports `validateAgent`, `validateWorkflow`, `validateBpmnSanity`, `runGate`, `parseArgs`
- `.github/workflows/ci.yml`: Runs the gate via `node extension-kind-gate.mjs --package-root .` in the `kind-gates` job

## Naming Conventions

**Files:**
- Cinatra artefacts: lowercase with standard names (`oas.json`, `workflow.bpmn` for workflow kind)
- Skill docs: `SKILL.md` (UPPERCASE.md)
- Gate scripts: `kebab-case.mjs`
- CI workflows: `kebab-case.yml`

**Directories:**
- Platform artefacts: `cinatra/` (fixed Cinatra convention)
- Skill definitions: `skills/<package-slug>/` matching the npm package name without scope
- Planning docs: `.planning/codebase/`

**Package names:**
- Agent packages: `@cinatra-ai/<slug>-agent` (no `-agent` suffix on directory — directory is the slug)
- Workflow packages: `@cinatra-ai/<slug>-workflow` (enforced by `WORKFLOW_PACKAGE_NAME_RE` in `extension-kind-gate.mjs`)

## Where to Add New Code

**New agent instructions / behaviour change:**
- Edit: `skills/blog-linkedin-publish-agent/SKILL.md`
- Also update: `cinatra/oas.json` → `$referenced_components.publish.data.system` to keep them in sync

**New input or output field:**
- Add to: `cinatra/oas.json` → flow-level `inputs`/`outputs` array, StartNode inputs, ApiNode inputs/outputs, EndNode outputs, and all relevant DataFlowEdge entries
- Update: `skills/blog-linkedin-publish-agent/SKILL.md` Inputs section

**New HITL screen:**
- Declare in: `cinatra/oas.json` → `metadata.cinatra.hitlScreens[]`
- Document in: `skills/blog-linkedin-publish-agent/SKILL.md`

**New CI check:**
- Add to: `extension-kind-gate.mjs` (pure functions; add exports for testability)
- Wire in: `.github/workflows/ci.yml` `kind-gates` job

**Utilities / helpers:**
- This repo has no `src/` directory and ships no TypeScript sources. Any new utility code should be added as an `.mjs` module at the repo root (matching the style of `extension-kind-gate.mjs`).

## Special Directories

**`cinatra/`:**
- Purpose: Runtime artefacts consumed by Cinatra platform (OAS for agents, BPMN for workflows)
- Generated: No (hand-authored / extraction-script generated)
- Committed: Yes — this is the published artefact

**`.planning/`:**
- Purpose: GSD planning and codebase map documents
- Generated: Yes (by GSD commands)
- Committed: Yes

---

*Structure analysis: 2026-06-09*
