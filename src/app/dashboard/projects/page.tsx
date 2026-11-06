"use client";

import { useEffect, useMemo, useState } from "react";
import { api, errMsg, useFetch } from "@/lib/client";
import {
  ENVIRONMENTS,
  FRAMEWORKS,
  PROJECT_STATUSES,
  REGIONS,
  timeAgo,
  type Deployment,
  type Project,
} from "@/lib/core";
import { Button, Confirm, Drawer, EmptyState, EnvBadge, ErrorState, Field, Icon, Modal, PageHead, Skeleton, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/toast";

interface FormState {
  name: string;
  description: string;
  repoUrl: string;
  framework: string;
  environment: string;
  status: string;
  region: string;
}
const BLANK: FormState = { name: "", description: "", repoUrl: "", framework: "Next.js", environment: "production", status: "setup", region: "iad1" };

function ProjectForm({
  initial,
  projectId,
  onSaved,
  submitLabel,
}: {
  initial: FormState;
  projectId?: string;
  onSaved: (p: Project, isNew: boolean) => void;
  submitLabel: string;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (form.name.trim().length < 2) next.name = "Name must be at least 2 characters.";
    if (form.repoUrl && !/^https?:\/\/.+\..+/.test(form.repoUrl)) next.repoUrl = "Must start with http(s)://";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    setServerError(null);
    try {
      const res = await api<{ project: Project }>(projectId ? `/api/projects/${projectId}` : "/api/projects", {
        method: projectId ? "PATCH" : "POST",
        body: form,
      });
      onSaved(res.project, !projectId);
    } catch (err) {
      setServerError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {serverError && (
        <p className="rounded-xl border border-[rgba(251,113,133,0.4)] bg-[rgba(251,113,133,0.09)] px-3.5 py-2.5 text-xs text-[#fecdd3]" role="alert">{serverError}</p>
      )}
      <Field label="Project name" htmlFor="pf-name" error={errors.name}>
        <input id="pf-name" className="input" value={form.name} onChange={set("name")} placeholder="Atlas Storefront" aria-invalid={Boolean(errors.name)} />
      </Field>
      <Field label="Description" htmlFor="pf-desc">
        <textarea id="pf-desc" className="input min-h-[4.5rem] resize-y" value={form.description} onChange={set("description")} placeholder="What does this service do?" />
      </Field>
      <Field label="Repository URL" htmlFor="pf-repo" error={errors.repoUrl} hint="Optional — links out from the project card.">
        <input id="pf-repo" className="input" value={form.repoUrl} onChange={set("repoUrl")} placeholder="https://github.com/org/repo" aria-invalid={Boolean(errors.repoUrl)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Framework" htmlFor="pf-fw">
          <select id="pf-fw" className="input" value={form.framework} onChange={set("framework")}>
            {FRAMEWORKS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Environment" htmlFor="pf-env">
          <select id="pf-env" className="input" value={form.environment} onChange={set("environment")}>
            {ENVIRONMENTS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Status" htmlFor="pf-status">
          <select id="pf-status" className="input" value={form.status} onChange={set("status")}>
            {PROJECT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Region" htmlFor="pf-region">
          <select id="pf-region" className="input" value={form.region} onChange={set("region")}>
            {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </Field>
      </div>
      <Button type="submit" variant="primary" loading={busy} className="w-full" icon="check">{submitLabel}</Button>
    </form>
  );
}

export default function ProjectsPage() {
  const projectsQ = useFetch<{ projects: Project[] }>("/api/projects");
  const depsQ = useFetch<{ deployments: Deployment[] }>("/api/deployments");
  const { push } = useToast();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("updated");
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") setCreateOpen(true);
  }, []);

  const projects = projectsQ.data?.projects ?? [];
  const deps = depsQ.data?.deployments ?? [];

  const visible = useMemo(() => {
    let list = projects.filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.framework.toLowerCase().includes(search.toLowerCase())
    );
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "status") list = [...list].sort((a, b) => a.status.localeCompare(b.status));
    else list = [...list].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return list;
  }, [projects, search, sort]);

  const drawerProject = projects.find((p) => p.id === drawerId) ?? null;

  function upsertLocal(p: Project, isNew: boolean) {
    projectsQ.setData((prev) => {
      const list = prev?.projects ?? [];
      return { projects: isNew ? [p, ...list] : list.map((x) => (x.id === p.id ? p : x)) };
    });
    push({ title: isNew ? "Project created" : "Project saved", message: `${p.name} is up to date.`, variant: "success" });
    if (isNew) setCreateOpen(false);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    // Optimistic removal
    projectsQ.setData((prev) => ({ projects: (prev?.projects ?? []).filter((p) => p.id !== target.id) }));
    setDrawerId(null);
    try {
      await api(`/api/projects/${target.id}`, { method: "DELETE" });
      depsQ.reload();
      push({ title: "Project deleted", message: `${target.name} and its deployment history were removed.`, variant: "success" });
    } catch (e) {
      projectsQ.reload();
      push({ title: "Delete failed", message: errMsg(e), variant: "error" });
    }
  }

  async function loadDemo() {
    setSeeding(true);
    try {
      await api("/api/demo/reset", { method: "POST" });
      projectsQ.reload();
      depsQ.reload();
      push({ title: "Demo workspace loaded", variant: "success" });
    } catch (e) {
      push({ title: "Couldn't load demo data", message: errMsg(e), variant: "error" });
    } finally {
      setSeeding(false);
    }
  }

  return (
    <>
      <PageHead eyebrow="Workspace · Fleet" title="Projects" desc="Every service you're shepherding to production, with its live status and latest release.">
        <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>New project</Button>
      </PageHead>

      {projectsQ.error ? (
        <ErrorState message={projectsQ.error} onRetry={projectsQ.reload} />
      ) : projectsQ.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-52" />)}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState icon="box" title="No projects yet" body="Register your first service to start tracking deployments and readiness — or load the demo fleet.">
          <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>New project</Button>
          <Button icon="zap" loading={seeding} onClick={loadDemo}>Load demo data</Button>
        </EmptyState>
      ) : (
        <>
          <div className="fade-up mb-5 flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Icon name="search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
              <input className="input pl-9" placeholder="Search projects…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search projects" />
            </div>
            <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort projects">
              <option value="updated">Recently updated</option>
              <option value="name">Name A–Z</option>
              <option value="status">Status</option>
            </select>
            <span className="font-mono2 text-xs text-[var(--faint)]">{visible.length}/{projects.length}</span>
          </div>

          {visible.length === 0 ? (
            <EmptyState icon="search" title="No matches" body={`Nothing matches “${search}”. Try a different name, framework or description.`}>
              <Button onClick={() => setSearch("")}>Clear search</Button>
            </EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((p, i) => {
                const last = deps.filter((d) => d.projectId === p.id)[0];
                return (
                  <article key={p.id} className="card card-hover fade-up flex flex-col p-5" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <button className="font-display text-left text-lg font-bold leading-tight transition hover:text-[var(--cyan)]" onClick={() => setDrawerId(p.id)}>
                        {p.name}
                      </button>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="badge border-[rgba(96,165,250,0.4)] bg-[rgba(96,165,250,0.1)] text-[var(--blue)]">{p.framework.toUpperCase()}</span>
                      <EnvBadge env={p.environment} />
                      <span className="font-mono2 text-[0.66rem] text-[var(--faint)]">{p.region}</span>
                    </div>
                    <p className="mb-4 line-clamp-2 min-h-[2.4rem] text-sm leading-relaxed text-[var(--muted)]">{p.description || "No description yet."}</p>
                    <div className="mt-auto flex items-center justify-between border-t border-[rgba(146,176,255,0.09)] pt-3.5">
                      <div className="min-w-0 text-xs text-[var(--faint)]">
                        {last ? (
                          <span className="flex items-center gap-1.5">
                            <Icon name="git" size={12} className="text-[var(--cyan)]" />
                            <span className="font-mono2 text-[#9fd8e8]">{last.version}</span> · {timeAgo(last.createdAt)}
                          </span>
                        ) : (
                          "No deployments yet"
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {p.repoUrl && (
                          <a href={p.repoUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--cyan)]" aria-label={`Open ${p.name} repository`}>
                            <Icon name="external" size={14} />
                          </a>
                        )}
                        <button className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--cyan)]" onClick={() => setDrawerId(p.id)} aria-label={`Edit ${p.name}`}>
                          <Icon name="pencil" size={14} />
                        </button>
                        <button className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[rgba(251,113,133,0.12)] hover:text-[var(--rose)]" onClick={() => setDeleting(p)} aria-label={`Delete ${p.name}`}>
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Register a new project" wide>
        <ProjectForm initial={BLANK} onSaved={upsertLocal} submitLabel="Create project" />
      </Modal>

      {/* Detail / edit drawer */}
      <Drawer open={Boolean(drawerProject)} onClose={() => setDrawerId(null)} title={drawerProject?.name ?? "Project"}>
        {drawerProject && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={drawerProject.status} />
              <EnvBadge env={drawerProject.environment} />
              <span className="font-mono2 text-xs text-[var(--faint)]">created {timeAgo(drawerProject.createdAt)}</span>
            </div>
            <ProjectForm
              key={drawerProject.id + drawerProject.updatedAt}
              initial={{
                name: drawerProject.name,
                description: drawerProject.description,
                repoUrl: drawerProject.repoUrl,
                framework: drawerProject.framework,
                environment: drawerProject.environment,
                status: drawerProject.status,
                region: drawerProject.region,
              }}
              projectId={drawerProject.id}
              onSaved={upsertLocal}
              submitLabel="Save changes"
            />
            <div>
              <h3 className="eyebrow mb-2.5">Deployment history</h3>
              {deps.filter((d) => d.projectId === drawerProject.id).length === 0 ? (
                <p className="rounded-xl border border-[var(--line)] bg-[rgba(146,176,255,0.04)] px-4 py-5 text-center text-sm text-[var(--muted)]">No deployments for this project yet.</p>
              ) : (
                <ul className="space-y-2">
                  {deps.filter((d) => d.projectId === drawerProject.id).slice(0, 6).map((d) => (
                    <li key={d.id} className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[rgba(146,176,255,0.04)] px-3.5 py-2.5">
                      <span className="font-mono2 text-sm font-semibold text-[#bdf3ff]">{d.version}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-[var(--muted)]">{d.commitMessage}</span>
                      <StatusBadge status={d.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-[rgba(251,113,133,0.25)] bg-[rgba(251,113,133,0.05)] p-4">
              <h3 className="text-sm font-bold text-[#fda4af]">Danger zone</h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">Deleting this project also removes its deployment history. This cannot be undone.</p>
              <Button variant="danger-ghost" size="sm" icon="trash" className="mt-3" onClick={() => setDeleting(drawerProject)}>
                Delete project
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      <Confirm
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={`Delete ${deleting?.name ?? "project"}?`}
        body="This permanently removes the project and all of its deployment history from the database. The readiness checklist and copilot memory are not affected."
        confirmLabel="Delete project"
      />
    </>
  );
}