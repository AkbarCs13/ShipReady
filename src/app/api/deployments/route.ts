import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { deployments, projects } from "@/db/schema";
import { badRequest, getCurrentUser, unauthorized } from "@/lib/auth";
import { DEPLOY_STATUSES, ENVIRONMENTS, randomSha } from "@/lib/core";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const rows = await db
    .select()
    .from(deployments)
    .where(eq(deployments.userId, user.id))
    .orderBy(desc(deployments.createdAt))
    .limit(300);
  return Response.json({ deployments: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const projectId = typeof body?.projectId === "string" ? body.projectId : "";
    const version = typeof body?.version === "string" ? body.version.trim() : "";
    if (!projectId) return badRequest("Choose a project for this deployment.");
    if (!version || version.length > 40) return badRequest("Version tag is required (e.g. v1.4.2).");
    const [proj] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
      .limit(1);
    if (!proj) return badRequest("That project doesn't exist in your workspace.");

    const environment = ENVIRONMENTS.includes(body?.environment as never) ? (body!.environment as string) : "production";
    const status = DEPLOY_STATUSES.some((s) => s.id === body?.status) ? (body!.status as string) : "queued";
    const commitMessage = typeof body?.commitMessage === "string" ? body.commitMessage.trim().slice(0, 200) : "";
    const commitSha =
      typeof body?.commitSha === "string" && /^[0-9a-f]{7,40}$/i.test(body.commitSha.trim())
        ? body.commitSha.trim().toLowerCase()
        : randomSha();
    const durationSec =
      typeof body?.durationSec === "number" && body.durationSec >= 0 ? Math.round(body.durationSec) : null;

    const [row] = await db
      .insert(deployments)
      .values({
        userId: user.id,
        projectId,
        version,
        environment,
        status,
        commitSha,
        commitMessage,
        durationSec,
        triggeredBy: user.name,
      })
      .returning();
    return Response.json({ deployment: row }, { status: 201 });
  } catch (err) {
    console.error("create deployment failed", err);
    return Response.json({ error: "Could not log the deployment." }, { status: 500 });
  }
}