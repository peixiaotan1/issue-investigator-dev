import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createGitHubClient } from "@/lib/github/client";
import { getOpenAIProvider } from "@/lib/openai-provider";
import {
  createInvestigationSystemPrompt,
  createInvestigationTools,
  extractContextFromUserMessage,
} from "@/lib/agent/investigate";

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
  const tools = createInvestigationTools(octokit);

  const openai = getOpenAIProvider();
  const result = streamText({
    model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
    system: createInvestigationSystemPrompt(context),
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(20),
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      if (error instanceof Error) {
        return `Investigation failed: ${error.message}`;
      }
      return "Investigation failed due to an unknown server error.";
    },
  });
}
