"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, errMsg, useFetch } from "@/lib/client";
import { cx, timeAgo, type Memory, type Message, type Reflection } from "@/lib/core";
import { Button, Confirm, ErrorState, Icon, PageHead, Skeleton } from "@/components/ui";
import { useToast } from "@/components/toast";

interface Bundle {
  messages: Message[];
  memories: Memory[];
  reflections: Reflection[];
  ai: { configured: boolean; model: string | null };
}

/* Minimal, safe inline formatting: **bold**, `code`, _em_ and "- " bullets. */
function formatInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i}>{p.slice(1, -1)}</code>;
    if (p.startsWith("_") && p.endsWith("_") && p.length > 2) return <em key={i} className="text-[var(--muted)]">{p.slice(1, -1)}</em>;
    return <span key={i}>{p}</span>;
  });
}

function MsgBody({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="msg-body">
      {lines.map((line, i) =>
        line.startsWith("- ") ? (
          <span key={i} className="flex gap-2 pl-1">
            <span className="mt-[0.52em] h-1 w-1 shrink-0 rounded-full bg-[var(--cyan)]" aria-hidden="true" />
            <span>{formatInline(line.slice(2))}</span>
          </span>
        ) : (
          <span key={i} className="block">
            {line ? formatInline(line) : "\u00A0"}
          </span>
        )
      )}
    </div>
  );
}

const KIND_TONE: Record<string, string> = { fact: "#22d3ee", preference: "#e879f9", insight: "#a78bfa" };

const SUGGESTIONS = [
  "How ready are we to launch?",
  "Why did the last deployment fail?",
  "Audit our accessibility gaps",
  "How do I deploy this to Vercel?",
];

export default function CopilotPage() {
  const bundleQ = useFetch<Bundle>("/api/messages");
  const { push } = useToast();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [tab, setTab] = useState<"memory" | "reflections">("memory");
  const [clearOpen, setClearOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [memDraft, setMemDraft] = useState("");
  const [memKind, setMemKind] = useState("fact");
  const [memBusy, setMemBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);

  const data = bundleQ.data;
  const messages = data?.messages ?? [];
  const memories = data?.memories ?? [];
  const reflections = data?.reflections ?? [];
  const ai = data?.ai ?? { configured: false, model: null };

  const reflectionByMsg = useMemo(() => {
    const m = new Map<string, Reflection>();
    for (const r of reflections) if (r.messageId) m.set(r.messageId, r);
    return m;
  }, [reflections]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      setInput(q);
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, pending]);

  function patch(fn: (b: Bundle) => Bundle) {
    bundleQ.setData((prev) => (prev ? fn(prev) : prev));
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sendingRef.current) return;
    sendingRef.current = true;
    setPending(true);
    setInput("");
    const tmpId = `tmp-${Date.now()}`;
    const tmp: Message = {
      id: tmpId,
      userId: "",
      role: "user",
      content,
      engine: null,
      createdAt: new Date().toISOString(),
    };
    patch((b) => ({ ...b, messages: [...b.messages, tmp] }));
    try {
      const res = await api<{
        userMessage: Message;
        message: Message;
        reflection: Reflection;
        newMemories: Memory[];
        notice: string | null;
      }>("/api/chat", { method: "POST", body: { content } });
      patch((b) => ({
        ...b,
        messages: [...b.messages.filter((m) => m.id !== tmpId), res.userMessage, res.message],
        reflections: [res.reflection, ...b.reflections],
        memories: [...res.newMemories, ...b.memories],
      }));
      if (res.newMemories.length > 0) {
        push({ title: `${res.newMemories.length} new memor${res.newMemories.length > 1 ? "ies" : "y"} persisted`, message: "Stored in Postgres — survives sessions and redeploys.", variant: "info" });
      }
      if (res.notice) push({ title: "Engine fallback", message: res.notice, variant: "error", duration: 9000 });
    } catch (e) {
      patch((b) => ({ ...b, messages: b.messages.filter((m) => m.id !== tmpId) }));
      setInput(content);
      push({ title: "The copilot couldn't answer", message: errMsg(e), variant: "error" });
    } finally {
      sendingRef.current = false;
      setPending(false);
      inputRef.current?.focus();
    }
  }

  async function clearConversation() {
    try {
      await api("/api/messages", { method: "DELETE" });
      patch((b) => ({ ...b, messages: [] }));
      push({ title: "Conversation cleared", message: "Long-term memories and reflections were kept.", variant: "success" });
    } catch (e) {
      push({ title: "Couldn't clear the conversation", message: errMsg(e), variant: "error" });
    }
  }

  async function addMemory() {
    const content = memDraft.trim();
    if (content.length < 4) {
      push({ title: "Memory too short", message: "Give it at least 4 characters.", variant: "error" });
      return;
    }
    setMemBusy(true);
    try {
      const res = await api<{ memory: Memory }>("/api/memories", { method: "POST", body: { content, kind: memKind } });
      patch((b) => ({ ...b, memories: [res.memory, ...b.memories] }));
      setMemDraft("");
      push({ title: "Memory pinned", variant: "success" });
    } catch (e) {
      push({ title: "Couldn't save memory", message: errMsg(e), variant: "error" });
    } finally {
      setMemBusy(false);
    }
  }

  async function deleteMemory(mem: Memory) {
    patch((b) => ({ ...b, memories: b.memories.filter((m) => m.id !== mem.id) }));
    try {
      await api(`/api/memories/${mem.id}`, { method: "DELETE" });
      push({
        title: "Memory forgotten",
        variant: "success",
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              const res = await api<{ memory: Memory }>("/api/memories", { method: "POST", body: { content: mem.content, kind: mem.kind } });
              patch((b) => ({ ...b, memories: [res.memory, ...b.memories] }));
            } catch (e) {
              push({ title: "Restore failed", message: errMsg(e), variant: "error" });
            }
          },
        },
      });
    } catch (e) {
      patch((b) => ({ ...b, memories: [mem, ...b.memories] }));
      push({ title: "Couldn't delete memory", message: errMsg(e), variant: "error" });
    }
  }

  if (bundleQ.error) {
    return (
      <>
        <PageHead eyebrow="Command · Intelligence" title="AI Copilot" />
        <ErrorState message={bundleQ.error} onRetry={bundleQ.reload} />
      </>
    );
  }

  return (
    <>
      <PageHead eyebrow="Command · Intelligence" title="AI Copilot" desc="Grounded in your live workspace. It remembers across sessions and reflects on every answer.">
        <span
          className={cx("badge", ai.configured ? "border-[rgba(52,211,153,0.45)] bg-[rgba(52,211,153,0.1)] text-[var(--green)]" : "border-[rgba(251,191,36,0.45)] bg-[rgba(251,191,36,0.1)] text-[var(--amber)]")}
          title={ai.configured ? `Connected to OpenAI ${ai.model}` : "No OPENAI_API_KEY set — answering with the deterministic local analyst. Add a key to enable GPT."}
        >
          <span className={cx("h-1.5 w-1.5 rounded-full", "pulse-dot")} style={{ background: ai.configured ? "#34d399" : "#fbbf24" }} />
          {ai.configured ? `${(ai.model ?? "GPT").toUpperCase()} · LIVE` : "LOCAL ANALYST · NO API KEY"}
        </span>
        <Button size="sm" icon="trash" onClick={() => setClearOpen(true)} disabled={messages.length === 0}>Clear chat</Button>
      </PageHead>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        {/* Chat column */}
        <div className="card fade-up flex h-[68vh] min-h-[480px] flex-col lg:h-[calc(100vh-15.5rem)]">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite" aria-label="Conversation">
            {bundleQ.loading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-3/4" />
                <Skeleton className="ml-auto h-24 w-5/6" />
                <Skeleton className="h-16 w-2/3" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="relative mb-4">
                  <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.35),transparent_70%)] blur-xl" />
                  <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(167,139,250,0.4)] bg-[rgba(167,139,250,0.1)] text-[var(--violet)]">
                    <Icon name="spark" size={28} />
                  </span>
                </div>
                <h2 className="font-display text-lg font-bold">Ask about your launch</h2>
                <p className="mt-1 max-w-sm text-sm text-[var(--muted)]">
                  {ai.configured
                    ? "GPT is connected and grounded in your live projects, deployments and checklist."
                    : "The local analyst answers from your real workspace data. Add OPENAI_API_KEY for full conversational AI."}
                </p>
                <div className="mt-5 flex max-w-md flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="chip" onClick={() => send(s)} disabled={pending}>{s}</button>
                  ))}
                </div>
                <p className="mt-4 font-mono2 text-[0.66rem] text-[var(--faint)]">tip: say “remember: …” to pin a durable fact</p>
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.role === "user";
                const refl = !isUser ? reflectionByMsg.get(m.id) : undefined;
                const open = refl ? expanded.has(refl.id) : false;
                return (
                  <div key={m.id} className={cx("flex flex-col", isUser ? "items-end" : "items-start")}>
                    <div
                      className={cx(
                        "max-w-[92%] rounded-2xl border px-4 py-3 sm:max-w-[85%]",
                        isUser
                          ? "border-[rgba(34,211,238,0.3)] bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(45,212,191,0.08))] text-[#dff8ff]"
                          : "border-[var(--line)] bg-[rgba(14,22,40,0.8)]"
                      )}
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className={cx("font-mono2 text-[0.6rem] font-bold tracking-[0.16em]", isUser ? "text-[var(--cyan)]" : "text-[var(--violet)]")}>
                          {isUser ? "YOU" : m.engine === "openai" ? `COPILOT · ${(ai.model ?? "GPT").toUpperCase()}` : "COPILOT · LOCAL ANALYST"}
                        </span>
                        <span className="font-mono2 text-[0.6rem] text-[var(--faint)]">{timeAgo(m.createdAt)}</span>
                      </div>
                      <MsgBody content={m.content} />
                    </div>
                    {refl && (
                      <div className="mt-1.5 max-w-[92%] sm:max-w-[85%]">
                        <button
                          className="chip"
                          data-active={open}
                          onClick={() =>
                            setExpanded((s) => {
                              const n = new Set(s);
                              if (n.has(refl.id)) n.delete(refl.id);
                              else n.add(refl.id);
                              return n;
                            })
                          }
                          aria-expanded={open}
                        >
                          <Icon name="reflect" size={12} />
                          Self-reflection · {refl.score}
                          <Icon name={open ? "up" : "down"} size={11} />
                        </button>
                        {open && (
                          <div className="fade-up mt-1.5 rounded-xl border border-[rgba(167,139,250,0.25)] bg-[rgba(167,139,250,0.06)] p-3.5 text-xs leading-relaxed">
                            <p className="text-[var(--text)]">{refl.summary}</p>
                            <p className="mt-2 text-[var(--muted)]"><strong className="text-[#d8ccff]">Lesson:</strong> {refl.lesson}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {pending && (
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgba(167,139,250,0.4)] bg-[rgba(167,139,250,0.1)] text-[var(--violet)]">
                  <Icon name="spark" size={13} />
                </span>
                <div className="flex items-center gap-1 rounded-2xl border border-[var(--line)] bg-[rgba(14,22,40,0.8)] px-4 py-3">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--violet)]" style={{ animationDelay: `${i * 0.18}s` }} />
                  ))}
                </div>
                <span className="font-mono2 text-[0.62rem] text-[var(--faint)]">analyzing workspace…</span>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-[var(--line)] p-3.5 sm:p-4">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                className="input max-h-32 min-h-[2.8rem] flex-1 resize-none"
                rows={Math.min(4, Math.max(1, input.split("\n").length))}
                placeholder={ai.configured ? "Ask GPT about readiness, failures, a11y, deploys…" : "Ask the analyst — try “readiness report” or “remember: …”"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                aria-label="Message the copilot"
                maxLength={2000}
                disabled={pending}
              />
              <Button variant="primary" size="icon" className="h-[2.8rem] w-[2.8rem]" onClick={() => send()} loading={pending} disabled={!input.trim()} aria-label="Send message">
                <Icon name="send" size={16} />
              </Button>
            </div>
            <p className="mt-2 font-mono2 text-[0.6rem] text-[var(--faint)]">
              Enter to send · Shift+Enter for a new line · answers are grounded in live DB data, never invented
            </p>
          </div>
        </div>

        {/* Memory / reflection rail */}
        <div className="card fade-up flex max-h-[70vh] flex-col lg:h-[calc(100vh-15.5rem)] lg:max-h-none" style={{ animationDelay: "120ms" }}>
          <div className="grid grid-cols-2 gap-1 border-b border-[var(--line)] p-2" role="tablist" aria-label="Copilot panels">
            <button role="tab" aria-selected={tab === "memory"} className={cx("rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition", tab === "memory" ? "bg-[rgba(34,211,238,0.14)] text-[#a5f3fc]" : "text-[var(--muted)] hover:text-[var(--text)]")} onClick={() => setTab("memory")}>
              <span className="inline-flex items-center gap-1.5"><Icon name="brain" size={13} />Memory ({memories.length})</span>
            </button>
            <button role="tab" aria-selected={tab === "reflections"} className={cx("rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition", tab === "reflections" ? "bg-[rgba(167,139,250,0.16)] text-[#d8ccff]" : "text-[var(--muted)] hover:text-[var(--text)]")} onClick={() => setTab("reflections")}>
              <span className="inline-flex items-center gap-1.5"><Icon name="reflect" size={13} />Reflections ({reflections.length})</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5">
            {tab === "memory" ? (
              <>
                <div className="mb-3 space-y-2">
                  <input className="input" placeholder="Pin a fact for future sessions…" value={memDraft} onChange={(e) => setMemDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMemory()} aria-label="New memory content" maxLength={300} />
                  <div className="flex gap-2">
                    <select className="input w-auto flex-1" value={memKind} onChange={(e) => setMemKind(e.target.value)} aria-label="Memory kind">
                      <option value="fact">Fact</option>
                      <option value="preference">Preference</option>
                      <option value="insight">Insight</option>
                    </select>
                    <Button variant="primary" size="sm" icon="plus" loading={memBusy} onClick={addMemory}>Pin</Button>
                  </div>
                </div>
                {bundleQ.loading ? (
                  <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
                ) : memories.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-xs leading-relaxed text-[var(--faint)]">
                    No memories yet. Pin a fact above or say “remember: …” in chat — it will persist across sessions.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {memories.map((m) => (
                      <li key={m.id} className="group rounded-xl border border-[var(--line)] bg-[rgba(146,176,255,0.04)] p-3">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="badge" style={{ color: KIND_TONE[m.kind], borderColor: `${KIND_TONE[m.kind]}50`, background: `${KIND_TONE[m.kind]}10` }}>
                            {m.kind.toUpperCase()}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="font-mono2 text-[0.58rem] text-[var(--faint)]">{m.source} · {timeAgo(m.createdAt)}</span>
                            <button className="rounded p-0.5 text-[var(--faint)] opacity-0 transition hover:text-[var(--rose)] group-hover:opacity-100 focus:opacity-100" onClick={() => deleteMemory(m)} aria-label="Delete memory">
                              <Icon name="x" size={11} />
                            </button>
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-[var(--text)]">{m.content}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : bundleQ.loading ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
            ) : reflections.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-xs leading-relaxed text-[var(--faint)]">
                No reflections yet. Every copilot answer produces an honest self-evaluation, logged here.
              </p>
            ) : (
              <ul className="space-y-2">
                {reflections.map((r) => (
                  <li key={r.id} className="rounded-xl border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.05)] p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="font-mono2 text-[0.58rem] uppercase tracking-wider text-[var(--faint)]">
                        {r.engine === "openai" ? "GPT" : "LOCAL"} · {timeAgo(r.createdAt)}
                      </span>
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full border font-mono2 text-[0.62rem] font-bold"
                        style={{
                          color: r.score >= 85 ? "#34d399" : r.score >= 70 ? "#22d3ee" : "#fbbf24",
                          borderColor: r.score >= 85 ? "#34d39966" : r.score >= 70 ? "#22d3ee66" : "#fbbf2466",
                        }}
                        aria-label={`Self-evaluation score ${r.score} of 100`}
                      >
                        {r.score}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-[var(--text)]">{r.summary}</p>
                    <p className="mt-1.5 text-[0.68rem] leading-relaxed text-[var(--muted)]"><strong className="text-[#d8ccff]">Lesson:</strong> {r.lesson}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <Confirm
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={clearConversation}
        title="Clear the conversation?"
        body="All chat messages will be deleted. Long-term memories and the reflection log are kept — the copilot will still remember what matters."
        confirmLabel="Clear chat"
      />
    </>
  );
}