import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { deployments, projects } from "@/db/schema";
import { badRequest, getCurrentUser, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Lossless undo: re-inserts previously deleted rows with their original IDs and timestamps.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = (await req.json().catch(() => null)) as { rows?: Record<string, unknown>[] } | null;
    const rows = Array.isArray(body?.rows) ? body!.rows.slice(0, 100) : [];
    if (rows.length === 0) return badRequest("Nothing to restore.");
    const projectIds = [...new Set(rows.map((r) => String(r.projectId ?? "")))];
    const owned = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.userId, user.id), inArray(projects.id, projectIds)));
    const ownedSet = new Set(owned.map((p) => p.id));
    const values = rows
      .filter((r) => typeof r.id === "string" && ownedSet.has(String(r.projectId)) && typeof r.version === "string")
      .map((r) => ({
        id: r.id as string,
        userId: user.id,
        projectId: String(r.projectId),
        version: String(r.version).slice(0, 40),
        environment: String(r.environment ?? "production"),
        status: String(r.status ?? "queued"),
        commitSha: String(r.commitSha ?? ""),
        commitMessage: String(r.commitMessage ?? "").slice(0, 200),
        durationSec: typeof r.durationSec === "number" ? r.durationSec : null,
        triggeredBy: String(r.triggeredBy ?? user.name),
        createdAt: r.createdAt ? new Date(String(r.createdAt)) : new Date(),
      }));
    if (values.length === 0) return badRequest("Nothing to restore.");
    await db.insert(deployments).values(values).onConflictDoNothing();
    return Response.json({ ok: true, restored: values.length });
  } catch (err) {
    console.error("restore deployments failed", err);
    return Response.json({ error: "Could not restore the deployments." }, { status: 500 });
  }
}