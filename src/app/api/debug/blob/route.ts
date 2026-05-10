import { put } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET() {
  const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  const tokenPrefix = process.env.BLOB_READ_WRITE_TOKEN?.slice(0, 12) ?? null;

  const attempts: Array<{ label: string; ok: boolean; result?: unknown; error?: string }> = [];

  // Attempt 1: minimal options (private access only)
  try {
    const result = await put("debug/test-min.txt", "hello", {
      access: "private" as "public",
    });
    attempts.push({ label: "minimal { access: 'private' }", ok: true, result });
  } catch (e) {
    attempts.push({
      label: "minimal { access: 'private' }",
      ok: false,
      error: e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : String(e),
    });
  }

  // Attempt 2: with addRandomSuffix true (default)
  try {
    const result = await put("debug/test-random.txt", "hello-random", {
      access: "private" as "public",
      addRandomSuffix: true,
    });
    attempts.push({ label: "{ access: 'private', addRandomSuffix: true }", ok: true, result });
  } catch (e) {
    attempts.push({
      label: "{ access: 'private', addRandomSuffix: true }",
      ok: false,
      error: e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : String(e),
    });
  }

  // Attempt 3: access: "public"
  try {
    const result = await put("debug/test-public.txt", "hello-public", {
      access: "public",
    });
    attempts.push({ label: "{ access: 'public' }", ok: true, result });
  } catch (e) {
    attempts.push({
      label: "{ access: 'public' }",
      ok: false,
      error: e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : String(e),
    });
  }

  return Response.json(
    {
      hasToken,
      tokenPrefix,
      attempts,
    },
    { status: 200 },
  );
}
