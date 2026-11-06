import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { memories, messages, reflections } from "@/db/schema";
import { getCurrentUser, unauthorized } from "@/lib/auth";
import { openaiConfigured, OPENAI_MODEL } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const [msgs, mems, refs] = await Promise.all([
    db.select().from(messages).where(eq(messages.userId, user.id)).orderBy(asc(messages.createdAt)).limit(200),
    db.select().from(memories).where(eq(memories.userId, user.id)).orderBy(desc(memories.createdAt)).limit(60),
    db.select().from(reflections).where(eq(reflections.userId, user.id)).orderBy(desc(reflections.createdAt)).limit(40),
  ]);
  return Response.json({
    messages: msgs,
    memories: mems,
    reflections: refs,
    ai: { configured: openaiConfigured(), model: openaiConfigured() ? OPENAI_MODEL : null },
  });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  await db.delete(messages).where(eq(messages.userId, user.id));
  return Response.json({ ok: true });
}