import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { hlsSecret, rewritePlaylist, verifyHlsQuery } from '@/lib/hls';

const LIVE_DIR = process.env['VTC_LIVE_DIR'] || '/media/ramdisk/live';

let warnedNoSecret = false;

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const [channel, ...rest] = params.path;
  // Chỉ phục vụ đúng dạng /hls/<kenh>/<file> — kênh là 1 segment path.
  if (channel === undefined || rest.length === 0 || rest.some((p) => p === '' || p === '.' || p === '..')) {
    return new NextResponse('Not found', { status: 404 });
  }
  const filePath = join(LIVE_DIR, channel, ...rest);

  // Ngăn chặn Path Traversal
  if (!filePath.startsWith(LIVE_DIR + '/')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Cửa token: link xem có hạn dùng (?token=&exp=), cấp ở POST /api/hls-tokens.
  const secret = hlsSecret();
  if (secret === '') {
    if (!warnedNoSecret) {
      warnedNoSecret = true;
      // eslint-disable-next-line no-console
      console.warn('[vtc-hls] VTC_HLS_SECRET chưa đặt — cho qua mọi request (chỉ dùng lúc dev). Prod BẮT BUỘC đặt giống backend!');
    }
  } else {
    const url = new URL(req.url);
    const ok = verifyHlsQuery(channel, url.searchParams.get('exp'), url.searchParams.get('token'), secret);
    if (!ok) return new NextResponse('Link xem hết hạn hoặc không hợp lệ', { status: 403 });
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return new NextResponse('Not found', { status: 404 });
    }

    const ext = filePath.split('.').pop()?.toLowerCase();
    const isM3U8 = ext === 'm3u8';

    // Header như Nginx
    const headers = new Headers();
    headers.set('Content-Type', isM3U8 ? 'application/vnd.apple.mpegurl' : 'video/mp2t');

    if (isM3U8) {
      // Gắn token vào từng URI segment để trình phát tải được (nó không tự
      // kế thừa query của URL playlist).
      const url = new URL(req.url);
      const token = url.searchParams.get('token') ?? '';
      const expMs = Number(url.searchParams.get('exp') ?? '0');
      const raw = await readFile(filePath, 'utf8');
      const body = secret === '' ? raw : rewritePlaylist(raw, token, Number.isInteger(expMs) ? expMs : 0);
      headers.set('Content-Length', Buffer.byteLength(body).toString());
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return new NextResponse(body, { headers });
    }

    // .ts cache 5s
    headers.set('Content-Length', fileStat.size.toString());
    headers.set('Cache-Control', 'public, max-age=5');

    // Node 18+ Response support Web Streams from Readable
    const stream = createReadStream(filePath);
    // @ts-ignore - Readable is compatible with BodyInit in Next.js
    return new NextResponse(stream, { headers });
  } catch (error) {
    return new NextResponse('Not found', { status: 404 });
  }
}
