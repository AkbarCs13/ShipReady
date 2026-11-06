import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { badRequest, getCurrentUser, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = (await req.json().catch(() => null)) as { orderedIds?: unknown } | null;
    const orderedIds = Array.isArray(body?.orderedIds)
      ? (body!.orderedIds as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    if (orderedIds.length < 2 || orderedIds.length > 100) return badRequest("Send 2–100 task IDs to reorder.");
    const ownedRows = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.userId, user.id), inArray(tasks.id, orderedIds)));
    if (ownedRows.length !== orderedIds.length) return badRequest("Some tasks were not found in your workspace.");
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(tasks).set({ position: i }).where(eq(tasks.id, orderedIds[i]));
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("reorder failed", err);
    return Response.json({ error: "Could not save the new order." }, { status: 500 });
  }
}