import { getCurrentUser, unauthorized } from "@/lib/auth";
import { resetWorkspace } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    await resetWorkspace(user.id, user.name);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("demo reset failed", err);
    return Response.json({ error: "Could not reload the demo workspace." }, { status: 500 });
  }
}