// lib/api.ts — Gọi backend qua rewrite /api (cùng origin → cookie đi kèm).
// Dùng `credentials: 'include'` để trình duyệt gửi HttpOnly cookie vtc_token.

export interface Source {
  id: string;
  input: string;
  channels: { name: string; serviceId: number; isLive: boolean }[];
  recordAll: boolean;
  retentionDays?: number;
  confRev: number;
  status: 'RUNNING' | 'STOPPED' | 'ERROR';
  pid?: number;
}

export interface SystemEvent {
  cpu: number;
  ram_used: number;
  ram_percent: number;
  disk_percent: number | null;
  network: { tx: number; rx: number };
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface SourceInput {
  id: string;
  input: string;
  channels: { name: string; serviceId: number; isLive: boolean }[];
  recordAll: boolean;
  retentionDays?: number;
}

export interface PreviewConf {
  conf: string;
  liveCount: number;
  confRev: number;
}

export const api = {
  sources: () => fetch('/api/sources', { credentials: 'include' }).then((r) => json<Source[]>(r)),
  source: (id: string) =>
    fetch(`/api/sources/${encodeURIComponent(id)}`, { credentials: 'include' }).then((r) => json<Source>(r)),
  createSource: (body: SourceInput) =>
    fetch('/api/sources', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => json<Source>(r)),
  updateSource: (id: string, patch: Partial<SourceInput>) =>
    fetch(`/api/sources/${encodeURIComponent(id)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }).then((r) => json<Source>(r)),
  deleteSource: (id: string) =>
    fetch(`/api/sources/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' }).then((r) =>
      json<{ ok: boolean }>(r),
    ),
  startSource: (id: string) =>
    fetch(`/api/sources/${encodeURIComponent(id)}/start`, { method: 'POST', credentials: 'include' }).then((r) =>
      json<{ ok: boolean; pid: number; conf: string }>(r),
    ),
  stopSource: (id: string) =>
    fetch(`/api/sources/${encodeURIComponent(id)}/stop`, { method: 'POST', credentials: 'include' }).then((r) =>
      json<{ ok: boolean }>(r),
    ),
  previewConf: (id: string) =>
    fetch(`/api/sources/${encodeURIComponent(id)}/preview-conf`, { credentials: 'include' }).then((r) =>
      json<PreviewConf>(r),
    ),
  login: (username: string, password: string) =>
    fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then((r) => json<{ ok: boolean }>(r)),
  logout: () =>
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).then((r) => json<{ ok: boolean }>(r)),
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    fetch('/api/auth/change-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    }).then((r) => json<{ ok: boolean }>(r)),
  forgotPassword: (email: string) =>
    fetch('/api/auth/forgot-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    }).then((r) => json<{ message: string }>(r)),
  resetPassword: (token: string, newPassword: string) =>
    fetch('/api/auth/reset-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    }).then((r) => json<{ ok: boolean }>(r)),
  hlsHealth: () =>
    fetch('/api/admin/hls-health', { credentials: 'include' }).then((r) =>
      json<{ channel: string; ageSec: number | null; stale: boolean }[]>(r),
    ),
  notifyStatus: () =>
    fetch('/api/admin/notify-status', { credentials: 'include' }).then((r) =>
      json<{ configured: boolean }>(r),
    ),
  notifyTest: () =>
    fetch('/api/admin/notify-test', { method: 'POST', credentials: 'include' }).then((r) =>
      json<{ result: string; configured: boolean }>(r),
    ),
  configBackup: () =>
    fetch('/api/admin/config-backup', { credentials: 'include' }).then((r) =>
      json<{ exportedAt: string; sources: Source[] }>(r),
    ),
  configRestore: (sources: unknown[]) =>
    fetch('/api/admin/config-restore', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sources }),
    }).then((r) => json<{ ok: boolean; count: number }>(r)),
};

/** URL playlist HLS của 1 kênh (Nginx serve từ RAMDisk). */
export function hlsUrl(channelName: string): string {
  const base = process.env.NEXT_PUBLIC_HLS_BASE ?? '/hls';
  return `${base}/${channelName}/index.m3u8`;
}
