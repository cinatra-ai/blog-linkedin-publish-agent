# External Integrations

**Analysis Date:** 2026-06-09

## APIs & External Services

**Cinatra Platform (LLM Bridge):**
- Cinatra `/api/llm-bridge` — the sole ApiNode POSTs to `{{CINATRA_BASE_URL}}/api/llm-bridge`; this endpoint routes the LLM orchestration, injects MCP tools, and manages HITL interrupts
  - SDK/Client: Declarative HTTP ApiNode in `cinatra/oas.json` (`$referenced_components.publish`)
  - Auth: Platform-managed; `CINATRA_BASE_URL` env variable injected at runtime

**LinkedIn (via Cinatra MCP):**
- LinkedIn posting API — accessed indirectly through Cinatra MCP primitives; the agent never calls LinkedIn directly
  - MCP tools: `blog_post_publish_linkedin_start`, `blog_post_publish_linkedin_update`, `blog_post_publish_linkedin_publish`, `blog_post_publish_linkedin_cancel`
  - Auth: `linkedinAccountId` input passed to MCP tools; OAuth credentials managed by Cinatra platform
  - Destinations: member profile or organization page (`destinationType: "member" | "organization"`)

**OpenAI:**
- GPT-5.5 — preferred LLM for orchestration logic declared in `cinatra/oas.json` metadata (`preferredProvider: "openai"`, `preferredModel: "gpt-5.5"`)
  - SDK/Client: Cinatra LLM bridge (platform-managed); no direct OpenAI SDK in this repo
  - Auth: Platform-managed

## Data Storage

**Databases:**
- Not applicable — no direct database connection; all persistence goes through Cinatra MCP primitives

**Artifact Storage:**
- Cinatra artifact store — LinkedIn copy content stored and retrieved as artifacts
  - Read: `artifact_representation_get({ artifactId, representationRevisionId })` — resolves artifact bytes (base64 UTF-8 text/markdown)
  - Write: `artifact_authoring_emit({ extensionPackageName: "@cinatra-ai/blog-post-artifact", declaredMime: "text/markdown", content })` — mints new artifact revision when operator edits draft
  - Extension: `@cinatra-ai/blog-post-artifact` (shared with blog post body content)

**File Storage:**
- Not applicable — no local file storage; content is artifact-ref based

**Caching:**
- Not applicable — polling is performed live via `blog_project_get` (5-second cadence, 60-cycle max)

## Authentication & Identity

**Auth Provider:**
- Cinatra platform (platform-managed)
  - LinkedIn OAuth credentials are associated with `linkedinAccountId`; the agent receives the ID as an input and passes it to MCP tools — no credential handling in agent code

## Monitoring & Observability

**Error Tracking:**
- Not detected — no external error tracking SDK

**Logs:**
- Structured error envelopes returned as JSON output from the agent: `{ projectId, postId, linkedinDraftId, linkedinPostUrl, approved: false, summary: "<error message>" }`

## CI/CD & Deployment

**Hosting:**
- Cinatra marketplace — agent is published as `@cinatra-ai/blog-linkedin-publish-agent` (v0.1.0, Apache-2.0)

**CI Pipeline:**
- `.github/workflows/` directory present
- `extension-kind-gate.mjs` — zero-dependency Node.js CI gate that validates `cinatra/oas.json` shape and checks for banned MCP primitives in LLM-visible prompt strings before publish

## Environment Configuration

**Required env vars:**
- `CINATRA_BASE_URL` — base URL of the Cinatra platform API (injected at runtime; used in ApiNode URL template)

**Secrets location:**
- No `.env` or secrets files in repo; all credentials are platform-managed at runtime

## Webhooks & Callbacks

**Incoming:**
- HITL interrupt/resume — the Cinatra platform delivers operator approval payloads back to the agent after the `:draft-review` HITL gate; this is handled by the Cinatra A2UI INTERRUPT mechanism, not a conventional HTTP webhook

**Outgoing:**
- None — no outgoing webhooks registered by this agent

---

*Integration audit: 2026-06-09*
