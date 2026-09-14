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

function channelOk(channel: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(channel);
}

export function signHlsToken(channel: string, exp: number, secret: string = hlsSecret()): string {
  return createHmac('sha256', secret).update(`${channel}.${exp}`, 'utf8').digest('hex');
}

/** expMs: epoch ms. Trả false khi hết hạn, sai kênh, sai định dạng, sai chữ ký. */
export function verifyHlsToken(channel: string, expMs: number, token: string, secret: string = hlsSecret()): boolean {
  if (!channelOk(channel)) return false;
  if (!Number.isInteger(expMs) || expMs <= Date.now()) return false;
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  const expect = signHlsToken(channel, expMs, secret);
  const a = Buffer.from(token, 'utf8');
  const b = Buffer.from(expect, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** TTL phút kẹp 5..1440 (mặc định 120). */
export function clampHlsTtl(ttlMinutes: unknown): number {
  const v = typeof ttlMinutes === 'number' ? Math.floor(ttlMinutes) : 120;
  if (!Number.isFinite(v)) return 120;
  return Math.min(MAX_HLS_TTL_MIN, Math.max(MIN_HLS_TTL_MIN, v));
}
