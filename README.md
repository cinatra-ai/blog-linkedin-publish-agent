# Blog LinkedIn Publish Agent

Post a LinkedIn post that already exists in Cinatra, in the exact version you continued with, and get its address back on it. The run waits for Cinatra's review of that version, then for the publish confirmation, so declining posts nothing.

To use this agent, connect a LinkedIn account to your Cinatra workspace via the marketplace. Then trigger the agent with `linkedinArtifactId` (the post), `linkedinRepresentationRevisionId` (the version you continued with), `linkedinAccountId`, and the destination (`destinationType`, `member` or `organization`, plus `destinationId` and `destinationName`). The blog post's address (`blogPostUrl`) is filled in at the publishing step from the WordPress publish.

The run stops twice. First, Cinatra reviews that version. Then the publish confirmation shows the post and its destination read-only. Only the version the review approved goes out: your version, or the new one a Regenerate made and you approved. If the review approves no version, the run stops before anything is read and says why. The agent writes and drafts nothing; change the words in the review.

After you publish, the agent writes the address onto the post as `linkedinPublishedUrl`. It also writes the platform's id (`linkedinPublishedExternalId`) and the published version (`linkedinPublishedRevisionId`). It returns `linkedinPostUrl`, `linkedinPostExternalId` and `approved`, and creates no new document.

If the version comes back cut short, nothing is posted. If you decline, nothing is published. If the publish fails, the agent returns an empty `linkedinPostUrl` with a one-line `summary`, and writes nothing onto the post.

## Works with

- LinkedIn

## Capabilities

- Post the exact version of a LinkedIn post you continued with
- Open Cinatra's review of the version it will post
- Wait for one person's answer before anything goes out
- Carry the blog post's address, filled in at the publishing step
- Write the post's address back onto it
