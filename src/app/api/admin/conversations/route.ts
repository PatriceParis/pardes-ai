import { NextRequest } from "next/server";
import { getConversation, listConversationIds } from "@/lib/log";

export const runtime = "nodejs";

/**
 * GET /api/admin/conversations?token=...&id=<id>     -> single conversation as text/plain
 * GET /api/admin/conversations?token=...&list=1      -> JSON list of recent IDs
 * GET /api/admin/conversations?token=...             -> all conversations concatenated as text/plain
 *
 * Set ADMIN_TOKEN env var on Vercel; without it the endpoint always returns 403.
 */
export async function GET(req: NextRequest) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return new Response("ADMIN_TOKEN not configured", { status: 503 });
  }
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== adminToken) {
    return new Response("forbidden", { status: 403 });
  }

  const id = url.searchParams.get("id");
  if (id) {
    const text = await getConversation(id);
    if (!text) return new Response("not found", { status: 404 });
    return new Response(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const ids = await listConversationIds(500);

  if (url.searchParams.get("list")) {
    return Response.json({ count: ids.length, ids });
  }

  const parts: string[] = [];
  for (const cid of ids) {
    const t = await getConversation(cid);
    if (t) {
      parts.push(t, "\n========================================\n");
    }
  }
  return new Response(parts.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
