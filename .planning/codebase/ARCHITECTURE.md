<!-- refreshed: 2026-06-09 -->
# Architecture

**Analysis Date:** 2026-06-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Caller / Host System                      │
│             (passes 8 inputs: projectId, postId, ...)            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               StartNode (Inputs)                                 │
│  `cinatra/oas.json` → $referenced_components.start              │
│  Required: projectId, postId, linkedinAccountId, destinationType │
│            destinationId, destinationName, blogPostUrl           │
│  Optional: linkedinAccountName                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ DataFlowEdge (all 8 inputs)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               ApiNode "publish"                                  │
│  `cinatra/oas.json` → $referenced_components.publish            │
│  POST {{CINATRA_BASE_URL}}/api/llm-bridge                        │
│  LLM: openai / gpt-5.5                                           │
│  Skill: `skills/blog-linkedin-publish-agent/SKILL.md`            │
│                                                                  │
│  Orchestrates 6-step flow via 7 MCP primitives:                  │
│    1. blog_post_publish_linkedin_start                           │
│    2. blog_project_get (poll every 5s, max 60 cycles)            │
│    3. artifact_representation_get (resolve copy bytes)           │
│    4. HITL Gate :draft-review (INTERRUPT)                        │
│    5. artifact_authoring_emit + blog_post_publish_linkedin_update│
│    6. blog_post_publish_linkedin_publish + poll                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ DataFlowEdge (6 outputs)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               EndNode                                            │
│  `cinatra/oas.json` → $referenced_components.end                 │
│  Outputs: projectId, postId, linkedinDraftId, linkedinPostUrl,   │
│           approved, summary                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| StartNode | Validates and passes all 8 agent inputs into the flow | `cinatra/oas.json` → `$referenced_components.start` |
| ApiNode (publish) | LLM orchestration via /api/llm-bridge; runs all 6 steps including HITL gate | `cinatra/oas.json` → `$referenced_components.publish` |
| EndNode | Collects and surfaces final outputs with defaults | `cinatra/oas.json` → `$referenced_components.end` |
| SKILL.md | Canonical step-by-step prompt recipe consumed by the LLM at runtime | `skills/blog-linkedin-publish-agent/SKILL.md` |
| extension-kind-gate | Zero-dependency CI gate that validates OAS for banned retired primitives | `extension-kind-gate.mjs` |

## Pattern Overview

**Overall:** Single-ApiNode LLM-orchestrated Flow (Cinatra "agent" kind)

**Key Characteristics:**
- All logic lives in the LLM prompt (SKILL.md); the OAS flow graph has only three nodes: Start → ApiNode → End.
- The ApiNode calls a single HTTP endpoint (`/api/llm-bridge`) with the system/user prompt assembled from inputs; the LLM executes tool calls server-side via the injected Cinatra self-MCP.
- One mandatory HITL gate (`:draft-review`) — the LLM emits an A2UI INTERRUPT, suspends execution, and waits for operator approval before publishing.
- Artifact-ref pattern: LinkedIn copy is never passed inline; it lives in `@cinatra-ai/blog-post-artifact` and is referenced by `contentArtifactId` + `contentRepresentationRevisionId`.

## Layers

**Flow Definition Layer:**
- Purpose: Declarative graph of nodes, data-flow edges, and metadata consumed by the Cinatra runtime
- Location: `cinatra/oas.json`
- Contains: StartNode, ApiNode, EndNode; input/output schemas; HITL screen declaration; LLM model preferences
- Depends on: Cinatra runtime (evaluated server-side)
- Used by: Cinatra platform on agent invocation

**Skill / Prompt Layer:**
- Purpose: Step-by-step LLM instruction set; the "source of truth" for agent behaviour
- Location: `skills/blog-linkedin-publish-agent/SKILL.md`
- Contains: Tool discipline list, hard contract facts, 6-step recipe, error envelope format
- Depends on: LLM, 7 MCP primitives exposed by Cinatra self-MCP
- Used by: ApiNode system prompt (copied verbatim into `cinatra/oas.json` `data.system`)

**CI Gate Layer:**
- Purpose: Pre-publish sanity checks on the extracted repo without any @cinatra-ai registry dependency
- Location: `extension-kind-gate.mjs`
- Contains: `validateAgent`, `validateWorkflow`, `validateBpmnSanity`, `runGate`
- Depends on: Node.js builtins only
- Used by: `.github/workflows/ci.yml` (`kind-gates` job)

## Data Flow

### Primary Request Path (Happy Path — Approved with No Edits)

1. Caller invokes agent with 8 inputs → StartNode (`cinatra/oas.json` start node)
2. All inputs forwarded via DataFlowEdges → ApiNode POSTs to `/api/llm-bridge`
3. LLM calls `blog_post_publish_linkedin_start` — kicks off background draft generation
4. LLM polls `blog_project_get` every 5 s (max 60 cycles) until `status === "succeeded"` AND `operation === "draft"`
5. LLM reads `post.linkedinDrafts[]`, finds matching entry, calls `artifact_representation_get` to resolve copy bytes
6. LLM emits INTERRUPT with `x-renderer: "@cinatra-ai/blog-linkedin-publish-agent:draft-review"` — operator sees draft
7. Operator approves (no edits) → LLM calls `blog_post_publish_linkedin_publish`
8. LLM polls `blog_project_get` until `status === "succeeded"` AND `operation === "publish"`
9. Result `{ projectId, postId, linkedinDraftId, linkedinPostUrl, approved: true, summary }` → EndNode

### Operator-Edit Path

1. Steps 1–6 same as above
2. Operator submits edited content → LLM calls `artifact_authoring_emit` (extension `@cinatra-ai/blog-post-artifact`, `declaredMime: "text/markdown"`)
3. LLM calls `blog_post_publish_linkedin_update` with new `{ contentArtifactId, contentRepresentationRevisionId }` refs
4. LLM calls `blog_post_publish_linkedin_publish` → polls → returns success envelope

### Rejection Path

1. Steps 1–6 same as above
2. Operator rejects → LLM calls `blog_post_publish_linkedin_cancel` (best-effort; terminal-state safe)
3. Returns error envelope with `approved: false`

**State Management:**
- No local state; all state lives in the Cinatra server-side project record, queried via `blog_project_get`.
- LLM reads `linkedinDraftGeneration.status`, `linkedinDraftGeneration.operation`, and `post.linkedinDrafts[]` from each poll response.

## Key Abstractions

**LinkedIn Draft Entry:**
- Purpose: Represents a generated LinkedIn post copy tied to a specific account and destination
- Location: returned by `blog_project_get` at `result.posts[].linkedinDrafts[]`
- Fields: `id`, `contentArtifactId`, `contentRepresentationRevisionId`, `linkedinAccountId`, `destinationId`, `destinationName`, `blogPostUrl`, `status: "draft" | "published"`

**Artifact Ref Pair:**
- Purpose: Immutable pointer to versioned content; used in place of inline strings
- Pattern: `{ contentArtifactId, contentRepresentationRevisionId }` — always resolved via `artifact_representation_get` before display; new revision minted by `artifact_authoring_emit` on edit

**Error Envelope:**
- Purpose: Uniform output shape for all failure paths
- Pattern: `{ projectId, postId, linkedinDraftId, linkedinPostUrl: "", approved: false, summary: "<one-liner>" }`

**BackgroundProcessRunStatus:**
- Purpose: Lifecycle state for async backend jobs
- Values: `"idle" | "running" | "succeeded" | "failed" | "stopped"` — agent polls until terminal; watches `"succeeded"` not `"completed"`

## Entry Points

**Agent Invocation:**
- Location: `cinatra/oas.json` (StartNode)
- Triggers: Cinatra platform calling the agent with 8 defined inputs
- Responsibilities: Input validation (required field enforcement), forwarding to ApiNode

**CI Gate:**
- Location: `extension-kind-gate.mjs` (CLI entry via `main()`)
- Triggers: `node extension-kind-gate.mjs --package-root .` in `.github/workflows/ci.yml`
- Responsibilities: Parse `package.json`, dispatch to `validateAgent` or `validateWorkflow`, exit 0/1

## Architectural Constraints

- **LLM execution:** All orchestration logic runs inside the LLM; the flow graph itself is stateless configuration.
- **Tool discipline:** The LLM may call exactly 7 named MCP primitives. `web_search`, `objects_*`, and all others are explicitly forbidden.
- **No inline content:** LinkedIn copy must never be passed as `content: string` to update primitives; always use artifact refs.
- **Single artifact extension:** Both blog body and LinkedIn copy use `@cinatra-ai/blog-post-artifact` — no separate social-content extension type.
- **Polling limits:** Both draft-generation and publish polls have a hard cap of 60 cycles × 5 s = 5 minutes.
- **Cancel is terminal-state safe:** `blog_post_publish_linkedin_cancel` is idempotent when called after `succeeded/failed/stopped`.
- **Registry independence:** `extension-kind-gate.mjs` uses only Node.js builtins; it must remain installable without the `@cinatra-ai` private registry.

## Anti-Patterns

### Inline content in update calls

**What happens:** Passing `content: string` directly to `blog_post_publish_linkedin_update`.
**Why it's wrong:** The update primitive only accepts artifact refs; inline content is not part of the API contract.
**Do this instead:** Call `artifact_authoring_emit` first to mint a new revision, then pass `{ contentArtifactId, contentRepresentationRevisionId }` to `_update`.

### Polling for `"completed"` status

**What happens:** Checking `status === "completed"` when waiting for a background job.
**Why it's wrong:** `BackgroundProcessRunStatus` has no `"completed"` value; the terminal success value is `"succeeded"`.
**Do this instead:** Check `status === "succeeded"` AND the appropriate `operation` field (`"draft"` or `"publish"`).

### Looking for a separate publish-generation field

**What happens:** Querying a hypothetical `linkedinPublishGeneration` field after calling publish.
**Why it's wrong:** Publish reuses `linkedinDraftGeneration` with `operation === "publish"`; no separate field exists.
**Do this instead:** Watch `linkedinDraftGeneration.operation === "publish"` on the same generation state.

## Error Handling

**Strategy:** Fail-fast with a structured error envelope; every error path returns the same JSON shape so callers can handle uniformly without branching on schema.

**Patterns:**
- Any MCP call failure → return error envelope immediately with `summary: "<primitive> failed: <error>"`
- Poll timeout (60 cycles) → return error envelope with `summary: "...timed out after 5 minutes"`
- `status === "failed"` or `"stopped"` → return error envelope immediately
- No matching draft entry → return error envelope (handles state races)
- Missing artifact refs → return error envelope before reaching HITL

## Cross-Cutting Concerns

**Logging:** Not applicable — no application-layer logging; the LLM reasoning trace is handled by the Cinatra llm-bridge.
**Validation:** Input schema enforced by the StartNode required fields list in `cinatra/oas.json`; runtime contract facts documented in `SKILL.md`.
**Authentication:** LinkedIn account identity passed as `linkedinAccountId`; account connection managed by Cinatra platform, not the agent.

---

*Architecture analysis: 2026-06-09*
