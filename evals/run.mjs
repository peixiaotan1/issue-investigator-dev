import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");

const evidenceFactSchema = z.object({
  text: z.string().min(1),
  sourceType: z.enum(["issue", "comment", "file", "repo", "search", "api_error"]),
  sourceLabel: z.string().min(1),
  sourceUrl: z.string(),
});

const investigationReportSchema = z.object({
  schemaVersion: z.literal("1.2"),
  facts: z.array(evidenceFactSchema),
  whatToDo: z.array(z.string().min(1)).max(5),
  draftMaintainerComment: z.string().min(1),
});

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasMarkdownFence(value) {
  return typeof value === "string" && value.includes("```");
}

function validateReport(report, label) {
  const parsed = investigationReportSchema.safeParse(report);
  assert(parsed.success, `${label}: report must match schemaVersion 1.2`);
  assert(!hasMarkdownFence(parsed.data.draftMaintainerComment), `${label}: draft must not use markdown fences`);

  for (const fact of parsed.data.facts) {
    assert(fact.sourceType, `${label}: fact is missing sourceType`);
    assert(fact.sourceLabel, `${label}: fact is missing sourceLabel`);
    assert(typeof fact.sourceUrl === "string", `${label}: fact is missing sourceUrl`);
    assert(!hasMarkdownFence(fact.text), `${label}: fact text must not use markdown fences`);
  }
}

const files = (await readdir(fixturesDir)).filter((file) => file.endsWith(".json")).sort();
const results = [];

for (const file of files) {
  const raw = await readFile(path.join(fixturesDir, file), "utf8");
  const report = JSON.parse(raw);
  validateReport(report, file);
  results.push({ name: file, ok: true });
}

const missingSource = {
  schemaVersion: "1.2",
  facts: [{ text: "A fact without a source is not evidence." }],
  whatToDo: ["Add a source."],
  draftMaintainerComment: "This should fail.",
};

assert(
  !investigationReportSchema.safeParse(missingSource).success,
  "negative: missing source metadata must fail",
);

const fencedOutput = "```json\n{\"schemaVersion\":\"1.2\"}\n```";
assert(hasMarkdownFence(fencedOutput), "negative: markdown fence detector must catch fenced output");

console.log(`Evidence report eval passed: ${results.length} fixtures + 2 negative checks.`);
