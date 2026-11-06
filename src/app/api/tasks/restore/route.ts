import { db } from "@/db";
import { tasks } from "@/db/schema";
import { badRequest, getCurrentUser, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = (await req.json().catch(() => null)) as { rows?: Record<string, unknown>[] } | null;
    const rows = Array.isArray(body?.rows) ? body!.rows.slice(0, 100) : [];
    const values = rows
      .filter((r) => typeof r.id === "string" && typeof r.title === "string")
      .map((r) => ({
        id: r.id as string,
        userId: user.id,
        category: String(r.category ?? "deployment"),
        title: String(r.title).slice(0, 160),
        notes: String(r.notes ?? "").slice(0, 400),
        done: Boolean(r.done),
        priority: String(r.priority ?? "medium"),
        position: typeof r.position === "number" ? r.position : 0,
        createdAt: r.createdAt ? new Date(String(r.createdAt)) : new Date(),
      }));
    if (values.length === 0) return badRequest("Nothing to restore.");
    await db.insert(tasks).values(values).onConflictDoNothing();
    return Response.json({ ok: true, restored: values.length });
  } catch (err) {
    console.error("restore tasks failed", err);
    return Response.json({ error: "Could not restore the tasks." }, { status: 500 });
  }
}