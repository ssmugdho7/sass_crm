"use client";

/* eslint-disable @next/next/no-img-element -- previews of user-uploaded / external images. */
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, crm, money, toCents, tokens } from "@/lib/api";
import { Badge, Button, Card, ErrorText, Field, Input, Modal, Select, Spinner, Textarea, fieldError } from "@/components/ui";

/** Multipart upload to /app/website/upload (crm() only sends JSON). */
export async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const token = tokens.get("crm");
  const res = await fetch("/api/app/website/upload", {
    method: "POST",
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.errors?.file?.[0] ?? data.message ?? "Upload failed", data.errors ?? {});
  return data.url as string;
}

/** URL text input + upload button + preview. */
export function ImageInput({ value, onChange, label, error }: { value: string | null | undefined; onChange: (url: string | null) => void; label: string; error?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setErr("Image must be 5 MB or smaller.");
    setBusy(true);
    setErr(null);
    try {
      onChange(await uploadImage(f));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <Field label={label} error={err ?? error}>
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : "No image"}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Input value={value ?? ""} placeholder="https://… or upload" onChange={(e) => onChange(e.target.value || null)} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => ref.current?.click()}>{busy ? "Uploading…" : "Upload"}</Button>
            {value && <Button type="button" variant="ghost" onClick={() => onChange(null)}>Remove</Button>}
          </div>
          <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
      </div>
    </Field>
  );
}

/** Gallery editor: list of image URLs with upload. */
export function ImagesInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    const urls: string[] = [];
    try {
      for (const f of Array.from(files)) urls.push(await uploadImage(f));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      onChange([...value, ...urls]);
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <Field label="Gallery photos" error={err ?? undefined}>
      <div className="grid grid-cols-4 gap-2">
        {value.map((u, i) => (
          <div key={u + i} className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100">
            <img src={u} alt="" className="h-full w-full object-cover" />
            <button type="button" aria-label="Remove photo" onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute right-1 top-1 rounded bg-slate-900/70 px-1.5 text-xs text-white opacity-100 group-hover:opacity-100 focus:opacity-100 sm:opacity-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">✕</button>
          </div>
        ))}
        <button type="button" disabled={busy} onClick={() => ref.current?.click()}
          className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 hover:border-brand-500 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          {busy ? "…" : "+ Add"}
        </button>
      </div>
      <input ref={ref} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => add(e.target.files)} />
    </Field>
  );
}

type FieldType = "text" | "textarea" | "image" | "images" | "money" | "bool" | "rating" | "date" | "icon";
export type FieldDef = { key: string; label: string; type?: FieldType; required?: boolean; placeholder?: string };
type Row = { id: number; sort: number; is_published?: boolean } & Record<string, unknown>;

const ICON_OPTIONS = ["home", "kitchen", "bath", "addition", "roof", "commercial", "tools"];

/** Generic list editor for a website collection: add / edit / delete / reorder / publish. */
export function CollectionEditor({ collection, title, fields, summary, empty, onChanged, extraActions, reloadKey }: {
  collection: string;
  title: string;
  fields: FieldDef[];
  summary: (r: Row) => { primary: string; secondary?: string | null; image?: string | null };
  empty: string;
  onChanged: () => void;
  extraActions?: React.ReactNode;
  reloadKey?: number;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<unknown>(null);
  const publishable = fields.some((f) => f.key === "is_published");

  const load = useCallback(async () => {
    try {
      setRows(await crm<Row[]>(`/app/website/${collection}`));
    } catch (e) {
      setError(e);
    }
  }, [collection]);
  useEffect(() => {
    let live = true;
    crm<Row[]>(`/app/website/${collection}`)
      .then((r) => live && setRows(r))
      .catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [collection, reloadKey]);

  const blank = () => Object.fromEntries(fields.map((f) => [f.key, f.type === "bool" ? true : f.type === "rating" ? 5 : f.type === "images" ? [] : null]));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setFormError(null);
    const body = Object.fromEntries(fields.map((f) => [f.key, editing[f.key] === "" ? null : editing[f.key]]));
    try {
      if (editing.id) await crm(`/app/website/${collection}/${editing.id}`, { method: "PUT", body });
      else await crm(`/app/website/${collection}`, { method: "POST", body });
      setEditing(null);
      await load();
      onChanged();
    } catch (err) {
      setFormError(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Row) => {
    if (!confirm(`Delete "${summary(r).primary}"?`)) return;
    try {
      await crm(`/app/website/${collection}/${r.id}`, { method: "DELETE" });
      await load();
      onChanged();
    } catch (e) {
      setError(e);
    }
  };

  const move = async (i: number, dir: -1 | 1) => {
    if (!rows) return;
    const next = [...rows];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
    try {
      setRows(await crm<Row[]>(`/app/website/${collection}/reorder`, { method: "POST", body: { ids: next.map((r) => r.id) } }));
    } catch (e) {
      setError(e);
      load();
    }
  };

  const togglePublish = async (r: Row) => {
    try {
      await crm(`/app/website/${collection}/${r.id}`, { method: "PUT", body: { is_published: !r.is_published } });
      await load();
      onChanged();
    } catch (e) {
      setError(e);
    }
  };

  const set = (k: string, v: unknown) => setEditing((cur) => ({ ...cur, [k]: v }));

  return (
    <Card title={title} actions={<div className="flex flex-wrap justify-end gap-2">{extraActions}<Button onClick={() => { setFormError(null); setEditing(blank()); }}>+ Add</Button></div>}>
      <ErrorText error={error} />
      {!rows ? (
        <Spinner />
      ) : !rows.length ? (
        <p className="py-10 text-center text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r, i) => {
            const s = summary(r);
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:flex-nowrap">
                <div className="flex flex-col">
                  <button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded px-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">▲</button>
                  <button aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="rounded px-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">▼</button>
                </div>
                {s.image !== undefined && (
                  <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100">
                    {s.image && <img src={s.image} alt="" className="h-full w-full object-cover" />}
                  </div>
                )}
                <div className="min-w-0 flex-1 basis-32">
                  <p className="truncate font-medium text-slate-900">{s.primary}</p>
                  {s.secondary && <p className="truncate text-sm text-slate-500">{s.secondary}</p>}
                </div>
                {publishable && (
                  <button type="button" onClick={() => togglePublish(r)} title="Toggle visibility on the website" aria-label={`${r.is_published ? "Unpublish" : "Publish"} ${s.primary}`} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                    <Badge tone={r.is_published ? "green" : "gray"}>{r.is_published ? "Published" : "Draft"}</Badge>
                  </button>
                )}
                <div className="ml-auto flex shrink-0 gap-1">
                  <Button variant="ghost" className="px-3" onClick={() => { setFormError(null); setEditing({ ...r }); }}>Edit</Button>
                  <Button variant="ghost" className="px-3 text-red-600" onClick={() => remove(r)}>Delete</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!editing} title={editing?.id ? `Edit ${title.toLowerCase()}` : `Add to ${title.toLowerCase()}`} onClose={() => setEditing(null)}>
        {editing && (
          <form onSubmit={save} className="space-y-4">
            {fields.map((f) => {
              const v = editing[f.key];
              const err = fieldError(formError, f.key);
              switch (f.type) {
                case "textarea":
                  return <Field key={f.key} label={f.label} error={err}><Textarea rows={4} value={(v as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} required={f.required} placeholder={f.placeholder} /></Field>;
                case "image":
                  return <ImageInput key={f.key} label={f.label} value={v as string | null} onChange={(u) => set(f.key, u)} error={err} />;
                case "images":
                  return <ImagesInput key={f.key} value={(v as string[]) ?? []} onChange={(u) => set(f.key, u)} />;
                case "money":
                  return (
                    <Field key={f.key} label={f.label} error={err}>
                      <Input type="number" min={0} step="0.01" inputMode="decimal" placeholder="Leave blank to hide"
                        value={v == null ? "" : Number(v) / 100}
                        onChange={(e) => set(f.key, toCents(e.target.value))} />
                    </Field>
                  );
                case "bool":
                  return (
                    <label key={f.key} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input type="checkbox" checked={!!v} onChange={(e) => set(f.key, e.target.checked)} className="h-4 w-4 accent-brand-600" />
                      {f.label}
                    </label>
                  );
                case "rating":
                  return (
                    <Field key={f.key} label={f.label} error={err}>
                      <Select value={String(v ?? 5)} onChange={(e) => set(f.key, Number(e.target.value))}>
                        {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)} ({n})</option>)}
                      </Select>
                    </Field>
                  );
                case "date":
                  return <Field key={f.key} label={f.label} error={err}><Input type="date" value={((v as string) ?? "").slice(0, 10)} onChange={(e) => set(f.key, e.target.value || null)} /></Field>;
                case "icon":
                  return (
                    <Field key={f.key} label={f.label} error={err}>
                      <Select value={(v as string) ?? ""} onChange={(e) => set(f.key, e.target.value || null)}>
                        <option value="">Default (tools)</option>
                        {ICON_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </Select>
                    </Field>
                  );
                default:
                  return <Field key={f.key} label={f.label} error={err}><Input value={(v as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} required={f.required} placeholder={f.placeholder} /></Field>;
              }
            })}
            <ErrorText error={formError instanceof ApiError && Object.keys(formError.errors).length ? null : formError} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  );
}

export const priceLabel = (cents: unknown) => (typeof cents === "number" && cents > 0 ? `From ${money(cents)}` : null);
