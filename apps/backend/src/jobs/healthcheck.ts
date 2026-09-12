//=============================================================================
// healthcheck.ts — Phát hiện HLS stale: playlist đứng quá lâu dù process sống.
// (PRD rủi ro #4: màn hình đứng mà tưởng live — process vẫn RUNNING.)
// Quy tắc: mỗi thư mục con của liveBase là 1 kênh, đọc mtime index.m3u8.
// Thiếu file hoặc quá maxAgeSec → stale = true.
//=============================================================================
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface HlsChannelStatus {
  channel: string;
  /** Tuổi playlist (giây). null = không có file. */
  ageSec: number | null;
  stale: boolean;
}

/**
 * Quét RAMDisk live. maxAgeSec mặc định 15 (= 3 segment 5s, theo BRAINSTORM).
 */
export async function checkHlsHealth(liveBase: string, maxAgeSec = 15, now = Date.now()): Promise<HlsChannelStatus[]> {
  let dirs: string[];
  try {
    dirs = await readdir(liveBase);
  } catch {
    return [];
  }
  const out: HlsChannelStatus[] = [];
  for (const d of dirs) {
    const playlist = join(liveBase, d, 'index.m3u8');
    try {
      const st = await stat(playlist);
      if (!st.isFile()) {
        out.push({ channel: d, ageSec: null, stale: true });
        continue;
      }
      const ageSec = Math.max(0, Math.round((now - st.mtimeMs) / 1000));
      out.push({ channel: d, ageSec, stale: ageSec > maxAgeSec });
    } catch {
      out.push({ channel: d, ageSec: null, stale: true });
    }
  }
  return out.sort((a, b) => (a.channel < b.channel ? -1 : 1));
}
