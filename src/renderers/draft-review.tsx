"use client";

// HITL field renderer for @cinatra-ai/blog-linkedin-publish-agent, binding
// `@cinatra-ai/blog-linkedin-publish-agent:draft-review` (kind
// "linkedin-draft-review"). Relocated OUT of the host (packages/agents) into its
// claiming extension per cinatra#1625 (epic #1620 S8 — M3). The host resolves
// this module through the generated field-renderer component map keyed by the
// binding id; a degraded/absent module falls back to the host's
// SchemaFieldRenderer floor.
//
// THE SCREEN SHOWS, IT DOES NOT EDIT (cinatra#3035, plan section 6.1 step 7: "a
// confirmation before the LinkedIn post goes out, then its address"). What is
// published is the revision of the LinkedIn post artifact the person continued
// with, so the copy here is exactly those words, read-only: a last-second edit
// in this box would publish bytes no revision holds. Words are changed on the
// review, which appends a revision; this screen decides only whether the post
// goes out.
//
// A source mirror the host builds into its own graph: props type comes from the
// public `@cinatra-ai/sdk-ui/field-renderer-props` contract (an agent extension
// may import only @cinatra-ai/sdk-extensions + @cinatra-ai/sdk-ui as first-party
// code); the shadcn primitives are VENDORED (own-your-code copies under
// ./components/ui), not imported from the host `@/` alias.

import { useEffect, useMemo, useRef } from "react";

import type { FieldRendererProps } from "@cinatra-ai/sdk-ui/field-renderer-props";

import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Label } from "../components/ui/label";

type DraftReviewValue = {
  linkedinArtifactId: string;
  linkedinRepresentationRevisionId: string;
  content: string;
  linkedinAccountName?: string;
  destinationName?: string;
  destinationType?: string;
  blogPostUrl?: string;
};

function str(v: Record<string, unknown>, key: string): string {
  return typeof v[key] === "string" ? (v[key] as string) : "";
}

function toDraftReviewValue(value: unknown): DraftReviewValue {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    return {
      linkedinArtifactId: str(v, "linkedinArtifactId"),
      linkedinRepresentationRevisionId: str(
        v,
        "linkedinRepresentationRevisionId",
      ),
      content: str(v, "content"),
      linkedinAccountName: str(v, "linkedinAccountName") || undefined,
      destinationName: str(v, "destinationName") || undefined,
      destinationType: str(v, "destinationType") || undefined,
      blogPostUrl: str(v, "blogPostUrl") || undefined,
    };
  }
  return { linkedinArtifactId: "", linkedinRepresentationRevisionId: "", content: "" };
}

export default function BlogLinkedinDraftReviewRenderer({
  value,
  onChange,
  disabled,
}: FieldRendererProps) {
  const v = useMemo(() => toDraftReviewValue(value), [value]);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Gate the decision on a complete artifact reference. The renderer mounts as
  // soon as the interrupt fires; if the agent has not yet wired the reference
  // into the field-snapshot (mount race) a decision would name no revision —
  // and the revision is precisely what goes out.
  const hasReference =
    v.linkedinArtifactId.trim() !== "" &&
    v.linkedinRepresentationRevisionId.trim() !== "";
  const buttonsDisabled = disabled === true || !hasReference;

  const decide = (approved: boolean) => () => {
    if (!hasReference) return;
    onChangeRef.current({
      approved,
      linkedinArtifactId: v.linkedinArtifactId,
      linkedinRepresentationRevisionId: v.linkedinRepresentationRevisionId,
    });
  };

  return (
    <Card className="border-line bg-surface backdrop-blur-none">
      <CardHeader>
        <CardTitle>Post this to LinkedIn?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {(v.linkedinAccountName || v.destinationName || v.destinationType) && (
          <div className="grid gap-1 text-sm text-muted-foreground">
            {v.linkedinAccountName && (
              <p>
                <span className="text-foreground">Account:</span>{" "}
                {v.linkedinAccountName}
              </p>
            )}
            {v.destinationName && (
              <p>
                <span className="text-foreground">
                  Destination ({v.destinationType ?? "member"}):
                </span>{" "}
                {v.destinationName}
              </p>
            )}
            {v.blogPostUrl && (
              <p>
                <span className="text-foreground">Blog post:</span>{" "}
                <a
                  href={v.blogPostUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  {v.blogPostUrl}
                </a>
              </p>
            )}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="blog-linkedin-post-content">
            The post that goes out
          </Label>
          <p
            id="blog-linkedin-post-content"
            className="whitespace-pre-wrap rounded-md border border-line bg-surface p-3 text-sm text-foreground"
          >
            {v.content}
          </p>
          <p className="text-xs text-muted-foreground">
            These are the words you continued with. To change them, go back to
            the review of the post.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={decide(false)}
          disabled={buttonsDisabled}
          type="button"
        >
          Do not post
        </Button>
        <Button onClick={decide(true)} disabled={buttonsDisabled} type="button">
          Post to LinkedIn
        </Button>
      </CardFooter>
    </Card>
  );
}
