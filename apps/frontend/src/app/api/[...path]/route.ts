//=============================================================================
// app/api/[...path]/route.ts — Reverse proxy RUNTIME về backend.
// Lý do: rewrites() trong next.config.js bị "nướng" địa chỉ backend vào image
// lúc BUILD (standalone), đổi VTC_API_ORIGIN sau đó phải build lại mới ăn.
// Route handler này đọc env theo từng REQUEST → đổi biến trên Coolify chỉ cần
// restart container, không cần rebuild. Cookie HttpOnly đi cùng origin (same-origin).
// Hỗ trợ: JSON, SSE stream (/api/system/stream), download file nhị phân.
// Backend unreachable → 502 JSON rõ ràng thay vì treo.
//=============================================================================
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function backendBase(): string {
  return (process.env.VTC_API_ORIGIN ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
}

async function proxy(req: NextRequest, method: string): Promise<Response> {
  const segs = req.nextUrl.pathname.replace(/^\/api\/?/, '');
  const url = `${backendBase()}/api/${segs}${req.nextUrl.search}`;

  const headers = new Headers();
  const cookie = req.headers.get('cookie');
  if (cookie !== null) headers.set('cookie', cookie);
  const contentType = req.headers.get('content-type');
  if (contentType !== null) headers.set('content-type', contentType);

  const init: RequestInit = { method, headers, redirect: 'manual' };
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      const buf = await req.arrayBuffer();
      if (buf.byteLength > 0) init.body = buf;
    } catch {
      return Response.json({ error: 'Không đọc được body request' }, { status: 400 });
    }
  }

  // Timeout "time-to-first-byte" 25s (dưới ngưỡng 100s của Cloudflare → không bao giờ
  // treo tới HTTP 524). Chỉ giới hạn lúc CHỜ header; body (SSE/tải file) stream tự do.
  const TTFB_MS = 25_000;
  let upstream: Response;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    upstream = await Promise.race([
      fetch(url, init),
      new Promise<never>((_, rej) => {
        timer = setTimeout(() => rej(new Error(`backend không trả lời sau ${TTFB_MS / 1000}s`)), TTFB_MS);
      }),
    ]);
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'lỗi mạng';
    return Response.json(
      { error: `Không gọi được backend (${detail}) — kiểm tra Backend còn Running và VTC_API_ORIGIN` },
      { status: 504 },
    );
  } finally {
    clearTimeout(timer);
  }

  // Chuyển tiếp status + headers (bỏ hop-by-hop). Giữ set-cookie + stream body
  // nguyên vẹn cho SSE và tải file.
  const out = new Headers();
  upstream.headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (lk === 'content-encoding' || lk === 'transfer-encoding' || lk === 'connection') return;
    if (lk === 'set-cookie') return; // xử lý riêng bên dưới (giữ nhiều cookie)
    out.append(k, v);
  });
  const getSetCookie = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === 'function') {
    for (const c of getSetCookie.call(upstream.headers)) out.append('set-cookie', c);
  } else {
    const single = upstream.headers.get('set-cookie');
    if (single !== null) out.append('set-cookie', single);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export async function GET(req: NextRequest): Promise<Response> {
  return proxy(req, 'GET');
}
export async function POST(req: NextRequest): Promise<Response> {
  return proxy(req, 'POST');
}
export async function PUT(req: NextRequest): Promise<Response> {
  return proxy(req, 'PUT');
}
export async function DELETE(req: NextRequest): Promise<Response> {
  return proxy(req, 'DELETE');
}
export async function PATCH(req: NextRequest): Promise<Response> {
  return proxy(req, 'PATCH');
}
