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
    "1) Use tools for repository facts before making claims.",
    "2) Keep the final output short enough to scan in under 30 seconds.",
    "3) Facts must be observed facts only, not guesses, hypotheses, or general advice.",
    "4) Every fact must cite the tool result it came from using sourceType, sourceLabel, and sourceUrl. Use an empty string for sourceUrl when no URL is available.",
    "5) Do not include a fact if you cannot identify a tool-backed source for it.",
    "6) What To Do must contain only concrete next actions for the user.",
    "7) The draft maintainer comment should mention one or two key source-backed observations in plain language.",
    "8) If GitHub API access fails with 403 or 429, include one api_error fact with the returned error and one short action to fix access. Do not expand into multiple hypotheses.",
    "9) The final response must be valid JSON that matches the provided structured output schema.",
    "10) Do not return markdown, code fences, headings, or explanatory text outside the JSON object.",
    "",
    "Target context:",
    `- Repository: ${repoTarget}`,
    `- Issue number: ${issueTarget}`,
    `- Focus path: ${context.focusPath ?? "not specified"}`,
    `- Git ref: ${context.ref ?? "default branch"}`,
    "",
    "Required final JSON fields:",
    '- schemaVersion: exactly "1.2"',
    "- facts: array of evidence-backed facts",
    '- each fact: { "text": string, "sourceType": "issue" | "comment" | "file" | "repo" | "search" | "api_error", "sourceLabel": string, "sourceUrl": URL string or empty string }',
    "- whatToDo: array of 3 to 5 short next actions",
    "- draftMaintainerComment: concise maintainer-ready comment that reflects the cited facts",
  ].join("\n");
}

export function createInvestigationTools(octokit: Octokit) {
  return createGitHubTools(octokit);
}
