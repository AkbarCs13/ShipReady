"use client";

import { useMemo, useRef, useState } from "react";
import { api, errMsg, useFetch } from "@/lib/client";
import { CATEGORIES, PRIORITIES, cx, readinessScore, type Category, type Task } from "@/lib/core";
import { Button, Confirm, EmptyState, ErrorState, Field, Icon, Modal, PageHead, PriorityBadge, Progress, Seg, Skeleton } from "@/components/ui";
import { useToast } from "@/components/toast";

const CAT_ICON: Record<Category, string> = {
  deployment: "launch",
  accessibility: "access",
  security: "shield",
  performance: "zap",
  observability: "eye",
};

function TaskEditor({ task, onClose, onSaved }: { task: Task; onClose: () => void; onSaved: (t: Task) => void }) {
  const [form, setForm] = useState({ title: task.title, notes: task.notes, priority: task.priority as string, category: task.category as string });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.title.trim().length < 3) {
      setError("Title must be at least 3 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ task: Task }>(`/api/tasks/${task.id}`, { method: "PATCH", body: form });
      onSaved(res.task);
      onClose();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit checklist item">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Title" htmlFor="te-title" error={error}>
          <input id="te-title" className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </Field>
        <Field label="Notes" htmlFor="te-notes">
          <textarea id="te-notes" className="input min-h-[4rem] resize-y" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Acceptance criteria, links, context…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority" htmlFor="te-prio">
            <select id="te-prio" className="input" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
              {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label} (×{p.weight})</option>)}
            </select>
          </Field>
          <Field label="Category" htmlFor="te-cat">
            <select id="te-cat" className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
        </div>
        <Button type="submit" variant="primary" loading={busy} className="w-full" icon="check">Save item</Button>
      </form>
    </Modal>
  );
}

export default function ChecklistPage() {
  const tasksQ = useFetch<{ tasks: Task[] }>("/api/tasks");
  const { push } = useToast();
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const [composers, setComposers] = useState<Record<string, { title: string; priority: string }>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const tasks = tasksQ.data?.tasks ?? [];
  const score = readinessScore(tasks);
  const doneCount = tasks.filter((t) => t.done).length;

  const byCat = useMemo(() => {
    const map = new Map<Category, Task[]>();
    for (const c of CATEGORIES) {
      const items = tasks
        .filter((t) => t.category === c.id)
        .filter((t) => (filter === "all" ? true : filter === "done" ? t.done : !t.done))
        .sort((a, b) => a.position - b.position);
      map.set(c.id, items);
    }
    return map;
  }, [tasks, filter]);

  function setTasks(updater: (list: Task[]) => Task[]) {
    tasksQ.setData((prev) => ({ tasks: updater(prev?.tasks ?? []) }));
  }

  async function toggle(task: Task) {
    setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    try {
      const res = await api<{ task: Task }>(`/api/tasks/${task.id}`, { method: "PATCH", body: { done: !task.done } });
      setTasks((list) => list.map((t) => (t.id === task.id ? res.task : t)));
    } catch (e) {
      setTasks((list) => list.map((t) => (t.id === task.id ? task : t)));
      push({ title: "Couldn't update the item", message: errMsg(e), variant: "error" });
    }
  }

  async function addTask(category: Category) {
    const draft = composers[category] ?? { title: "", priority: "medium" };
    if (draft.title.trim().length < 3) {
      push({ title: "Give the item a title", message: "At least 3 characters.", variant: "error" });
      return;
    }
    setAdding(category);
    try {
      const res = await api<{ task: Task }>("/api/tasks", { method: "POST", body: { title: draft.title, category, priority: draft.priority } });
      setTasks((list) => [...list, res.task]);
      setComposers((c) => ({ ...c, [category]: { title: "", priority: draft.priority } }));
      push({ title: "Checklist item added", variant: "success" });
    } catch (e) {
      push({ title: "Couldn't add the item", message: errMsg(e), variant: "error" });
    } finally {
      setAdding(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const task = deleting;
    setTasks((list) => list.filter((t) => t.id !== task.id));
    try {
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      push({
        title: "Item deleted",
        message: task.title,
        variant: "success",
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await api("/api/tasks/restore", { method: "POST", body: { rows: [task] } });
              tasksQ.reload();
              push({ title: "Item restored", variant: "success" });
            } catch (e) {
              push({ title: "Restore failed", message: errMsg(e), variant: "error" });
            }
          },
        },
      });
    } catch (e) {
      tasksQ.reload();
      push({ title: "Delete failed", message: errMsg(e), variant: "error" });
    }
  }

  async function persistOrder(category: Category, orderedIds: string[]) {
    try {
      await api("/api/tasks/reorder", { method: "POST", body: { orderedIds } });
    } catch (e) {
      tasksQ.reload();
      push({ title: "Couldn't save the order", message: errMsg(e), variant: "error" });
    }
  }

  function reorderLocally(category: Category, fromId: string, toId: string) {
    if (fromId === toId) return;
    const items = [...(byCat.get(category) ?? [])];
    const all = tasks.filter((t) => t.category === category).sort((a, b) => a.position - b.position);
    const fromIdx = all.findIndex((t) => t.id === fromId);
    const toIdx = all.findIndex((t) => t.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const moved = all.splice(fromIdx, 1)[0];
    all.splice(toIdx, 0, moved);
    const positioned = all.map((t, i) => ({ ...t, position: i }));
    setTasks((list) => [...list.filter((t) => t.category !== category), ...positioned]);
    void persistOrder(category, positioned.map((t) => t.id));
    void items;
  }

  function move(category: Category, task: Task, dir: -1 | 1) {
    const all = tasks.filter((t) => t.category === category).sort((a, b) => a.position - b.position);
    const idx = all.findIndex((t) => t.id === task.id);
    const target = all[idx + dir];
    if (target) reorderLocally(category, task.id, target.id);
  }

  if (tasksQ.error) {
    return (
      <>
        <PageHead eyebrow="Workspace · Launch gates" title="Readiness checklist" />
        <ErrorState message={tasksQ.error} onRetry={tasksQ.reload} />
      </>
    );
  }

  return (
    <>
      <PageHead eyebrow="Workspace · Launch gates" title="Readiness checklist" desc="Weighted by priority — critical items count ×5. Drag to reorder, toggle to close, and watch the score climb.">
        <Seg
          options={[{ id: "all", label: `All (${tasks.length})` }, { id: "open", label: `Open (${tasks.length - doneCount})` }, { id: "done", label: `Done (${doneCount})` }]}
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter checklist items"
        />
      </PageHead>

      {tasksQ.loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState icon="checks" title="No checklist items yet" body="Add your first launch gate below — or load the demo workspace from Settings to see a full production-readiness audit." />
      ) : (
        <>
          <div className="card fade-up mb-5 flex flex-wrap items-center gap-4 p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold text-[var(--cyan)]">{score}%</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">weighted readiness</span>
            </div>
            <div className="min-w-[12rem] flex-1">
              <Progress value={score} hue={score >= 80 ? "#34d399" : score >= 50 ? "#22d3ee" : "#fbbf24"} />
            </div>
            <span className="font-mono2 text-xs text-[var(--faint)]">{doneCount}/{tasks.length} closed</span>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            {CATEGORIES.map((cat, ci) => {
              const items = byCat.get(cat.id) ?? [];
              const allInCat = tasks.filter((t) => t.category === cat.id);
              const done = allInCat.filter((t) => t.done).length;
              const pct = allInCat.length ? Math.round((done / allInCat.length) * 100) : 0;
              const draft = composers[cat.id] ?? { title: "", priority: "medium" };
              return (
                <section key={cat.id} className="card fade-up p-5" style={{ animationDelay: `${ci * 70}ms` }} aria-label={`${cat.label} checklist`}>
                  <header className="mb-3 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: cat.hue, background: `color-mix(in srgb, ${cat.hue} 13%, transparent)` }}>
                      <Icon name={CAT_ICON[cat.id]} size={17} />
                    </span>
                    <div className="flex-1">
                      <h2 className="font-display text-base font-bold leading-tight">{cat.label}</h2>
                      <p className="text-[0.68rem] text-[var(--faint)]">{cat.hint}</p>
                    </div>
                    <span className="font-mono2 text-xs text-[var(--muted)]">{done}/{allInCat.length}</span>
                  </header>
                  <Progress value={pct} hue={cat.hue} />

                  <ul className="mt-4 space-y-1.5">
                    {items.length === 0 && (
                      <li className="rounded-xl border border-dashed border-[var(--line)] px-4 py-4 text-center text-xs text-[var(--faint)]">
                        {filter === "all" ? "Nothing here yet — add the first item below." : `No ${filter} items in this category.`}
                      </li>
                    )}
                    {items.map((t) => (
                      <li
                        key={t.id}
                        draggable
                        onDragStart={() => { dragId.current = t.id; }}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(t.id); }}
                        onDragLeave={() => setDragOver((d) => (d === t.id ? null : d))}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOver(null);
                          if (dragId.current) reorderLocally(cat.id, dragId.current, t.id);
                          dragId.current = null;
                        }}
                        onDragEnd={() => { dragId.current = null; setDragOver(null); }}
                        className={cx(
                          "group flex items-center gap-2 rounded-xl border border-transparent px-2 py-2 transition",
                          dragOver === t.id ? "border-[rgba(34,211,238,0.5)] bg-[rgba(34,211,238,0.07)]" : "hover:border-[var(--line)] hover:bg-[rgba(146,176,255,0.04)]"
                        )}
                      >
                        <span className="cursor-grab text-[var(--faint)] opacity-40 transition group-hover:opacity-100" aria-hidden="true">
                          <Icon name="grip" size={14} />
                        </span>
                        <button
                          role="checkbox"
                          aria-checked={t.done}
                          aria-label={`Mark "${t.title}" as ${t.done ? "open" : "done"}`}
                          onClick={() => toggle(t)}
                          className={cx(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
                            t.done
                              ? "border-[rgba(52,211,153,0.6)] bg-[rgba(52,211,153,0.2)] text-[var(--green)]"
                              : "border-[rgba(146,176,255,0.35)] bg-transparent text-transparent hover:border-[var(--cyan)]"
                          )}
                        >
                          <Icon name="check" size={12} />
                        </button>
                        <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(t)} title={t.notes || t.title}>
                          <span className={cx("block truncate text-sm transition", t.done ? "text-[var(--faint)] line-through" : "text-[var(--text)]")}>
                            {t.title}
                          </span>
                        </button>
                        <PriorityBadge p={t.priority} />
                        <span className="flex opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                          <button className="rounded p-1 text-[var(--faint)] hover:text-[var(--cyan)]" onClick={() => move(cat.id, t, -1)} aria-label={`Move "${t.title}" up`}>
                            <Icon name="up" size={12} />
                          </button>
                          <button className="rounded p-1 text-[var(--faint)] hover:text-[var(--cyan)]" onClick={() => move(cat.id, t, 1)} aria-label={`Move "${t.title}" down`}>
                            <Icon name="down" size={12} />
                          </button>
                          <button className="rounded p-1 text-[var(--faint)] hover:text-[var(--rose)]" onClick={() => setDeleting(t)} aria-label={`Delete "${t.title}"`}>
                            <Icon name="trash" size={12} />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Inline composer */}
                  <div className="mt-3 flex gap-2 border-t border-[rgba(146,176,255,0.09)] pt-3.5">
                    <input
                      className="input flex-1"
                      placeholder={`Add ${cat.label.toLowerCase()} item…`}
                      value={draft.title}
                      aria-label={`New ${cat.label} item`}
                      onChange={(e) => setComposers((c) => ({ ...c, [cat.id]: { ...draft, title: e.target.value } }))}
                      onKeyDown={(e) => e.key === "Enter" && addTask(cat.id)}
                    />
                    <select
                      className="input w-auto"
                      value={draft.priority}
                      aria-label={`Priority for new ${cat.label} item`}
                      onChange={(e) => setComposers((c) => ({ ...c, [cat.id]: { ...draft, priority: e.target.value } }))}
                    >
                      {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                    <Button variant="primary" size="icon" loading={adding === cat.id} onClick={() => addTask(cat.id)} aria-label={`Add ${cat.label} item`}>
                      <Icon name="plus" size={15} />
                    </Button>
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} onSaved={(t) => setTasks((list) => list.map((x) => (x.id === t.id ? t : x)))} />}

      <Confirm
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete checklist item?"
        body={`“${deleting?.title ?? ""}” will be removed from the readiness score. You can undo from the notification.`}
        confirmLabel="Delete item"
      />
    </>
  );
}