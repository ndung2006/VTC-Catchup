import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { hlsSecret, rewritePlaylist, verifyHlsQuery, verifyPullQuery } from '@/lib/hls';

const LIVE_DIR = process.env['VTC_LIVE_DIR'] || '/media/ramdisk/live';
// CORS mở cho app đối tác (web player kéo cross-origin); auth vẫn bằng token.
const CORS = { 'Access-Control-Allow-Origin': '*' };

let warnedNoSecret = false;

function denied(message: string): NextResponse {
  return new NextResponse(message, { status: 403, headers: { ...CORS } });
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
  });
}

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

  // Cửa auth — 1 trong 2 (xem POST /api/hls-tokens và /api/pull-tokens ở backend):
  // - ?token=&exp= : link có hạn dùng (web player, VLC ad-hoc).
  // - ?pull=      : link kéo luồng không hạn cho đối tác (VTVgo).
  const secret = hlsSecret();
  const url = new URL(req.url);
  let query: string;
  if (secret === '') {
    if (!warnedNoSecret) {
      warnedNoSecret = true;
      // eslint-disable-next-line no-console
      console.warn('[vtc-hls] VTC_HLS_SECRET chưa đặt — cho qua mọi request (chỉ dùng lúc dev). Prod BẮT BUỘC đặt giống backend!');
    }
    query = url.searchParams.toString();
  } else {
    const pull = url.searchParams.get('pull');
    if (pull !== null) {
      if (!verifyPullQuery(channel, pull, secret)) return denied('Link kéo luồng không hợp lệ');
      query = `pull=${pull}`;
    } else {
      const exp = url.searchParams.get('exp') ?? '';
      const token = url.searchParams.get('token') ?? '';
      if (!verifyHlsQuery(channel, exp, token, secret)) {
        return denied('Link xem hết hạn hoặc không hợp lệ');
      }
      query = `token=${token}&exp=${exp}`;
    }
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return new NextResponse('Not found', { status: 404 });
    }

    const ext = filePath.split('.').pop()?.toLowerCase();
    const isM3U8 = ext === 'm3u8';

    // Header như Nginx
    const headers = new Headers({ ...CORS });
    headers.set('Content-Type', isM3U8 ? 'application/vnd.apple.mpegurl' : 'video/mp2t');

    if (isM3U8) {
      // Gắn auth vào từng URI segment để trình phát tải được (nó không tự
      // kế thừa query của URL playlist).
      const raw = await readFile(filePath, 'utf8');
      const body = secret === '' ? raw : rewritePlaylist(raw, query);
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
