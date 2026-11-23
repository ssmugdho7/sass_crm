export type Me = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  is_super_admin: boolean;
  role: { id: number; name: string; slug: string } | null;
  permissions: string[];
  tenant: {
    id: number;
    name: string;
    slug: string;
    status: string;
    trial_ends_at: string | null;
    plan: { id: number; name: string; slug: string } | null;
    modules: string[];
  } | null;
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public errors: Record<string, string[]> = {}) {
    super(message);
  }
}

const KEY = { crm: "crm_token", platform: "platform_token" } as const;
export type Realm = keyof typeof KEY;

export const tokens = {
  get: (realm: Realm) => (typeof window === "undefined" ? null : localStorage.getItem(KEY[realm])),
  set: (realm: Realm, t: string) => localStorage.setItem(KEY[realm], t),
  clear: (realm: Realm) => localStorage.removeItem(KEY[realm]),
};

/** fetch wrapper for the Laravel API (proxied at /api). Pass realm to attach that bearer token. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; realm?: Realm } = {}): Promise<T> {
  const token = opts.realm ? tokens.get(opts.realm) : null;
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: {
      Accept: "application/json",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && opts.realm) tokens.clear(opts.realm);
    throw new ApiError(res.status, data.message ?? "Request failed", data.errors ?? {});
  }
  return data as T;
}

/** Shorthands bound to a realm. */
export const crm = <T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}) => api<T>(path, { ...opts, realm: "crm" });
export const platform = <T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}) => api<T>(path, { ...opts, realm: "platform" });

export const can = (me: Me | null, perm: string) => !!me && (me.permissions.includes("*") || me.permissions.includes(perm));
export const hasModule = (me: Me | null, key: string) => !!me?.tenant?.modules.includes(key);
export const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents ?? 0) / 100);
