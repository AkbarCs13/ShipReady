import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { deployments } from "@/db/schema";
import { badRequest, getCurrentUser, notFound, unauthorized } from "@/lib/auth";
import { DEPLOY_STATUSES, ENVIRONMENTS } from "@/lib/core";

export const dynamic = "force-dynamic";

async function owned(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(deployments)
    .where(and(eq(deployments.id, id), eq(deployments.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const row = await owned(id, user.id);
  if (!row) return notFound("Deployment not found.");
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return badRequest("Nothing to update.");
    const updates: Partial<typeof deployments.$inferInsert> = {};
    if (DEPLOY_STATUSES.some((s) => s.id === body.status)) {
      updates.status = body.status as string;
      if (body.status === "live" && row.durationSec === null) {
        updates.durationSec = Math.min(86_400, Math.max(30, Math.round((Date.now() - row.createdAt.getTime()) / 1000)));
      }
    }
    if (typeof body.version === "string" && body.version.trim()) updates.version = body.version.trim().slice(0, 40);
    if (ENVIRONMENTS.includes(body.environment as never)) updates.environment = body.environment as string;
    if (typeof body.commitMessage === "string") updates.commitMessage = body.commitMessage.trim().slice(0, 200);
    if (typeof body.durationSec === "number" && body.durationSec >= 0) updates.durationSec = Math.round(body.durationSec);
    if (Object.keys(updates).length === 0) return badRequest("Nothing to update.");
    const [updated] = await db.update(deployments).set(updates).where(eq(deployments.id, id)).returning();
    return Response.json({ deployment: updated });
  } catch (err) {
    console.error("update deployment failed", err);
    return Response.json({ error: "Could not update the deployment." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const row = await owned(id, user.id);
  if (!row) return notFound("Deployment not found.");
  await db.delete(deployments).where(eq(deployments.id, id));
  return Response.json({ ok: true, id });
}