import { Redis } from "@upstash/redis";

export type LogSource = {
  corpus: string;
  livre: string;
  chapitre: string | null;
  page: number | null;
};

export type LogTurn = {
  role: "user" | "assistant";
  content: string;
  sources?: LogSource[];
};

let cached: Redis | null = null;
function getRedis(): Redis | null {
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  cached = new Redis({ url, token });
  return cached;
}

const KEY_INDEX = "conversations:index";
const KEY_PREFIX = "conversations:";

export async function logConversation(
  conversationId: string,
  messages: LogTurn[],
): Promise<void> {
  if (!conversationId || !messages.length) return;
  const redis = getRedis();
  if (!redis) {
    console.warn("[log] UPSTASH_REDIS_REST_URL/TOKEN missing");
    return;
  }

  const text = formatConversation(conversationId, messages);
  const key = `${KEY_PREFIX}${conversationId}`;

  try {
    await Promise.all([
      redis.set(key, text),
      redis.zadd(KEY_INDEX, {
        score: Date.now(),
        member: conversationId,
      }),
    ]);
    console.log(`[log] redis OK ${key} (${text.length} chars)`);
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.error(`[log] redis FAILED ${key} | ${msg}`);
  }
}

export function formatConversation(id: string, messages: LogTurn[]): string {
  const lines: string[] = [];
  lines.push(`Conversation: ${id}`);
  lines.push(`Updated: ${new Date().toISOString()}`);
  lines.push(`Turns: ${messages.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  for (const m of messages) {
    lines.push(`### ${m.role === "user" ? "USER" : "ASSISTANT"}`);
    lines.push("");
    lines.push(m.content.trim());
    if (m.sources?.length) {
      lines.push("");
      lines.push("Sources:");
      for (const s of m.sources) {
        const ref = [
          s.corpus,
          s.livre,
          s.chapitre ?? null,
          s.page ? `p.${s.page}` : null,
        ]
          .filter(Boolean)
          .join(" — ");
        lines.push(`  - ${ref}`);
      }
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

export async function listConversationIds(limit = 100): Promise<string[]> {
  const redis = getRedis();
  if (!redis) return [];
  const ids = await redis.zrange<string[]>(KEY_INDEX, 0, limit - 1, {
    rev: true,
  });
  return ids;
}

export async function getConversation(id: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  return redis.get<string>(`${KEY_PREFIX}${id}`);
}
