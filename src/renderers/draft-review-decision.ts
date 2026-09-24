// The decision the draft-review screen hands the host, as one pure function with
// no imports (cinatra-ai/cinatra#3564).
//
// The screen is raised by the flow's `confirm_gate` node, and the gate's answer
// reaches the flow as ONE string: the host resumes the run with the
// `userResponse` a renderer puts in its values, and without one it resumes with
// a bare approval marker that says nothing about which button was pressed. So
// the decision rides that string: `userResponse` is the JSON text of the
// approved flag and the two reference ids, and the publish step posts only when
// it parses to an approval of exactly the revision it was handed.

export type DraftReviewDecision = {
  approved: boolean;
  linkedinArtifactId: string;
  linkedinRepresentationRevisionId: string;
  userResponse: string;
};

export function draftReviewDecision(
  approved: boolean,
  linkedinArtifactId: string,
  linkedinRepresentationRevisionId: string,
): DraftReviewDecision {
  return {
    approved,
    linkedinArtifactId,
    linkedinRepresentationRevisionId,
    userResponse: JSON.stringify({
      approved,
      linkedinArtifactId,
      linkedinRepresentationRevisionId,
    }),
  };
}
