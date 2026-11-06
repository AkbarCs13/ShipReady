import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword, badRequest } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";
import { isEmail } from "@/lib/core";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await ensureSeeded().catch(() => {});
    const body = (await req.json().catch(() => null)) as
      | { name?: string; email?: string; password?: string }
      | null;
    const name = body?.name?.trim() ?? "";
    const email = body?.email?.trim().toLowerCase() ?? "";
    const password = body?.password ?? "";
    if (name.length < 2 || name.length > 60) return badRequest("Name must be 2–60 characters.");
    if (!isEmail(email)) return badRequest("Enter a valid email address.");
    if (password.length < 8) return badRequest("Password must be at least 8 characters.");

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) return badRequest("An account with that email already exists. Try signing in.");

    const [user] = await db
      .insert(users)
      .values({ name, email, passwordHash: hashPassword(password) })
      .returning({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt });
    await createSession(user.id);
    return Response.json({ user: { ...user, createdAt: user.createdAt.toISOString() } }, { status: 201 });
  } catch (err) {
    console.error("register failed", err);
    return Response.json({ error: "Could not create the account. Please try again." }, { status: 500 });
  }
}