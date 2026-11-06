import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, verifyPassword, badRequest } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await ensureSeeded().catch(() => {});
    const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null;
    const email = body?.email?.trim().toLowerCase() ?? "";
    const password = body?.password ?? "";
    if (!email || !password) return badRequest("Email and password are required.");

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return Response.json({ error: "Incorrect email or password." }, { status: 401 });
    }
    await createSession(user.id);
    return Response.json({
      user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt.toISOString() },
    });
  } catch (err) {
    console.error("login failed", err);
    return Response.json({ error: "Sign-in is temporarily unavailable. Please try again." }, { status: 500 });
  }
}