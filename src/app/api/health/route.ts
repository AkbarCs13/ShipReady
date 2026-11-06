import { db } from "@/db";
import { sql } from "drizzle-orm";
import { openaiConfigured, OPENAI_MODEL } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  let database = false;
  try {
    await db.execute(sql`select 1`);
    database = true;
  } catch {
    database = false;
  }
  return Response.json(
    {
      ok: database,
      database: database ? "up" : "down",
      ai: openaiConfigured() ? "configured" : "not_configured",
      model: openaiConfigured() ? OPENAI_MODEL : null,
      time: new Date().toISOString(),
    },
    { status: database ? 200 : 500 }
  );
}