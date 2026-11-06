export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { ensureSeeded } = await import("@/db/seed");
    await ensureSeeded();
  } catch (err) {
    // Tables may not exist yet on a fresh database — run `npx drizzle-kit push` first.
    console.warn("[shipready] Auto-seed skipped:", err instanceof Error ? err.message : err);
  }
}