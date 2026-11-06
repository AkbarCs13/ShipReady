import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { memories } from "@/db/schema";
import { badRequest, getCurrentUser, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const rows = await db
    .select()
    .from(memories)
    .where(eq(memories.userId, user.id))
    .orderBy(desc(memories.createdAt))
    .limit(60);
  return Response.json({ memories: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = (await req.json().catch(() => null)) as { content?: string; kind?: string } | null;
    const content = body?.content?.trim() ?? "";
    if (content.length < 4 || content.length > 300) return badRequest("Memory must be 4–300 characters.");
    const kind = body?.kind === "preference" || body?.kind === "insight" ? body.kind : "fact";
    const [row] = await db
      .insert(memories)
      .values({ userId: user.id, kind, content, source: "manual" })
      .returning();
    return Response.json({ memory: row }, { status: 201 });
  } catch (err) {
    console.error("create memory failed", err);
    return Response.json({ error: "Could not save the memory." }, { status: 500 });
  }
}