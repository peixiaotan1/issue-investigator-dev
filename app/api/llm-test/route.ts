import { generateText } from "ai";
import { getOpenAIProvider } from "@/lib/openai-provider";

export const maxDuration = 30;

/**
 * Quick LLM connectivity check (no GitHub session).
 * POST { "prompt": "optional" } or empty body.
 */
export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ ok: false, error: "OPENAI_API_KEY is not set." }, { status: 500 });
  }

  let prompt = "Reply with exactly one word: pong";
  try {
    const body = (await request.json()) as { prompt?: string };
    if (typeof body.prompt === "string" && body.prompt.trim()) {
      prompt = body.prompt.trim();
    }
  } catch {
    // empty body is fine
  }

  try {
    const openai = getOpenAIProvider();
    const { text } = await generateText({
      model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
      prompt,
    });

    return Response.json({
      ok: true,
      baseURL: process.env.OPENAI_BASE_URL ?? "(default OpenAI)",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        ok: false,
        baseURL: process.env.OPENAI_BASE_URL ?? "(default OpenAI)",
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        error: message,
      },
      { status: 502 },
    );
  }
}
