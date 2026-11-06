import { destroySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await destroySession();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true });
  }
}