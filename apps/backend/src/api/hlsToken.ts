//=============================================================================
// hlsToken.ts — Link xem HLS có hạn dùng (chống hotlink/VLC chùa).
// Token = HMAC-SHA256(secret, "<channel>.<exp>"), hex. Frontend (route /hls)
// verify độc lập bằng cùng secret (VTC_HLS_SECRET đặt giống nhau ở 2 bên) nên
// mỗi segment không tốn thêm 1 vòng gọi backend. Kênh đổi tên thì token cũ
// tự vô hiệu vì channel nằm trong chuỗi ký.
//=============================================================================
import { createHmac, timingSafeEqual } from 'node:crypto';

export const MIN_HLS_TTL_MIN = 5;
export const MAX_HLS_TTL_MIN = 1440;

export function hlsSecret(): string {
  return process.env['VTC_HLS_SECRET'] ?? process.env['VTC_JWT_SECRET'] ?? 'dev-only-insecure-secret';
}

/**
 * Danh sách secret verify (xoay không downtime): [primary, ...previous].
 * Ký LUÔN bằng primary; verify chấp nhận bất kỳ secret nào trong danh sách.
 * VTC_HLS_SECRET_PREVIOUS: secret cũ (1 hoặc nhiều, cách nhau phẩy), gỡ sau
 * khi đối tác đã đổi hết sang link mới.
 */
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

export function signHlsToken(channel: string, exp: number, secret: string = hlsSecret()): string {
  return createHmac('sha256', secret).update(`${channel}.${exp}`, 'utf8').digest('hex');
}

/** expMs: epoch ms. Trả false khi hết hạn, sai kênh, sai định dạng, sai chữ ký. */
export function verifyHlsToken(
  channel: string,
  expMs: number,
  token: string,
  secrets: string | string[] = hlsSecrets(),
): boolean {
  if (!channelOk(channel)) return false;
  if (!Number.isInteger(expMs) || expMs <= Date.now()) return false;
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  const list = Array.isArray(secrets) ? secrets : [secrets];
  const a = Buffer.from(token, 'utf8');
  return list.some((secret) => {
    const b = Buffer.from(signHlsToken(channel, expMs, secret), 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/** TTL phút kẹp 5..1440 (mặc định 120). */
export function clampHlsTtl(ttlMinutes: unknown): number {
  const v = typeof ttlMinutes === 'number' ? Math.floor(ttlMinutes) : 120;
  if (!Number.isFinite(v)) return 120;
  return Math.min(MAX_HLS_TTL_MIN, Math.max(MIN_HLS_TTL_MIN, v));
}

//-- Link kéo luồng cho đối tác (VTVgo): không hết hạn, gắn theo kênh --------

/** Ký pull token cho 1 kênh (sống tới khi đổi secret). */
export function signPullToken(channel: string, secret: string = hlsSecret()): string {
  return createHmac('sha256', secret).update(`pull:${channel}`, 'utf8').digest('hex');
}

export function verifyPullToken(channel: string, token: string, secrets: string | string[] = hlsSecrets()): boolean {
  if (!channelOk(channel)) return false;
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  const list = Array.isArray(secrets) ? secrets : [secrets];
  const a = Buffer.from(token, 'utf8');
  return list.some((secret) => {
    const b = Buffer.from(signPullToken(channel, secret), 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

//-- Khóa API cho máy-gọi-máy (Bearer) ---------------------------------------

export interface PartnerKey {
  name: string;
  key: string;
}

/**
 * VTC_PARTNER_KEYS="vtvgo:KEY1,giamsat:KEY2" (hoặc key trần cách nhau phẩy).
 * Đọc env mỗi lần gọi để test/đổi không cần restart logic.
 */
export function partnerKeys(): PartnerKey[] {
  const raw = process.env['VTC_PARTNER_KEYS'] ?? '';
  const out: PartnerKey[] = [];
  for (const part of raw.split(',')) {
    const t = part.trim();
    if (t === '') continue;
    const i = t.indexOf(':');
    if (i > 0) out.push({ name: t.slice(0, i).trim() || 'partner', key: t.slice(i + 1).trim() });
    else out.push({ name: 'partner', key: t });
  }
  return out.filter((p) => p.key !== '');
}

/** Header "Authorization: Bearer <key>" hợp lệ → tên đối tác, else null. */
export function verifyPartnerKey(authHeader: unknown): string | null {
  if (typeof authHeader !== 'string') return null;
  const m = /^Bearer (.+)$/.exec(authHeader.trim());
  if (m === null) return null;
  const give = m[1] ?? '';
  for (const p of partnerKeys()) {
    const a = Buffer.from(give, 'utf8');
    const b = Buffer.from(p.key, 'utf8');
    if (a.length === b.length && timingSafeEqual(a, b)) return p.name;
  }
  return null;
}
