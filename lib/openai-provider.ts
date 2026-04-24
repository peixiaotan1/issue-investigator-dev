import { createOpenAI } from "@ai-sdk/openai";

let provider: ReturnType<typeof createOpenAI> | null = null;

export function getOpenAIProvider() {
  if (provider) return provider;

  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  provider = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    ...(baseURL ? { baseURL } : {}),
  });

  return provider;
}
