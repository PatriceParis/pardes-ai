import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { checkOnTopic } from "@/lib/guardrail";
import { SYSTEM_PROMPT, REFUSAL_MESSAGE_FR } from "@/lib/prompts";
import { retrieve, formatSourcesBlock, type Source } from "@/lib/retrieval";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { messages } = (await req.json()) as { messages: ChatMessage[] };

  if (!messages?.length || messages[messages.length - 1].role !== "user") {
    return new Response("Invalid messages", { status: 400 });
  }

  const lastUser = messages[messages.length - 1].content;

  const guard = await checkOnTopic(lastUser);
  if (!guard.onTopic) {
    return streamRefusal(REFUSAL_MESSAGE_FR);
  }

  let sources: Source[] = [];
  try {
    sources = await retrieve(lastUser, 8);
  } catch (e) {
    console.error("retrieval failed", e);
  }

  const sourcesBlock = formatSourcesBlock(sources);
  const augmentedMessages: Anthropic.MessageParam[] = messages.map((m, i) => {
    if (i === messages.length - 1 && sourcesBlock) {
      return {
        role: m.role,
        content: `${sourcesBlock}\n\n${m.content}`,
      };
    }
    return { role: m.role, content: m.content };
  });

  const model = process.env.ANTHROPIC_MAIN_MODEL ?? "claude-sonnet-4-6";

  const stream = await client.messages.stream({
    model,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: augmentedMessages,
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      if (sources.length) {
        controller.enqueue(
          encoder.encode(
            `event: sources\ndata: ${JSON.stringify(
              sources.map(({ text: _t, ...s }) => s),
            )}\n\n`,
          ),
        );
      }
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(
                `event: token\ndata: ${JSON.stringify(event.delta.text)}\n\n`,
              ),
            );
          }
        }
        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify(String(e))}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function streamRefusal(text: string) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: token\ndata: ${JSON.stringify(text)}\n\nevent: done\ndata: {}\n\n`,
        ),
      );
      controller.close();
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
