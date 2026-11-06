import { eq, and, ne } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { badRequest, getCurrentUser, hashPassword, unauthorized, verifyPassword } from "@/lib/auth";
import { isEmail } from "@/lib/core";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return Response.json({ user });
}

export async function PATCH(req: Request) {
  const me = await getCurrentUser();
  if (!me) return unauthorized();
  try {
    const body = (await req.json().catch(() => null)) as
      | { name?: string; email?: string; currentPassword?: string; newPassword?: string }
      | null;
    if (!body) return badRequest("Nothing to update.");

    const updates: { name?: string; email?: string; passwordHash?: string } = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (name.length < 2 || name.length > 60) return badRequest("Name must be 2–60 characters.");
      updates.name = name;
    }
    if (body.email !== undefined) {
      const email = body.email.trim().toLowerCase();
      if (!isEmail(email)) return badRequest("Enter a valid email address.");
      const taken = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email), ne(users.id, me.id)))
        .limit(1);
      if (taken.length > 0) return badRequest("That email is already in use.");
      updates.email = email;
    }
    if (body.newPassword !== undefined) {
      if (body.newPassword.length < 8) return badRequest("New password must be at least 8 characters.");
      const [row] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
      if (!row || !verifyPassword(body.currentPassword ?? "", row.passwordHash)) {
        return badRequest("Current password is incorrect.");
      }
      updates.passwordHash = hashPassword(body.newPassword);
    }
    if (Object.keys(updates).length === 0) return badRequest("Nothing to update.");

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, me.id))
      .returning({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt });
    return Response.json({ user: { ...updated, createdAt: updated.createdAt.toISOString() } });
  } catch (err) {
    console.error("profile update failed", err);
    return Response.json({ error: "Could not save changes. Please try again." }, { status: 500 });
  }
}