import { tool } from "ai";
import type { Octokit } from "@octokit/rest";
import { z } from "zod";

const MAX_FILE_CHARS = 16000;

function buildGitHubErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Unknown GitHub API error";
  }

  const maybeStatus = "status" in error ? error.status : undefined;
  const maybeMessage = "message" in error ? error.message : undefined;

  if (typeof maybeStatus === "number" && typeof maybeMessage === "string") {
    if (maybeStatus === 403 || maybeStatus === 429) {
      return `GitHub API limit or permission issue (${maybeStatus}): ${maybeMessage}`;
    }
    return `GitHub API error (${maybeStatus}): ${maybeMessage}`;
  }

  return "GitHub API error";
}

export function createGitHubTools(octokit: Octokit) {
  return {
    getIssue: tool({
      description: "Get issue details by owner/repo/number",
      inputSchema: z.object({
        owner: z.string(),
        repo: z.string(),
        issueNumber: z.number().int().positive(),
      }),
      execute: async ({ owner, repo, issueNumber }) => {
        try {
          const { data } = await octokit.issues.get({
            owner,
            repo,
            issue_number: issueNumber,
          });

          return {
            number: data.number,
            title: data.title,
            state: data.state,
            labels: data.labels.map((label) =>
              typeof label === "string" ? label : label.name,
            ),
            body: data.body ?? "",
            comments: data.comments,
            htmlUrl: data.html_url,
          };
        } catch (error) {
          return { error: buildGitHubErrorMessage(error) };
        }
      },
    }),
    listIssueComments: tool({
      description: "List the latest comments for an issue",
      inputSchema: z.object({
        owner: z.string(),
        repo: z.string(),
        issueNumber: z.number().int().positive(),
        limit: z.number().int().positive().max(20).optional(),
      }),
      execute: async ({ owner, repo, issueNumber, limit = 5 }) => {
        try {
          const { data } = await octokit.issues.listComments({
            owner,
            repo,
            issue_number: issueNumber,
            per_page: limit,
          });

          return data.map((comment) => ({
            author: comment.user?.login ?? "unknown",
            body: comment.body ?? "",
            createdAt: comment.created_at,
            url: comment.html_url,
          }));
        } catch (error) {
          return { error: buildGitHubErrorMessage(error) };
        }
      },
    }),
    getRepoMetadata: tool({
      description: "Get repository metadata such as default branch",
      inputSchema: z.object({
        owner: z.string(),
        repo: z.string(),
      }),
      execute: async ({ owner, repo }) => {
        try {
          const { data } = await octokit.repos.get({ owner, repo });
          return {
            fullName: data.full_name,
            defaultBranch: data.default_branch,
            description: data.description ?? "",
            private: data.private,
          };
        } catch (error) {
          return { error: buildGitHubErrorMessage(error) };
        }
      },
    }),
    getDirectoryContents: tool({
      description: "List files and directories under a path",
      inputSchema: z.object({
        owner: z.string(),
        repo: z.string(),
        path: z.string().optional().default(""),
        ref: z.string().optional(),
      }),
      execute: async ({ owner, repo, path = "", ref }) => {
        try {
          const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path,
            ref,
          });

          if (!Array.isArray(data)) {
            return {
              error:
                "Requested path is a file; use getFileContent for file content.",
            };
          }

          return data.map((entry) => ({
            path: entry.path,
            type: entry.type,
            size: entry.size ?? 0,
          }));
        } catch (error) {
          return { error: buildGitHubErrorMessage(error) };
        }
      },
    }),
    getFileContent: tool({
      description: "Read text content from a repository file",
      inputSchema: z.object({
        owner: z.string(),
        repo: z.string(),
        path: z.string(),
        ref: z.string().optional(),
      }),
      execute: async ({ owner, repo, path, ref }) => {
        try {
          const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path,
            ref,
          });

          if (Array.isArray(data) || data.type !== "file") {
            return { error: "Requested path is not a file." };
          }

          if (data.encoding !== "base64" || !data.content) {
            return { error: "File is not decodable as UTF-8 text." };
          }

          const decoded = Buffer.from(data.content, "base64").toString("utf8");
          return {
            path: data.path,
            sha: data.sha,
            truncated: decoded.length > MAX_FILE_CHARS,
            content: decoded.slice(0, MAX_FILE_CHARS),
          };
        } catch (error) {
          return { error: buildGitHubErrorMessage(error) };
        }
      },
    }),
    searchCode: tool({
      description: "Search code within a repository by query",
      inputSchema: z.object({
        owner: z.string(),
        repo: z.string(),
        query: z.string().min(2),
      }),
      execute: async ({ owner, repo, query }) => {
        try {
          const { data } = await octokit.search.code({
            q: `${query} repo:${owner}/${repo}`,
            per_page: 10,
          });

          return data.items.map((item) => ({
            path: item.path,
            sha: item.sha,
            url: item.html_url,
          }));
        } catch (error) {
          return { error: buildGitHubErrorMessage(error) };
        }
      },
    }),
  };
}
