import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { anthropic } from "@/lib/anthropic";
import { messageErreurFr } from "@/lib/errors";
import { checkOnTopic } from "@/lib/guardrail";
import { logConversation, type LogTurn } from "@/lib/log";
import { SYSTEM_PROMPT, REFUSAL_MESSAGE_FR } from "@/lib/prompts";
import { retrieve, formatSourcesBlock, type Source } from "@/lib/retrieval";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const { conversationId, messages } = (await req.json()) as {
    conversationId?: string;
    messages: ChatMessage[];
  };

  console.log(
    `[chat] received conversationId=${JSON.stringify(conversationId)} messages=${messages?.length ?? 0}`,
  );

  if (!messages?.length || messages[messages.length - 1].role !== "user") {
    return new Response("Invalid messages", { status: 400 });
  }

  const lastUser = messages[messages.length - 1].content;
  // Pass the previous assistant turn so the guardrail can judge short
  // follow-ups ("oui", "pour enfants", "celui de Breslev"…) in context
  // rather than refusing them as off-topic in isolation.
  const previousAssistant = [...messages]
    .slice(0, -1)
    .reverse()
    .find((m) => m.role === "assistant")?.content;

  // Le garde-fou ne doit jamais faire tomber la requête : s'il échoue, on
  // laisse passer (même défaut permissif que checkOnTopic quand le JSON est
  // illisible). Une panne globale — crédit épuisé, clé invalide — sera de
  // toute façon rattrapée plus bas et affichée en clair à l'utilisateur.
  let guard: Awaited<ReturnType<typeof checkOnTopic>>;
  try {
    guard = await checkOnTopic(lastUser, previousAssistant);
  } catch (e) {
    console.error("[chat] guardrail failed, laissé passer:", e);
    guard = { onTopic: true };
  }

  if (!guard.onTopic) {
    if (conversationId) {
      // Await directly: streamRefusal will be called after this returns,
      // and a few hundred ms of extra latency is fine for a refusal path.
      await logConversation(conversationId, [
        ...messagesToLog(messages),
        { role: "assistant", content: REFUSAL_MESSAGE_FR },
      ]);
    }
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

  let stream: ReturnType<Anthropic["messages"]["stream"]>;
  try {
    stream = anthropic().messages.stream({
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
  } catch (e) {
    // Clé absente, modèle invalide… : rien n'a encore été envoyé au client,
    // on répond en flux avec une phrase lisible plutôt qu'un 500 muet.
    console.error("[chat] ouverture du flux impossible:", e);
    return streamMessage(messageErreurFr(e));
  }

  const encoder = new TextEncoder();
  let assistantText = "";
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
            assistantText += event.delta.text;
            controller.enqueue(
              encoder.encode(
                `event: token\ndata: ${JSON.stringify(event.delta.text)}\n\n`,
              ),
            );
          }
        }
        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
      } catch (e) {
        // Le flux a déjà commencé (statut 200 envoyé) : le seul moyen de
        // prévenir l'utilisateur est un évènement `error` porteur d'un
        // message en clair, que le client affiche tel quel.
        console.error("[chat] flux interrompu:", e);
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify(messageErreurFr(e))}\n\n`,
          ),
        );
      } finally {
        console.log(
          `[chat] finally entered: conversationId=${JSON.stringify(conversationId)} assistantText=${assistantText.length}chars`,
        );
        // Write log BEFORE closing the stream so the lambda stays alive.
        // The "done" event has already been emitted; the client just waits
        // for the connection to close (~200-800 ms extra latency, invisible).
        if (conversationId && assistantText) {
          try {
            await logConversation(conversationId, [
              ...messagesToLog(messages),
              {
                role: "assistant",
                content: assistantText,
                sources: sources.map((s) => ({
                  corpus: s.corpus,
                  livre: s.livre,
                  chapitre: s.chapitre,
                  page: s.page,
                })),
              },
            ]);
          } catch (e) {
            console.error("[log] inline logConversation crashed:", e);
          }
        }
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

function messagesToLog(messages: ChatMessage[]): LogTurn[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

/** Envoie un texte unique comme s'il avait été streamé, puis clôt le flux. */
function streamMessage(text: string) {
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

function streamRefusal(text: string) {
  return streamMessage(text);
}
