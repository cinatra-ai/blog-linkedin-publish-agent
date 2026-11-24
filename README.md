# Blog LinkedIn Publish Agent

Post a LinkedIn post that already exists in Cinatra — the exact version you continued with — and get its address back on it. The run waits on Cinatra's review of that version, then on Cinatra's publish confirmation before anything goes out, so declining posts nothing.

To use this agent, connect a LinkedIn account to your Cinatra workspace via the marketplace, then trigger the agent with the LinkedIn post (`linkedinArtifactId`), the version of it you continued with (`linkedinRepresentationRevisionId`), the account (`linkedinAccountId`) and the destination (`destinationType` — `member` or `organization` — plus `destinationId` and `destinationName`). The blog post's address (`blogPostUrl`) is filled in at the publishing step from the WordPress publish, not asked of you at the start.

The agent reads the words of the version the review approved (the version you continued with, or the new version a Regenerate made and you then approved) through Cinatra's own artifact reads, and the publish confirmation shows the post and its destination read-only: what goes out is that approved version, so the confirmation decides only whether it goes. If the review approves no version, the run stops before anything is read and says why. Change the words on the post's review instead — this agent writes nothing and drafts nothing; the LinkedIn writer is what authors the post.

Once you publish it there, the post is published through the LinkedIn connector, and the agent writes the address back onto the LinkedIn post itself, under `linkedinPublishedUrl`, beside the platform's own id for it (`linkedinPublishedExternalId`) and the version that was published (`linkedinPublishedRevisionId`). The agent returns those as `linkedinPostUrl`, `linkedinPostExternalId` and `approved`; a publish returns a receipt, never a new document.

If the pinned version comes back cut short, the agent posts nothing rather than put out part of it.

If you decline, the run ends and nothing is published. If the publish fails, the agent returns an empty `linkedinPostUrl` with a one-line `summary`, and nothing is written onto the post — never a half address, never an empty one.

## Works with

- LinkedIn

## Capabilities

- Post the exact version of a LinkedIn post you continued with, straight from it
- Open Cinatra's review of the exact version it will post
- Wait for one person's answer on the publish confirmation, before anything goes out
- Carry the blog post's address, filled in at the publishing step rather than guessed at the start
- Write the post's address back onto it, where the rest of the product can read it
