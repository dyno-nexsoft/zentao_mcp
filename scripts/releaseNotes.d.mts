export interface CommitText {
  subject: string;
  body?: string;
}

export interface ParsedCommit {
  type: string | null;
  scope: string | null;
  description: string;
  breaking: boolean;
}

export function parseCommit(commit: CommitText): ParsedCommit;
export function buildReleaseNotes(commits: CommitText[]): string;
export function prependChangelogEntry(
  changelog: string,
  version: string,
  date: string,
  notes: string
): string;
