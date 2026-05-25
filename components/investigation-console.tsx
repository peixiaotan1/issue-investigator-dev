"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  investigationReportSchema,
  type EvidenceFact,
  type InvestigationReport,
} from "@/lib/agent/investigation-report-schema";

function getVisibleText(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("\n")
    .trim();
}

type ReportParseResult =
  | { state: "empty" }
  | { state: "pending" }
  | { state: "valid"; report: InvestigationReport }
  | { state: "invalid"; message: string };

function parseStructuredReport(text: string, status: string): ReportParseResult {
  if (status === "submitted" || status === "streaming") {
    return { state: "pending" };
  }

  if (!text) {
    return { state: "empty" };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON output.";
    return { state: "invalid", message };
  }

  const parsedReport = investigationReportSchema.safeParse(parsedJson);
  if (!parsedReport.success) {
    const issues = parsedReport.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    return {
      state: "invalid",
      message: issues || "Output did not match the investigation report schema.",
    };
  }

  return { state: "valid", report: parsedReport.data };
}

function renderStringList(items: string[], emptyText: string) {
  if (items.length === 0) {
    return <p className="text-sm leading-6 text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item, idx) => (
        <li key={`item-${idx}`} className="text-sm leading-6 text-foreground/90">
          {item}
        </li>
      ))}
    </ul>
  );
}

const sourceLabels: Record<EvidenceFact["sourceType"], string> = {
  issue: "Issue",
  comment: "Comment",
  file: "File",
  repo: "Repo",
  search: "Search",
  api_error: "API Error",
};

function renderEvidenceFacts(facts: EvidenceFact[]) {
  if (facts.length === 0) {
    return <p className="text-sm leading-6 text-muted-foreground">No facts found.</p>;
  }

  return (
    <ul className="space-y-3">
      {facts.map((fact, idx) => (
        <li key={`fact-${idx}`} className="space-y-2 text-sm leading-6">
          <p className="text-foreground/90">{fact.text}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md border bg-muted px-2 py-1 font-medium text-muted-foreground">
              {sourceLabels[fact.sourceType]}
            </span>
            {fact.sourceUrl ? (
              <a
                href={fact.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-full items-center gap-1 rounded-md border bg-background px-2 py-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <span className="truncate">{fact.sourceLabel}</span>
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : (
              <span className="max-w-full truncate rounded-md border bg-background px-2 py-1 text-muted-foreground">
                {fact.sourceLabel}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function buildInvestigationPrompt(input: {
  issueUrl: string;
  owner: string;
  repo: string;
  issueNumber: string;
  issueBody: string;
  focusPath: string;
  ref: string;
}) {
  const block = [
    "[INVESTIGATION_CONTEXT]",
    `issue_url=${input.issueUrl.trim()}`,
    `owner=${input.owner.trim()}`,
    `repo=${input.repo.trim()}`,
    `issue_number=${input.issueNumber.trim()}`,
    `issue_body=${input.issueBody.trim().replace(/\n/g, "\\n")}`,
    `focus_path=${input.focusPath.trim()}`,
    `ref=${input.ref.trim()}`,
    "[/INVESTIGATION_CONTEXT]",
  ].join("\n");

  return `${block}

Please investigate this issue and provide facts, what to do, and a draft maintainer comment.`;
}

export function InvestigationConsole() {
  const [issueUrl, setIssueUrl] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [issueNumber, setIssueNumber] = useState("");
  const [issueBody, setIssueBody] = useState("");
  const [focusPath, setFocusPath] = useState("");
  const [ref, setRef] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/investigate",
    }),
  });

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  );
  const visibleOutput = useMemo(
    () =>
      latestAssistantMessage
        ? getVisibleText(
            latestAssistantMessage.parts as Array<{ type: string; text?: string }>,
          )
        : "",
    [latestAssistantMessage],
  );
  const reportResult = useMemo(
    () => parseStructuredReport(visibleOutput, status),
    [visibleOutput, status],
  );
  const draftComment =
    reportResult.state === "valid" ? reportResult.report.draftMaintainerComment : "";
  const isInvestigating = status === "submitted" || status === "streaming";

  async function copyDraftComment() {
    if (!draftComment) return;

    try {
      await navigator.clipboard.writeText(draftComment);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
      <form
        className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm lg:sticky lg:top-6 lg:self-start"
        onSubmit={(event) => {
          event.preventDefault();
          const prompt = buildInvestigationPrompt({
            issueUrl,
            owner,
            repo,
            issueNumber,
            issueBody,
            focusPath,
            ref,
          });
          sendMessage({ text: prompt });
        }}
      >
        <div className="space-y-2">
          <h2 className="text-balance text-xl font-semibold">Issue Input</h2>
          <p className="text-pretty text-sm leading-6 text-muted-foreground">
            Paste a GitHub issue URL or provide repository metadata manually.
            More context keeps the final answer focused.
          </p>
        </div>

        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Issue URL</span>
          <input
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            placeholder="https://github.com/owner/repo/issues/123"
            value={issueUrl}
            onChange={(event) => setIssueUrl(event.target.value)}
          />
        </label>

        <div className="rounded-lg border bg-muted/25">
          <button
            type="button"
            onClick={() => setShowAdvanced((previous) => !previous)}
            aria-expanded={showAdvanced}
            aria-controls="advanced-investigation-options"
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
          >
            <span>Advanced options</span>
            <span className="text-xs text-muted-foreground">
              {showAdvanced ? "Hide" : "Show"}
            </span>
          </button>

          {showAdvanced ? (
            <div id="advanced-investigation-options" className="space-y-4 border-t px-3 py-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Owner</span>
                  <input
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                    placeholder="vercel"
                    value={owner}
                    onChange={(event) => setOwner(event.target.value)}
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Repo</span>
                  <input
                    className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                    placeholder="next.js"
                    value={repo}
                    onChange={(event) => setRepo(event.target.value)}
                  />
                </label>
              </div>

              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Issue Number</span>
                <input
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                  placeholder="12345"
                  value={issueNumber}
                  onChange={(event) => setIssueNumber(event.target.value)}
                />
              </label>

              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Focus Path (optional)</span>
                <input
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                  placeholder="packages/next/src/server"
                  value={focusPath}
                  onChange={(event) => setFocusPath(event.target.value)}
                />
              </label>

              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Git Ref (optional)</span>
                <input
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                  placeholder="main"
                  value={ref}
                  onChange={(event) => setRef(event.target.value)}
                />
              </label>

              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Issue Body (optional)</span>
                <textarea
                  className="min-h-32 w-full rounded-lg border bg-background px-3 py-2.5 text-sm leading-6 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                  placeholder="Paste issue details if URL is unavailable."
                  value={issueBody}
                  onChange={(event) => setIssueBody(event.target.value)}
                />
              </label>
            </div>
          ) : null}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={isInvestigating}>
          {isInvestigating ? "Investigating..." : "Start Investigation"}
        </Button>

        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error.message || "An error occurred while investigating."}
          </p>
        ) : null}

        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
          Tip: provide both the issue URL and a focused path when available. This
          keeps the facts and next actions focused.
        </p>
      </form>

      <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm" aria-live="polite">
        <div className="space-y-2 border-b pb-4">
          <h2 className="text-balance text-xl font-semibold">Investigation Output</h2>
          <p className="text-pretty text-sm leading-6 text-muted-foreground">
            Short, structured findings with source-backed evidence.
          </p>
        </div>

        {reportResult.state === "valid" ? (
          <div className="grid gap-4">
            <article className="rounded-xl border bg-background/60 p-4 shadow-xs">
              <h3 className="mb-3 text-base font-semibold">Facts with Sources</h3>
              {renderEvidenceFacts(reportResult.report.facts)}
            </article>

            <article className="rounded-xl border bg-background/60 p-4 shadow-xs">
              <h3 className="mb-3 text-base font-semibold">Next Actions</h3>
              {renderStringList(reportResult.report.whatToDo, "No next action available.")}
            </article>

            <article className="rounded-xl border bg-background/60 p-4 shadow-xs">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-base font-semibold">Draft Maintainer Comment</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyDraftComment}
                  aria-label="Copy draft maintainer comment"
                >
                  {copyState === "copied" ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3.5" aria-hidden="true" />
                  )}
                  {copyState === "copied" ? "Copied" : "Copy draft"}
                </Button>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                {reportResult.report.draftMaintainerComment}
              </p>
              {copyState === "failed" ? (
                <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  Copy failed. Select the draft text and copy it manually.
                </p>
              ) : null}
            </article>
          </div>
        ) : reportResult.state === "invalid" ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <h3 className="text-base font-semibold text-destructive">
              Structured output validation failed
            </h3>
            <p className="mt-2 text-sm leading-6 text-destructive/90">
              {reportResult.message}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-muted/20 p-6">
            <p className="text-sm leading-6 text-muted-foreground">
              {reportResult.state === "pending"
                ? "Investigating... waiting for the structured report."
                : "No output yet. Submit an issue investigation from the left panel to generate facts, next actions, and a draft maintainer comment."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
