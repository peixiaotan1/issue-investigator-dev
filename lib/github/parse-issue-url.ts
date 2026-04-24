const ISSUE_URL_REGEX =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)(?:\/.*)?$/i;

export type ParsedIssueRef = {
  owner: string;
  repo: string;
  issueNumber: number;
};

export function parseIssueUrl(issueUrl: string): ParsedIssueRef | null {
  const match = issueUrl.trim().match(ISSUE_URL_REGEX);

  if (!match) {
    return null;
  }

  const [, owner, repo, issueNumber] = match;
  const normalizedRepo = repo.endsWith(".git") ? repo.slice(0, -4) : repo;

  return {
    owner,
    repo: normalizedRepo,
    issueNumber: Number(issueNumber),
  };
}
