"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, errMsg, useFetch } from "@/lib/client";
import {
  DEPLOY_STATUSES,
  ENVIRONMENTS,
  fmtDate,
  shortSha,
  timeAgo,
  type Deployment,
  type Project,
} from "@/lib/core";
import { Button, Confirm, EmptyState, EnvBadge, ErrorState, Field, Icon, Modal, PageHead, Skeleton } from "@/components/ui";
import { useToast } from "@/components/toast";

const STATUS_COLOR: Record<string, string> = {
  live: "#34d399",
  building: "#22d3ee",
  queued: "#60a5fa",
  failed: "#fb7185",
  rolled_back: "#fbbf24",
};

interface Filters {
  q: string;
  projectId: string;
  status: string;
  env: string;
  sort: string;
}
const DEFAULT_FILTERS: Filters = { q: "", projectId: "all", status: "all", env: "all", sort: "newest" };
interface SavedView extends Filters {
  id: string;
  name: string;
}
const VIEWS_KEY = "shipready_views_v1";

function fmtDuration(sec: number | null): string {
  if (sec === null) return "—";
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function DeploymentForm({
  projects,
  initial,
  deploymentId,
  onSaved,
}: {
  projects: Project[];
  initial?: Partial<Deployment>;
  deploymentId?: string;
  onSaved: (d: Deployment, isNew: boolean) => void;
}) {
  const [form, setForm] = useState<{
    projectId: string;
    version: string;
    environment: string;
    status: string;
    commitMessage: string;
    durationSec: string;
  }>({
    projectId: initial?.projectId ?? projects[0]?.id ?? "",
    version: initial?.version ?? "",
    environment: initial?.environment ?? "production",
    status: initial?.status ?? "queued",
    commitMessage: initial?.commitMessage ?? "",
    durationSec: initial?.durationSec != null ? String(initial.durationSec) : "",
  });
  const [errors, setErrors] = useState<{ version?: string; projectId?: string; durationSec?: string }>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.version.trim()) next.version = "Version tag is required, e.g. v1.4.2.";
    if (!form.projectId) next.projectId = "Choose a project.";
    if (form.durationSec && (isNaN(Number(form.durationSec)) || Number(form.durationSec) < 0)) next.durationSec = "Duration must be a positive number of seconds.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    setServerError(null);
    try {
      const payload = { ...form, durationSec: form.durationSec ? Number(form.durationSec) : undefined };
      const res = await api<{ deployment: Deployment }>(deploymentId ? `/api/deployments/${deploymentId}` : "/api/deployments", {
        method: deploymentId ? "PATCH" : "POST",
        body: payload,
      });
      onSaved(res.deployment, !deploymentId);
    } catch (err) {
      setServerError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {serverError && <p className="rounded-xl border border-[rgba(251,113,133,0.4)] bg-[rgba(251,113,133,0.09)] px-3.5 py-2.5 text-xs text-[#fecdd3]" role="alert">{serverError}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Project" htmlFor="df-project" error={errors.projectId}>
          <select id="df-project" className="input" value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))} disabled={Boolean(deploymentId)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Version" htmlFor="df-version" error={errors.version}>
          <input id="df-version" className="input" value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} placeholder="v1.4.2" aria-invalid={Boolean(errors.version)} />
        </Field>
        <Field label="Environment" htmlFor="df-env">
          <select id="df-env" className="input" value={form.environment} onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))}>
            {ENVIRONMENTS.map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Status" htmlFor="df-status">
          <select id="df-status" className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            {DEPLOY_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Commit message" htmlFor="df-msg">
        <input id="df-msg" className="input" value={form.commitMessage} onChange={(e) => setForm((f) => ({ ...f, commitMessage: e.target.value }))} placeholder="fix: retry idempotent webhook deliveries" />
      </Field>
      <Field label="Duration (seconds)" htmlFor="df-dur" error={errors.durationSec} hint="Optional — auto-filled when you mark a deployment live.">
        <input id="df-dur" className="input" inputMode="numeric" value={form.durationSec} onChange={(e) => setForm((f) => ({ ...f, durationSec: e.target.value }))} placeholder="96" aria-invalid={Boolean(errors.durationSec)} />
      </Field>
      <Button type="submit" variant="primary" loading={busy} className="w-full" icon="launch">
        {deploymentId ? "Save deployment" : "Log deployment"}
      </Button>
    </form>
  );
}

export default function DeploymentsPage() {
  const depsQ = useFetch<{ deployments: Deployment[] }>("/api/deployments");
  const projectsQ = useFetch<{ projects: Project[] }>("/api/projects");
  const { push } = useToast();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [views, setViews] = useState<SavedView[]>([]);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Deployment | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") setCreateOpen(true);
    try {
      const raw = localStorage.getItem(VIEWS_KEY);
      if (raw) setViews(JSON.parse(raw) as SavedView[]);
    } catch { /* corrupted storage — start fresh */ }
  }, []);

  const deps = depsQ.data?.deployments ?? [];
  const projects = projectsQ.data?.projects ?? [];
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "Removed project";

  const visible = useMemo(() => {
    let list = deps.filter((d) => {
      const q = filters.q.toLowerCase();
      const matchQ =
        !q ||
        d.version.toLowerCase().includes(q) ||
        d.commitMessage.toLowerCase().includes(q) ||
        d.commitSha.toLowerCase().includes(q) ||
        projectName(d.projectId).toLowerCase().includes(q);
      return (
        matchQ &&
        (filters.projectId === "all" || d.projectId === filters.projectId) &&
        (filters.status === "all" || d.status === filters.status) &&
        (filters.env === "all" || d.environment === filters.env)
      );
    });
    if (filters.sort === "oldest") list = [...list].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    else if (filters.sort === "duration") list = [...list].sort((a, b) => (b.durationSec ?? -1) - (a.durationSec ?? -1));
    else list = [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deps, filters, projects]);

  function persistViews(next: SavedView[]) {
    setViews(next);
    try {
      localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
    } catch { /* storage full/unavailable */ }
  }

  function saveView() {
    const name = viewName.trim();
    if (!name) return;
    persistViews([...views.filter((v) => v.name !== name), { ...filters, id: `${Date.now()}`, name }]);
    setSaveViewOpen(false);
    setViewName("");
    push({ title: "View saved", message: `“${name}” captures the current filters.`, variant: "success" });
  }

  function upsertLocal(d: Deployment, isNew: boolean) {
    depsQ.setData((prev) => {
      const list = prev?.deployments ?? [];
      return { deployments: isNew ? [d, ...list] : list.map((x) => (x.id === d.id ? d : x)) };
    });
    push({ title: isNew ? "Deployment logged" : "Deployment updated", message: `${d.version} · ${projectName(d.projectId)}`, variant: "success" });
    setCreateOpen(false);
    setEditing(null);
  }

  async function changeStatus(d: Deployment, status: string) {
    const prev = d;
    depsQ.setData((old) => ({ deployments: (old?.deployments ?? []).map((x) => (x.id === d.id ? { ...x, status: status as Deployment["status"] } : x)) }));
    try {
      const res = await api<{ deployment: Deployment }>(`/api/deployments/${d.id}`, { method: "PATCH", body: { status } });
      depsQ.setData((old) => ({ deployments: (old?.deployments ?? []).map((x) => (x.id === d.id ? res.deployment : x)) }));
      push({ title: `Marked ${status.replace("_", " ")}`, message: `${d.version} · ${projectName(d.projectId)}`, variant: status === "failed" ? "error" : "success" });
    } catch (e) {
      depsQ.setData((old) => ({ deployments: (old?.deployments ?? []).map((x) => (x.id === d.id ? prev : x)) }));
      push({ title: "Status change failed", message: errMsg(e), variant: "error" });
    }
  }

  function undoRestore(rows: Deployment[]) {
    return async () => {
      try {
        await api("/api/deployments/restore", { method: "POST", body: { rows } });
        depsQ.reload();
        push({ title: rows.length > 1 ? `${rows.length} deployments restored` : "Deployment restored", variant: "success" });
      } catch (e) {
        push({ title: "Restore failed", message: errMsg(e), variant: "error" });
      }
    };
  }

  async function deleteOne(d: Deployment) {
    depsQ.setData((old) => ({ deployments: (old?.deployments ?? []).filter((x) => x.id !== d.id) }));
    setSelected((s) => { const n = new Set(s); n.delete(d.id); return n; });
    try {
      await api(`/api/deployments/${d.id}`, { method: "DELETE" });
      push({ title: "Deployment deleted", message: `${d.version} removed from history.`, variant: "success", action: { label: "Undo", onClick: undoRestore([d]) } });
    } catch (e) {
      depsQ.reload();
      push({ title: "Delete failed", message: errMsg(e), variant: "error" });
    }
  }

  async function deleteBulk() {
    const rows = deps.filter((d) => selected.has(d.id));
    const ids = rows.map((r) => r.id);
    depsQ.setData((old) => ({ deployments: (old?.deployments ?? []).filter((x) => !selected.has(x.id)) }));
    setSelected(new Set());
    try {
      await api("/api/deployments/bulk-delete", { method: "POST", body: { ids } });
      push({ title: `${ids.length} deployments deleted`, variant: "success", action: { label: "Undo", onClick: undoRestore(rows) } });
    } catch (e) {
      depsQ.reload();
      push({ title: "Bulk delete failed", message: errMsg(e), variant: "error" });
    }
  }

  const allVisibleSelected = visible.length > 0 && visible.every((d) => selected.has(d.id));
  const toggleAll = () => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((d) => d.id)));
  const toggleOne = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const loading = depsQ.loading || projectsQ.loading;

  return (
    <>
      <PageHead eyebrow="Workspace · Releases" title="Deployments" desc="The release ledger — filter it, save views, bulk-clean it, and roll statuses forward.">
        <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)} disabled={projects.length === 0 && !loading}>Log deployment</Button>
      </PageHead>

      {depsQ.error ? (
        <ErrorState message={depsQ.error} onRetry={depsQ.reload} />
      ) : loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-80" />
        </div>
      ) : deps.length === 0 ? (
        <EmptyState icon="launch" title="No deployments logged" body={projects.length === 0 ? "Create a project first, then log its releases here." : "Log your first release to start building the deployment ledger."}>
          {projects.length === 0 ? (
            <Link href="/dashboard/projects?new=1" className="btn btn-primary"><Icon name="plus" size={15} />Create a project</Link>
          ) : (
            <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>Log deployment</Button>
          )}
        </EmptyState>
      ) : (
        <>
          {/* Filter toolbar */}
          <div className="card fade-up mb-4 space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-0 flex-1 sm:max-w-[16rem]">
                <Icon name="search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
                <input className="input pl-9" placeholder="Version, commit, project…" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} aria-label="Search deployments" />
              </div>
              <select className="input w-auto" value={filters.projectId} onChange={(e) => setFilters((f) => ({ ...f, projectId: e.target.value }))} aria-label="Filter by project">
                <option value="all">All projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select className="input w-auto" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} aria-label="Filter by status">
                <option value="all">All statuses</option>
                {DEPLOY_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <select className="input w-auto" value={filters.env} onChange={(e) => setFilters((f) => ({ ...f, env: e.target.value }))} aria-label="Filter by environment">
                <option value="all">All envs</option>
                {ENVIRONMENTS.map((x) => <option key={x}>{x}</option>)}
              </select>
              <select className="input w-auto" value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))} aria-label="Sort deployments">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="duration">Longest build</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Icon name="bookmark" size={13} className="text-[var(--faint)]" />
              {views.length === 0 && <span className="text-xs text-[var(--faint)]">No saved views yet —</span>}
              {views.map((v) => (
                <span key={v.id} className="chip" data-active={false}>
                  <button onClick={() => setFilters({ q: v.q, projectId: v.projectId, status: v.status, env: v.env, sort: v.sort })} className="font-medium">
                    {v.name}
                  </button>
                  <button aria-label={`Delete view ${v.name}`} onClick={() => persistViews(views.filter((x) => x.id !== v.id))} className="text-[var(--faint)] hover:text-[var(--rose)]">
                    <Icon name="x" size={11} />
                  </button>
                </span>
              ))}
              <button className="chip" onClick={() => setSaveViewOpen(true)}>
                <Icon name="plus" size={11} /> Save current view
              </button>
              <button className="chip ml-auto" onClick={() => setFilters(DEFAULT_FILTERS)}>
                <Icon name="refresh" size={11} /> Reset
              </button>
              <span className="font-mono2 text-xs text-[var(--faint)]">{visible.length}/{deps.length}</span>
            </div>
          </div>

          {/* Bulk bar */}
          {selected.size > 0 && (
            <div className="fade-up mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-[rgba(34,211,238,0.35)] bg-[rgba(34,211,238,0.08)] px-4 py-2.5">
              <span className="text-sm font-semibold text-[#a5f3fc]">{selected.size} selected</span>
              <Button size="sm" variant="danger-ghost" icon="trash" onClick={() => setBulkConfirm(true)}>Delete selected</Button>
              <Button size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          )}

          {visible.length === 0 ? (
            <EmptyState icon="search" title="No deployments match" body="Loosen the filters or reset them to see the full ledger.">
              <Button onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</Button>
            </EmptyState>
          ) : (
            <div className="card fade-up overflow-x-auto">
              <table className="data-table min-w-[820px]">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input type="checkbox" className="h-4 w-4 accent-cyan-400" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all visible deployments" />
                    </th>
                    <th>Release</th>
                    <th>Project</th>
                    <th>Env</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>When</th>
                    <th className="w-20 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((d) => (
                    <tr key={d.id} data-selected={selected.has(d.id)} style={selected.has(d.id) ? { background: "rgba(34,211,238,0.06)" } : undefined}>
                      <td>
                        <input type="checkbox" className="h-4 w-4 accent-cyan-400" checked={selected.has(d.id)} onChange={() => toggleOne(d.id)} aria-label={`Select ${d.version}`} />
                      </td>
                      <td>
                        <p className="font-mono2 text-sm font-semibold text-[#bdf3ff]">{d.version}</p>
                        <p className="mt-0.5 max-w-[16rem] truncate font-mono2 text-[0.66rem] text-[var(--faint)]" title={d.commitMessage}>
                          {shortSha(d.commitSha)} · {d.commitMessage || "no message"}
                        </p>
                      </td>
                      <td className="text-sm">{projectName(d.projectId)}</td>
                      <td><EnvBadge env={d.environment} /></td>
                      <td>
                        <select
                          className="badge cursor-pointer appearance-none pr-2"
                          style={{ color: STATUS_COLOR[d.status], borderColor: `${STATUS_COLOR[d.status]}55`, background: `${STATUS_COLOR[d.status]}14` }}
                          value={d.status}
                          onChange={(e) => changeStatus(d, e.target.value)}
                          aria-label={`Status of ${d.version}`}
                        >
                          {DEPLOY_STATUSES.map((s) => <option key={s.id} value={s.id} style={{ color: "#e9effd", background: "#0e1628" }}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="font-mono2 text-xs text-[var(--muted)]">{fmtDuration(d.durationSec)}</td>
                      <td className="font-mono2 text-xs text-[var(--muted)]" title={fmtDate(d.createdAt)}>{timeAgo(d.createdAt)}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--cyan)]" onClick={() => setEditing(d)} aria-label={`Edit ${d.version}`}>
                            <Icon name="pencil" size={14} />
                          </button>
                          <button className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[rgba(251,113,133,0.12)] hover:text-[var(--rose)]" onClick={() => deleteOne(d)} aria-label={`Delete ${d.version}`}>
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Log a deployment" wide>
        <DeploymentForm projects={projects} onSaved={upsertLocal} />
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={`Edit ${editing?.version ?? "deployment"}`} wide>
        {editing && <DeploymentForm projects={projects} initial={editing} deploymentId={editing.id} onSaved={upsertLocal} />}
      </Modal>

      <Modal open={saveViewOpen} onClose={() => setSaveViewOpen(false)} title="Save current view">
        <Field label="View name" htmlFor="view-name" hint="Captures search, filters and sort order. Stored in this browser.">
          <input id="view-name" className="input" value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="Failed prod deploys" onKeyDown={(e) => e.key === "Enter" && saveView()} />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setSaveViewOpen(false)}>Cancel</Button>
          <Button variant="primary" icon="bookmark" onClick={saveView} disabled={!viewName.trim()}>Save view</Button>
        </div>
      </Modal>

      <Confirm
        open={bulkConfirm}
        onClose={() => setBulkConfirm(false)}
        onConfirm={deleteBulk}
        title={`Delete ${selected.size} deployments?`}
        body="They will be removed from the ledger. You can undo this immediately from the notification."
        confirmLabel={`Delete ${selected.size}`}
      />
    </>
  );
}