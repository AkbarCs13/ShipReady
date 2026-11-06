import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { deployments } from "@/db/schema";
import { badRequest, getCurrentUser, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
    const ids = Array.isArray(body?.ids) ? (body!.ids as unknown[]).filter((x): x is string => typeof x === "string") : [];
    if (ids.length === 0) return badRequest("No deployments selected.");
    if (ids.length > 100) return badRequest("Select at most 100 deployments at once.");
    const deleted = await db
      .delete(deployments)
      .where(and(eq(deployments.userId, user.id), inArray(deployments.id, ids)))
      .returning({ id: deployments.id });
    return Response.json({ ok: true, deleted: deleted.map((d) => d.id) });
  } catch (err) {
    console.error("bulk delete failed", err);
    return Response.json({ error: "Could not delete the selected deployments." }, { status: 500 });
  }
}