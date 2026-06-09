# Technology Stack

**Analysis Date:** 2026-06-09

## Languages

**Primary:**
- JSON — agent flow definition (`cinatra/oas.json`), package manifest (`package.json`)
- Markdown — skill prompt/recipe (`skills/blog-linkedin-publish-agent/SKILL.md`)

**Secondary:**
- TypeScript (ES2023 / ESNext modules) — configured for future `src/` code via `tsconfig.json`; no compiled source files exist in the repo today
- JavaScript (ESM) — CI gate script (`extension-kind-gate.mjs`)

## Runtime

**Environment:**
- Node.js (ESM, `"type": "module"` in `package.json`)
- No minimum version pinned; CI gate uses only Node built-ins

**Package Manager:**
- npm (`.npmrc` present; `auto-install-peers=false`)
- Lockfile: Not present in repo (likely generated at install time)

## Frameworks

**Core:**
- Cinatra Agent Platform (`cinatra.ai/v1`) — the agent is a declarative Flow (`agentspec_version: 26.1.0`) defined in `cinatra/oas.json`; no application framework code is written

**Testing:**
- Not applicable — no test runner or test files detected

**Build/Dev:**
- TypeScript compiler (`tsc`) — configured in `tsconfig.json` targeting `dist/` from `src/`; no `src/` files exist yet
- `extension-kind-gate.mjs` — zero-dependency CI sanity gate (validates OAS shape, banned primitives, XML well-formedness for workflow kinds)

## Key Dependencies

**Critical:**
- `@cinatra-ai/blog-linkedin-publish-agent` (this package, v0.1.0) — self-referential package name; declares `cinatra.dependencies: []` meaning it has no peer Cinatra extension dependencies
- `@cinatra-ai/blog-post-artifact` — referenced extension package for artifact storage (LinkedIn copy and blog post body); consumed at runtime, not listed in `package.json` (injected by the Cinatra platform)

**Infrastructure:**
- Cinatra MCP primitives injected at runtime: `blog_project_get`, `blog_post_publish_linkedin_start`, `blog_post_publish_linkedin_update`, `blog_post_publish_linkedin_publish`, `blog_post_publish_linkedin_cancel`, `artifact_representation_get`, `artifact_authoring_emit`

## Configuration

**Environment:**
- `CINATRA_BASE_URL` — runtime-injected template variable used in the ApiNode URL (`{{CINATRA_BASE_URL}}/api/llm-bridge`); resolved by the Cinatra platform, not stored in repo

**Build:**
- `tsconfig.json` — TypeScript compiler config (strict mode, ES2023 target, ESNext modules, bundler resolution, outputs to `dist/`)
- `.npmrc` — disables automatic peer install (`auto-install-peers=false`)
- `.github/workflows/` — CI workflow directory (contents not inspected)

## Platform Requirements

**Development:**
- Node.js with ESM support
- Access to `@cinatra-ai` private npm registry (for any future TypeScript dependencies)

**Production:**
- Cinatra Agent Platform runtime (provides LLM bridge at `/api/llm-bridge`, MCP tool injection, HITL interrupt mechanism, artifact storage)
- OpenAI API — preferred LLM provider (`gpt-5.5`) declared in `cinatra/oas.json` metadata

---

*Stack analysis: 2026-06-09*
