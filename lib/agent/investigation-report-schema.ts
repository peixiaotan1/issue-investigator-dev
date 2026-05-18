import { z } from "zod";

export const evidenceSourceTypeSchema = z.enum([
  "issue",
  "comment",
  "file",
  "repo",
  "search",
  "api_error",
]);

export const evidenceFactSchema = z.object({
  text: z.string().min(1),
  sourceType: evidenceSourceTypeSchema,
  sourceLabel: z.string().min(1),
  sourceUrl: z.string(),
});

export const investigationReportSchema = z.object({
  schemaVersion: z.literal("1.2"),
  facts: z.array(evidenceFactSchema),
  whatToDo: z.array(z.string().min(1)).max(5),
  draftMaintainerComment: z.string().min(1),
});

export type EvidenceFact = z.infer<typeof evidenceFactSchema>;
export type InvestigationReport = z.infer<typeof investigationReportSchema>;
