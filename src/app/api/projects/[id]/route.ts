import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { badRequest, getCurrentUser, notFound, unauthorized } from "@/lib/auth";
import { ENVIRONMENTS, FRAMEWORKS, PROJECT_STATUSES, REGIONS } from "@/lib/core";

export const dynamic = "force-dynamic";

async function owned(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const row = await owned(id, user.id);
  if (!row) return notFound("Project not found.");
  return Response.json({ project: row });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const row = await owned(id, user.id);
  if (!row) return notFound("Project not found.");
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return badRequest("Nothing to update.");
    const updates: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (name.length < 2 || name.length > 80) return badRequest("Project name must be 2–80 characters.");
      updates.name = name;
    }
    if (typeof body.description === "string") updates.description = body.description.trim().slice(0, 500);
    if (typeof body.repoUrl === "string") {
      const url = body.repoUrl.trim();
      if (url && !/^https?:\/\/.+\..+/.test(url)) return badRequest("Repository URL must start with http(s)://");
      updates.repoUrl = url;
    }
    if (ENVIRONMENTS.includes(body.environment as never)) updates.environment = body.environment as string;
    if (PROJECT_STATUSES.some((s) => s.id === body.status)) updates.status = body.status as string;
    if (FRAMEWORKS.includes(body.framework as string)) updates.framework = body.framework as string;
    if (REGIONS.some((r) => r.id === body.region)) updates.region = body.region as string;

    const [updated] = await db.update(projects).set(updates).where(eq(projects.id, id)).returning();
    return Response.json({ project: updated });
  } catch (err) {
    console.error("update project failed", err);
    return Response.json({ error: "Could not save the project." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const row = await owned(id, user.id);
  if (!row) return notFound("Project not found.");
  await db.delete(projects).where(eq(projects.id, id));
  return Response.json({ ok: true, id });
}