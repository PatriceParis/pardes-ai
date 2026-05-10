import { put } from "@vercel/blob";
import { promises as fs } from "node:fs";
import path from "node:path";

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

export async function logConversation(
  conversationId: string,
  messages: LogTurn[],
): Promise<void> {
  if (!conversationId || !messages.length) return;
  const text = formatConversation(conversationId, messages);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    // Public Vercel Blob store. URLs include an unguessable per-store token
    // in the hostname, so blobs are not enumerable from the outside —
    // effectively private for our use case (only the project owner browses
    // them via the Vercel dashboard).
    const path = `conversations/${conversationId}.txt`;
    try {
      const result = await put(path, text, {
        access: "public",
        contentType: "text/plain; charset=utf-8",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      console.log(`[log] put OK: ${result.url}`);
      return;
    } catch (e) {
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      console.error(`[log] put FAILED ${path} | ${msg}`);
    }
  } else {
    console.warn("[log] BLOB_READ_WRITE_TOKEN missing");
  }

  if (process.env.NODE_ENV !== "production") {
    try {
      const dir = path.join(process.cwd(), "logs", "conversations");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, `${conversationId}.txt`), text, "utf8");
    } catch (e) {
      console.error("[log] local write failed", e);
    }
  }
}

function formatConversation(id: string, messages: LogTurn[]): string {
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
