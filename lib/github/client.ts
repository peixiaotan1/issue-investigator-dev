import { Octokit } from "@octokit/rest";

const GITHUB_REQUEST_TIMEOUT_MS = 10_000;

const fetchWithTimeout: typeof fetch = async (url, options) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GITHUB_REQUEST_TIMEOUT_MS);
  const upstreamSignal = options?.signal;

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      controller.abort();
    } else {
      upstreamSignal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

export function createGitHubClient(accessToken: string) {
  return new Octokit({
    auth: accessToken,
    userAgent: "issue-investigator-dev",
    request: {
      fetch: fetchWithTimeout,
    },
  });
}
