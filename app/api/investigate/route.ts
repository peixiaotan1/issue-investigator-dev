import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createGitHubClient } from "@/lib/github/client";
import { extractContextFromUserMessage, type InvestigationContext } from "@/lib/agent/investigate";
import type {
  EvidenceFact,
  InvestigationReport,
} from "@/lib/agent/investigation-report-schema";
import type { Octokit } from "@octokit/rest";

export const maxDuration = 60;

function getLastUserText(messages: UIMessage[]): string {
  const lastUserMessage = [...messages].reverse().find((msg) => msg.role === "user");
  if (!lastUserMessage) return "";

  return lastUserMessage.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function createReportStreamResponse(report: InvestigationReport) {
  const text = JSON.stringify(report);
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const id = "investigation-report";
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: text });
      writer.write({ type: "text-end", id });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

function buildGitHubErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Unknown GitHub API error";
  }

  const maybeStatus = "status" in error ? error.status : undefined;
  const maybeMessage = "message" in error ? error.message : undefined;
  if (typeof maybeStatus === "number" && typeof maybeMessage === "string") {
    return `GitHub API error (${maybeStatus}): ${maybeMessage}`;
  }

  return "GitHub API error";
}

function createInputErrorReport(message: string): InvestigationReport {
  return {
    schemaVersion: "1.2",
    facts: [
      {
        text: message,
        sourceType: "api_error",
        sourceLabel: "Investigation input",
        sourceUrl: "",
      },
    ],
    whatToDo: [
      "Paste a full GitHub issue URL, or provide owner, repo, and issue number in advanced options.",
      "Try the investigation again after the target issue is identified.",
    ],
    draftMaintainerComment:
      "I could not inspect the issue yet because the repository and issue number were not provided.",
  };
}

async function runDeterministicInvestigation(
  octokit: Octokit,
  context: InvestigationContext,
): Promise<InvestigationReport> {
  if (!context.owner || !context.repo || !context.issueNumber) {
    return createInputErrorReport(
      "Missing repository or issue number. The investigator needs a GitHub issue URL or owner/repo/issue number.",
    );
  }

  const facts: EvidenceFact[] = [];
  const sourceRepo = `${context.owner}/${context.repo}`;
  let issueTitle = `Issue #${context.issueNumber}`;
  let issueUrl = context.issueUrl ?? "";
  let defaultBranch = context.ref || "the default branch";

  try {
    const { data: repo } = await octokit.repos.get({
      owner: context.owner,
      repo: context.repo,
    });
    defaultBranch = context.ref || repo.default_branch;
    facts.push({
      text: `${repo.full_name} uses ${repo.default_branch} as its default branch.`,
      sourceType: "repo",
      sourceLabel: sourceRepo,
      sourceUrl: repo.html_url,
    });
  } catch (error) {
    const message = buildGitHubErrorMessage(error);
    return {
      schemaVersion: "1.2",
      facts: [
        {
          text: message,
          sourceType: "api_error",
          sourceLabel: sourceRepo,
          sourceUrl: "",
        },
      ],
      whatToDo: [
        "Confirm the signed-in GitHub account can read the target repository.",
        "Retry after GitHub API access or rate limits recover.",
      ],
      draftMaintainerComment: `I could not inspect ${sourceRepo} because GitHub returned: ${message}`,
    };
  }

  try {
    const { data: issue } = await octokit.issues.get({
      owner: context.owner,
      repo: context.repo,
      issue_number: context.issueNumber,
    });
    issueTitle = issue.title;
    issueUrl = issue.html_url;
    const labels = issue.labels
      .map((label) => (typeof label === "string" ? label : label.name))
      .filter(Boolean)
      .join(", ");
    facts.push({
      text: `Issue #${issue.number} is ${issue.state}: ${issue.title}${
        labels ? `; labels: ${labels}` : ""
      }.`,
      sourceType: "issue",
      sourceLabel: `Issue #${issue.number}`,
      sourceUrl: issue.html_url,
    });
    if (issue.body?.trim()) {
      facts.push({
        text: `The issue body contains ${issue.body.trim().length} characters of reporter-provided context.`,
        sourceType: "issue",
        sourceLabel: `Issue #${issue.number} body`,
        sourceUrl: issue.html_url,
      });
    }
  } catch (error) {
    const message = buildGitHubErrorMessage(error);
    facts.push({
      text: message,
      sourceType: "api_error",
      sourceLabel: `Issue #${context.issueNumber}`,
      sourceUrl: issueUrl,
    });
  }

  try {
    const { data: comments } = await octokit.issues.listComments({
      owner: context.owner,
      repo: context.repo,
      issue_number: context.issueNumber,
      per_page: 5,
    });
    if (comments.length > 0) {
      const latestComment = comments[comments.length - 1];
      facts.push({
        text: `The latest fetched comment is by ${latestComment.user?.login ?? "unknown"} at ${latestComment.created_at}.`,
        sourceType: "comment",
        sourceLabel: `Latest fetched comment on #${context.issueNumber}`,
        sourceUrl: latestComment.html_url,
      });
    }
  } catch (error) {
    facts.push({
      text: buildGitHubErrorMessage(error),
      sourceType: "api_error",
      sourceLabel: `Comments for #${context.issueNumber}`,
      sourceUrl: issueUrl,
    });
  }

  if (context.focusPath) {
    try {
      const { data } = await octokit.repos.getContent({
        owner: context.owner,
        repo: context.repo,
        path: context.focusPath,
        ref: context.ref || undefined,
      });
      if (Array.isArray(data)) {
        facts.push({
          text: `${context.focusPath} is a directory with ${data.length} fetched entries on ${defaultBranch}.`,
          sourceType: "file",
          sourceLabel: context.focusPath,
          sourceUrl: `https://github.com/${sourceRepo}/tree/${defaultBranch}/${context.focusPath}`,
        });
      } else {
        facts.push({
          text: `${data.path} exists as a ${data.type} on ${defaultBranch}.`,
          sourceType: "file",
          sourceLabel: data.path,
          sourceUrl: data.html_url ?? "",
        });
      }
    } catch (error) {
      facts.push({
        text: buildGitHubErrorMessage(error),
        sourceType: "api_error",
        sourceLabel: context.focusPath,
        sourceUrl: "",
      });
    }
  }

  return {
    schemaVersion: "1.2",
    facts,
    whatToDo: [
      `Reproduce ${issueTitle} from the issue body and any latest maintainer comments.`,
      context.focusPath
        ? `Inspect ${context.focusPath} on ${defaultBranch} for the code path most likely related to the report.`
        : `Identify the smallest code path in ${sourceRepo} related to the report before changing code.`,
      "Ask the reporter for a minimal reproduction if the issue body does not include one.",
    ],
    draftMaintainerComment: `Thanks for the report. I checked ${sourceRepo} issue #${context.issueNumber} and confirmed the issue is available for triage. ${
      context.focusPath
        ? `I also checked ${context.focusPath} on ${defaultBranch} as the current focus area. `
        : ""
    }Next step is to reproduce the behavior from the issue details and narrow it to the smallest affected code path.`,
  };
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return Response.json(
      { error: "Unauthorized. Please sign in with GitHub first." },
      { status: 401 },
    );
  }

  const payload = (await request.json()) as { messages?: UIMessage[] };
  const messages = payload.messages ?? [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "No messages provided." }, { status: 400 });
  }

  const lastUserText = getLastUserText(messages);
  const context = extractContextFromUserMessage(lastUserText);
  const octokit = createGitHubClient(session.accessToken);
  const report = await runDeterministicInvestigation(octokit, context);

  return createReportStreamResponse(report);
}
