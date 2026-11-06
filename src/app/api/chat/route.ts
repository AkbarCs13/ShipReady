import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { memories, messages, reflections } from "@/db/schema";
import { badRequest, getCurrentUser, unauthorized } from "@/lib/auth";
import { runCopilot } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = (await req.json().catch(() => null)) as { content?: string } | null;
    const content = body?.content?.trim() ?? "";
    if (!content) return badRequest("Type a message first.");
    if (content.length > 2000) return badRequest("Keep messages under 2,000 characters.");

    const historyRows = await db
      .select()
      .from(messages)
      .where(eq(messages.userId, user.id))
      .orderBy(asc(messages.createdAt));
    const history = historyRows
      .slice(-12)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const [userMsg] = await db
      .insert(messages)
      .values({ userId: user.id, role: "user", content, engine: null })
      .returning();

    // Explicit "remember:" commands are persisted deterministically, engine-independent.
    const rememberMatch = content.match(/^remember[:\s]+([\s\S]+)/i);
    let result;
    if (rememberMatch) {
      const fact = rememberMatch[1].trim().slice(0, 300);
      const [mem] = await db
        .insert(memories)
        .values({ userId: user.id, kind: "fact", content: fact, source: "manual" })
        .returning();
      result = {
        reply: `Pinned to long-term memory: **${fact}**\n\nIt's stored in Postgres, so I'll recall it in every future session — even after a redeploy.`,
        engine: "local" as const,
        reflection: {
          summary: "Persisted an explicit user fact to long-term memory instead of relying on the chat window.",
          lesson: "Facts the user explicitly pins should be surfaced proactively when relevant topics come up.",
          score: 93,
        },
        memoryCandidates: [] as { kind: "fact" | "preference" | "insight"; content: string }[],
        notice: undefined as string | undefined,
        preSavedMemories: [mem],
      };
    } else {
      result = { ...(await runCopilot(user.id, content, history)), preSavedMemories: [] as typeof memories.$inferSelect[] };
    }

    const [assistantMsg] = await db
      .insert(messages)
      .values({ userId: user.id, role: "assistant", content: result.reply, engine: result.engine })
      .returning();

    const [reflection] = await db
      .insert(reflections)
      .values({
        userId: user.id,
        messageId: assistantMsg.id,
        summary: result.reflection.summary,
        lesson: result.reflection.lesson,
        score: result.reflection.score,
        engine: result.engine,
      })
      .returning();

    // De-duplicate memory candidates against everything already stored.
    const existing = await db.select().from(memories).where(eq(memories.userId, user.id)).orderBy(desc(memories.createdAt));
    const newMemories: typeof memories.$inferSelect[] = [...result.preSavedMemories];
    for (const cand of result.memoryCandidates) {
      const norm = cand.content.toLowerCase();
      const dup = existing.some(
        (m) => m.content.toLowerCase().includes(norm) || norm.includes(m.content.toLowerCase())
      );
      if (!dup) {
        const [mem] = await db
          .insert(memories)
          .values({ userId: user.id, kind: cand.kind, content: cand.content, source: "auto" })
          .returning();
        newMemories.push(mem);
        existing.unshift(mem);
      }
    }
    // Cap auto memory growth at 60 entries per user.
    if (existing.length > 60) {
      const overflow = existing.slice(60).filter((m) => m.source === "auto");
      for (const m of overflow) {
        await db.delete(memories).where(eq(memories.id, m.id));
      }
    }

    return Response.json({
      userMessage: userMsg,
      message: assistantMsg,
      reflection,
      newMemories,
      notice: result.notice ?? null,
    });
  } catch (err) {
    console.error("chat failed", err);
    return Response.json({ error: "The copilot hit an unexpected error. Please try again." }, { status: 500 });
  }
}