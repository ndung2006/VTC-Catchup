// lib/hls.ts — Verify token HLS + gắn token vào playlist.
// Secret CHUNG với backend (VTC_HLS_SECRET đặt giống nhau 2 bên).
// Chạy ở route handler (Node runtime). Không dùng ở client (lộ secret).

import { createHmac, timingSafeEqual } from 'node:crypto';

export function hlsSecret(): string {
  return process.env['VTC_HLS_SECRET'] ?? '';
}

/** Danh sách secret verify (xoay không downtime): primary + previous. */
export function hlsSecrets(): string[] {
  const prev = (process.env['VTC_HLS_SECRET_PREVIOUS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  return [hlsSecret(), ...prev];
}

function channelOk(channel: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(channel);
}

function expectedToken(channel: string, expMs: number, secret: string): string {
  return createHmac('sha256', secret).update(`${channel}.${expMs}`, 'utf8').digest('hex');
}

function anyMatch(token: string, candidates: string[]): boolean {
  const a = Buffer.from(token, 'utf8');
  return candidates.some((c) => {
    const b = Buffer.from(c, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/** Token query (?token=&exp=) có hợp lệ cho kênh này không (ăn mọi secret đang hiệu lực). */
export function verifyHlsQuery(
  channel: string,
  expRaw: string | null,
  token: string | null,
  secrets: string | string[] = hlsSecrets(),
): boolean {
  const list = (Array.isArray(secrets) ? secrets : [secrets]).filter((s) => s !== '');
  if (list.length === 0 || token === null || expRaw === null) return false;
  if (!channelOk(channel)) return false;
  const expMs = Number(expRaw);
  if (!Number.isInteger(expMs) || expMs <= Date.now()) return false;
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  return anyMatch(
    token,
    list.map((s) => expectedToken(channel, expMs, s)),
  );
}

/** Pull token (?pull=, không hết hạn, cho đối tác kéo luồng) có hợp lệ không (ăn mọi secret đang hiệu lực). */
export function verifyPullQuery(channel: string, pull: string | null, secrets: string | string[] = hlsSecrets()): boolean {
  const list = (Array.isArray(secrets) ? secrets : [secrets]).filter((s) => s !== '');
  if (list.length === 0 || pull === null) return false;
  if (!channelOk(channel)) return false;
  if (!/^[0-9a-f]{64}$/.test(pull)) return false;
  return anyMatch(
    pull,
    list.map((s) => createHmac('sha256', s).update(`pull:${channel}`, 'utf8').digest('hex')),
  );
}

/**
 * Gắn query auth vào mọi URI trong playlist để hls.js/VLC/app đối tác tải được
 * segment (trình phát KHÔNG tự kế thừa query của URL playlist).
 * - Dòng trần (segment): `seg_001.ts` → `seg_001.ts?<query>`
 * - Thuộc tính URI="..." (EXT-X-MAP/KEY): gắn vào trong ngoặc kép.
 * Dòng bắt đầu bằng `#` (trừ URI="...") giữ nguyên.
 */
export function rewritePlaylist(text: string, query: string): string {
  return text
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (t === '') return line;
      if (t.startsWith('#')) {
        return line.includes('URI="') ? line.replace(/URI="([^"]+)"/g, (_, u: string) => `URI="${u}?${query}"`) : line;
      }
      if (t.includes('?')) return line; // đã có query thì thôi
      return `${line}?${query}`;
    })
    .join('\n');
}
