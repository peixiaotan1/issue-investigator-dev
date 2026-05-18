const ISSUE_URL_REGEX =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)(?:\/.*)?$/i;
const ISSUE_URL_IN_TEXT_REGEX =
  /https?:\/\/github\.com\/[^/\s)]+\/[^/\s)]+\/issues\/\d+(?:\/[^\s)]*)?/i;

export type ParsedIssueRef = {
  owner: string;
  repo: string;
  issueNumber: number;
};

export function parseIssueUrl(issueUrl: string): ParsedIssueRef | null {
  const trimmed = issueUrl.trim();
  const candidate = trimmed.match(ISSUE_URL_REGEX)
    ? trimmed
    : trimmed.match(ISSUE_URL_IN_TEXT_REGEX)?.[0];
  const match = candidate?.match(ISSUE_URL_REGEX);

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
