import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';

const LIVE_DIR = process.env['VTC_LIVE_DIR'] || '/media/ramdisk/live';

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const filePath = join(LIVE_DIR, ...params.path);

  // Ngăn chặn Path Traversal
  if (!filePath.startsWith(LIVE_DIR)) {
    return new NextResponse('Forbidden', { status: 403 });
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
    headers.set('Content-Length', fileStat.size.toString());
    
    // .m3u8 không cache (luôn tươi), .ts cache 5s
    if (isM3U8) {
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      headers.set('Cache-Control', 'public, max-age=5');
    }

    // Node 18+ Response support Web Streams from Readable
    const stream = createReadStream(filePath);
    // @ts-ignore - Readable is compatible with BodyInit in Next.js
    return new NextResponse(stream, { headers });

  } catch (error) {
    return new NextResponse('Not found', { status: 404 });
  }
}
