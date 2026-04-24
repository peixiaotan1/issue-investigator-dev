"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";

function getVisibleText(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("\n")
    .trim();
}

const SECTION_ORDER = [
  "Facts Found",
  "Hypotheses",
  "Suggested Next Steps",
  "Draft Maintainer Comment",
] as const;

type SectionTitle = (typeof SECTION_ORDER)[number];

type ParsedSection = {
  title: SectionTitle;
  body: string;
};

function normalizeSectionTitle(rawTitle: string): SectionTitle | null {
  const lowered = rawTitle.trim().toLowerCase();
  if (lowered.startsWith("facts found")) return "Facts Found";
  if (lowered.startsWith("hypotheses")) return "Hypotheses";
  if (lowered.startsWith("suggested next steps")) return "Suggested Next Steps";
  if (lowered.startsWith("draft maintainer comment")) return "Draft Maintainer Comment";
  return null;
}

function parseSections(text: string): ParsedSection[] {
  const lines = text.split("\n");
  const sections: ParsedSection[] = [];

  let currentTitle: SectionTitle | null = null;
  let currentBody: string[] = [];

  const flushCurrent = () => {
    if (!currentTitle) return;
    sections.push({
      title: currentTitle,
      body: currentBody.join("\n").trim(),
    });
    currentBody = [];
  };

  for (const line of lines) {
    const maybeTitle = normalizeSectionTitle(line);
    if (maybeTitle) {
      flushCurrent();
      currentTitle = maybeTitle;
      continue;
    }
    if (currentTitle) {
      currentBody.push(line);
    }
  }

  flushCurrent();

  return SECTION_ORDER.map((title) => sections.find((section) => section.title === title)).filter(
    (section): section is ParsedSection => Boolean(section && section.body),
  );
}

function renderSectionBody(body: string) {
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
  const bulletLines = lines.filter((line) => line.startsWith("-") || /^\d+\)/.test(line));
  const isMostlyList = bulletLines.length > 0 && bulletLines.length >= Math.ceil(lines.length / 2);

  if (isMostlyList) {
    return (
      <ul className="space-y-2">
        {lines.map((line, idx) => {
          const normalized = line.replace(/^-+\s*/, "").replace(/^\d+\)\s*/, "");
          return (
            <li key={`line-${idx}`} className="text-sm leading-6 text-foreground/90">
              {normalized}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-3">
      {body
        .split("\n\n")
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph, idx) => (
          <p key={`paragraph-${idx}`} className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">
            {paragraph}
          </p>
        ))}
    </div>
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

Please investigate this issue and provide facts, hypotheses, next steps, and a draft maintainer comment.`;
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
  const parsedSections = useMemo(() => parseSections(visibleOutput), [visibleOutput]);

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
            More context means higher confidence in the final diagnosis.
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
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
          >
            <span>Advanced options</span>
            <span className="text-xs text-muted-foreground">
              {showAdvanced ? "Hide" : "Show"}
            </span>
          </button>

          {showAdvanced ? (
            <div className="space-y-4 border-t px-3 py-3">
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

        <Button type="submit" size="lg" className="w-full" disabled={status === "streaming"}>
          {status === "streaming" ? "Investigating..." : "Start Investigation"}
        </Button>

        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error.message || "An error occurred while investigating."}
          </p>
        ) : null}

        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
          Tip: provide both the issue URL and a focused path when available. This
          reduces noisy hypotheses and improves patch-level suggestions.
        </p>
      </form>

      <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="space-y-2 border-b pb-4">
          <h2 className="text-balance text-xl font-semibold">Investigation Output</h2>
          <p className="text-pretty text-sm leading-6 text-muted-foreground">
            Structured, readable findings grouped by investigation stage.
          </p>
        </div>

        {parsedSections.length > 0 ? (
          <div className="grid gap-4">
            {parsedSections.map((section) => (
              <article
                key={section.title}
                className="rounded-xl border bg-background/60 p-4 shadow-xs"
              >
                <h3 className="mb-3 text-base font-semibold tracking-tight">{section.title}</h3>
                {renderSectionBody(section.body)}
              </article>
            ))}
          </div>
        ) : visibleOutput ? (
          <div className="rounded-xl border bg-background/50 p-4">
            <p className="whitespace-pre-wrap text-pretty text-sm leading-6">
              {visibleOutput}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-muted/20 p-6">
            <p className="text-sm leading-6 text-muted-foreground">
              {status === "streaming"
                ? "Investigating... waiting for readable output."
                : "No output yet. Submit an issue investigation from the left panel to generate findings, hypotheses, and a draft maintainer comment."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
