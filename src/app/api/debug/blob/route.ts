import { put } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const tokenPrefix = token?.slice(0, 30) ?? null;
  const tokenLength = token?.length ?? 0;

  let put_public: { ok: boolean; result?: unknown; error?: string };
  try {
    const result = await put("debug/test-public.txt", "hello-public", {
      access: "public",
    });
    put_public = { ok: true, result };
  } catch (e) {
    put_public = {
      ok: false,
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    };
  }

  return Response.json({ tokenPrefix, tokenLength, put_public });
}
