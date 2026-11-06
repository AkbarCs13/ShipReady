import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { badRequest, getCurrentUser, notFound, unauthorized } from "@/lib/auth";
import { CATEGORIES, PRIORITIES } from "@/lib/core";

export const dynamic = "force-dynamic";

async function owned(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const row = await owned(id, user.id);
  if (!row) return notFound("Task not found.");
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return badRequest("Nothing to update.");
    const updates: Partial<typeof tasks.$inferInsert> = {};
    if (typeof body.done === "boolean") updates.done = body.done;
    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (title.length < 3 || title.length > 160) return badRequest("Task title must be 3–160 characters.");
      updates.title = title;
    }
    if (typeof body.notes === "string") updates.notes = body.notes.trim().slice(0, 400);
    if (PRIORITIES.some((p) => p.id === body.priority)) updates.priority = body.priority as string;
    if (CATEGORIES.some((c) => c.id === body.category)) updates.category = body.category as string;
    if (Object.keys(updates).length === 0) return badRequest("Nothing to update.");
    const [updated] = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();
    return Response.json({ task: updated });
  } catch (err) {
    console.error("update task failed", err);
    return Response.json({ error: "Could not update the task." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const row = await owned(id, user.id);
  if (!row) return notFound("Task not found.");
  await db.delete(tasks).where(eq(tasks.id, id));
  return Response.json({ ok: true, id });
}