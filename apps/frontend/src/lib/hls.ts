// lib/hls.ts — Verify token HLS + gắn token vào playlist.
// Secret CHUNG với backend (VTC_HLS_SECRET đặt giống nhau 2 bên).
// Chạy ở route handler (Node runtime). Không dùng ở client (lộ secret).

import { createHmac, timingSafeEqual } from 'node:crypto';

export function hlsSecret(): string {
  return process.env['VTC_HLS_SECRET'] ?? '';
}

function channelOk(channel: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(channel);
}

function expectedToken(channel: string, expMs: number, secret: string): string {
  return createHmac('sha256', secret).update(`${channel}.${expMs}`, 'utf8').digest('hex');
}

/** Token query (?token=&exp=) có hợp lệ cho kênh này không. */
export function verifyHlsQuery(channel: string, expRaw: string | null, token: string | null, secret = hlsSecret()): boolean {
  if (secret === '' || token === null || expRaw === null) return false;
  if (!channelOk(channel)) return false;
  const expMs = Number(expRaw);
  if (!Number.isInteger(expMs) || expMs <= Date.now()) return false;
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  const expect = expectedToken(channel, expMs, secret);
  const a = Buffer.from(token, 'utf8');
  const b = Buffer.from(expect, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Gắn token vào mọi URI trong playlist để hls.js/VLC tải được segment
 * (trình phát KHÔNG tự kế thừa query của URL playlist).
 * - Dòng trần (segment): `seg_001.ts` → `seg_001.ts?token=..&exp=..`
 * - Thuộc tính URI="..." (EXT-X-MAP/KEY): gắn vào trong ngoặc kép.
 * Dòng bắt đầu bằng `#` (trừ URI="...") giữ nguyên.
 */
export function rewritePlaylist(text: string, token: string, expMs: number): string {
  const q = `token=${token}&exp=${expMs}`;
  return text
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (t === '') return line;
      if (t.startsWith('#')) {
        return line.includes('URI="') ? line.replace(/URI="([^"]+)"/g, (_, u: string) => `URI="${u}?${q}"`) : line;
      }
      if (t.includes('?')) return line; // đã có query thì thôi
      return `${line}?${q}`;
    })
    .join('\n');
}
