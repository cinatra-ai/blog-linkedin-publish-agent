# Blog LinkedIn Publish Agent

Adapt a published blog post into a LinkedIn post and ship it from your member profile or company page. The agent drafts the LinkedIn copy, pauses for you to review and tweak the wording, then posts it for you and hands back the live LinkedIn URL.

**Purpose.** Automates the blog-to-LinkedIn publish workflow: draft generation, human-in-the-loop review, and final publish.

**Prerequisites.** A LinkedIn account must be connected to your Cinatra workspace before triggering this agent. The connection supplies the `linkedinAccountId` input.

**Inputs.** `projectId` and `postId` identify the Cinatra blog post. `linkedinAccountId` is the connected LinkedIn account. `destinationType` is `member` or `organization`; pair it with `destinationId` and `destinationName`. `blogPostUrl` is the canonical public URL the draft links back to.

**Usage.** Trigger the agent from the Cinatra dashboard with the inputs above. The agent starts draft generation, polls until the draft is ready (up to five minutes), then opens a review screen. You can read, edit, or reject the proposed copy. On approval the agent persists any edits and publishes, then returns `linkedinPostUrl`.

**Configuration.** No extra environment variables are required at runtime. The agent uses the Cinatra self-MCP bridge and the `@cinatra-ai/blog-post-artifact` extension to store and retrieve LinkedIn copy revisions.

**Outputs.** On success: `linkedinPostUrl`, `linkedinDraftId`, `approved: true`, and a `summary`. On rejection: `approved: false` with a summary.

**Troubleshooting.** If draft generation times out, retry after checking the blog project status in the dashboard. If the review screen shows no content, confirm the blog post record contains `contentArtifactId` and `contentRepresentationRevisionId` refs. A `destinationType` mismatch (passing a member id for an organization) causes a LinkedIn API error at publish time.

## Works with

- LinkedIn

## Capabilities

- Adapt a Cinatra blog post into a native-feeling LinkedIn post
- Review and edit the draft before anything is published
- Publish to a LinkedIn member profile or company page on your behalf
- Return the live LinkedIn post URL for sharing and tracking
