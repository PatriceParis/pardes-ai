import Anthropic from "@anthropic-ai/sdk";
import { GUARDRAIL_PROMPT } from "./prompts";

const client = new Anthropic();

export type GuardrailResult = { onTopic: boolean; reason?: string };

/**
 * Check whether the user's latest message belongs to the Jewish-studies scope.
 *
 * `previousAssistant` is the immediately preceding assistant turn (if any).
 * Passing it lets short follow-ups like "oui", "pour enfants", "celui de
 * Breslev" be classified IN CONTEXT instead of being refused as off-topic
 * just because they're contextless in isolation.
 */
export async function checkOnTopic(
  message: string,
  previousAssistant?: string,
): Promise<GuardrailResult> {
  const model = process.env.ANTHROPIC_GUARDRAIL_MODEL ?? "claude-haiku-4-5-20251001";

  const userBlock = previousAssistant
    ? `[contexte — message assistant précédent, tronqué]\n${previousAssistant.slice(0, 600)}\n\n[message utilisateur à classer]\n${message}`
    : message;

  const res = await client.messages.create({
    model,
    max_tokens: 80,
    system: [
      {
        type: "text",
        text: GUARDRAIL_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userBlock }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  try {
    const parsed = JSON.parse(text) as {
      on_topic?: boolean;
      reason?: string;
    };
    if (typeof parsed.on_topic === "boolean") {
      return { onTopic: parsed.on_topic, reason: parsed.reason };
    }
  } catch {
    // fallthrough to permissive default
  }
  return { onTopic: true };
}
