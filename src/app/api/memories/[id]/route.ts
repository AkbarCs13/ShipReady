import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { memories } from "@/db/schema";
import { getCurrentUser, notFound, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const [row] = await db
    .select()
    .from(memories)
    .where(and(eq(memories.id, id), eq(memories.userId, user.id)))
    .limit(1);
  if (!row) return notFound("Memory not found.");
  await db.delete(memories).where(eq(memories.id, id));
  return Response.json({ ok: true, id });
}