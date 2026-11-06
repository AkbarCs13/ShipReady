import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { badRequest, getCurrentUser, unauthorized } from "@/lib/auth";
import { CATEGORIES, PRIORITIES } from "@/lib/core";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, user.id))
    .orderBy(asc(tasks.category), asc(tasks.position), asc(tasks.createdAt));
  return Response.json({ tasks: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (title.length < 3 || title.length > 160) return badRequest("Task title must be 3–160 characters.");
    const category = CATEGORIES.some((c) => c.id === body?.category) ? (body!.category as string) : "deployment";
    const priority = PRIORITIES.some((p) => p.id === body?.priority) ? (body!.priority as string) : "medium";
    const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 400) : "";

    const siblings = await db
      .select({ position: tasks.position })
      .from(tasks)
      .where(eq(tasks.userId, user.id));
    const position = siblings.length ? Math.max(-1, ...siblings.map((s) => s.position)) + 1 : 0;

    const [row] = await db
      .insert(tasks)
      .values({ userId: user.id, title, category, priority, notes, position })
      .returning();
    return Response.json({ task: row }, { status: 201 });
  } catch (err) {
    console.error("create task failed", err);
    return Response.json({ error: "Could not add the task." }, { status: 500 });
  }
}