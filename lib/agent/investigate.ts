import { createGitHubTools } from "@/lib/github/tools";
import { parseIssueUrl } from "@/lib/github/parse-issue-url";
import type { Octokit } from "@octokit/rest";

export type InvestigationContext = {
  issueUrl?: string;
  owner?: string;
  repo?: string;
  issueNumber?: number;
  issueBody?: string;
  focusPath?: string;
  ref?: string;
};

const CONTEXT_START = "[INVESTIGATION_CONTEXT]";
const CONTEXT_END = "[/INVESTIGATION_CONTEXT]";

function parseContextBlock(message: string): InvestigationContext {
  const startIndex = message.indexOf(CONTEXT_START);
  const endIndex = message.indexOf(CONTEXT_END);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return {};
  }

  const block = message.slice(startIndex + CONTEXT_START.length, endIndex).trim();
  const lines = block.split("\n");
  const context: InvestigationContext = {};

  for (const line of lines) {
    const [key, ...rest] = line.split("=");
    if (!key || rest.length === 0) continue;
    const value = rest.join("=").trim();

    switch (key.trim()) {
      case "issue_url":
        context.issueUrl = value;
        break;
      case "owner":
        context.owner = value;
        break;
      case "repo":
        context.repo = value;
        break;
      case "issue_number":
        context.issueNumber = Number(value);
        break;
      case "issue_body":
        context.issueBody = value;
        break;
      case "focus_path":
        context.focusPath = value;
        break;
      case "ref":
        context.ref = value;
        break;
      default:
        break;
    }
  }

  if (context.issueUrl) {
    const parsed = parseIssueUrl(context.issueUrl);
    if (parsed) {
      context.owner = parsed.owner;
      context.repo = parsed.repo;
      context.issueNumber = parsed.issueNumber;
    }
  }

  return context;
}

export function extractContextFromUserMessage(message: string): InvestigationContext {
  return parseContextBlock(message);
}

export function createInvestigationSystemPrompt(context: InvestigationContext): string {
  const repoTarget =
    context.owner && context.repo ? `${context.owner}/${context.repo}` : "unknown";
  const issueTarget = context.issueNumber ? `#${context.issueNumber}` : "unknown";

  return [
    "You are a GitHub issue investigation assistant.",
    "Your goal is to help engineers quickly scope likely causes and next steps.",
    "Rules:",
    "1) Distinguish facts from hypotheses.",
    "2) Use tools for repository facts before making claims.",
    "3) When you reference code, include repository paths in backticks.",
    "4) Keep output concise and actionable.",
    "5) If API limits or permissions fail, explain clearly and suggest a fallback.",
    "",
    "Target context:",
    `- Repository: ${repoTarget}`,
    `- Issue number: ${issueTarget}`,
    `- Focus path: ${context.focusPath ?? "not specified"}`,
    `- Git ref: ${context.ref ?? "default branch"}`,
    "",
    "Return the final response with these sections:",
    "- Facts Found",
    "- Hypotheses",
    "- Suggested Next Steps",
    "- Draft Maintainer Comment",
  ].join("\n");
}

export function createInvestigationTools(octokit: Octokit) {
  return createGitHubTools(octokit);
}
