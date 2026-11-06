import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { badRequest, getCurrentUser, unauthorized } from "@/lib/auth";
import { ENVIRONMENTS, FRAMEWORKS, PROJECT_STATUSES, REGIONS } from "@/lib/core";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(desc(projects.updatedAt));
  return Response.json({ projects: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 80) return badRequest("Project name must be 2–80 characters.");
    const repoUrl = typeof body?.repoUrl === "string" ? body.repoUrl.trim() : "";
    if (repoUrl && !/^https?:\/\/.+\..+/.test(repoUrl)) return badRequest("Repository URL must start with http(s)://");
    const environment = ENVIRONMENTS.includes(body?.environment as never) ? (body!.environment as string) : "production";
    const status = PROJECT_STATUSES.some((s) => s.id === body?.status) ? (body!.status as string) : "setup";
    const framework = FRAMEWORKS.includes(body?.framework as string) ? (body!.framework as string) : "Next.js";
    const region = REGIONS.some((r) => r.id === body?.region) ? (body!.region as string) : "iad1";
    const description = typeof body?.description === "string" ? body.description.trim().slice(0, 500) : "";

    const [row] = await db
      .insert(projects)
      .values({ userId: user.id, name, description, repoUrl, framework, environment, status, region })
      .returning();
    return Response.json({ project: row }, { status: 201 });
  } catch (err) {
    console.error("create project failed", err);
    return Response.json({ error: "Could not create the project." }, { status: 500 });
  }
}