//=============================================================================
// ConfigGenerator.ts — Sinh tsp .conf theo Source (MPTS), đúng PRD §3.1.
// Logic PORT 1-1 từ scripts/gen-conf.sh để shell và Node không lệch nhau.
//
// Công thức:
//   -I <input> -P vtcmonitor [-P fork "tsp ... HLS ..."]... (-O hls|-O drop)
//
// Nguyên tắc vàng (bài học 19k Zombie):
//  - KHÔNG bao giờ sinh --max-duration. Cắt chunk = -O hls --live 0.
//  - Mỗi Source đúng 1 file .conf = 1 process `tsp @file` 24/7.
//=============================================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { GeneratedConf, SourceConfig } from './types.js';

/** Thư mục mặc định chứa .conf (Prod: /opt/vtc/conf/sources). */
export const DEFAULT_CONF_DIR = process.env['VTC_CONF_DIR'] ?? 'storage/conf';

/** RAMDisk HLS live (Prod: /media/ramdisk/live). */
export const LIVE_BASE = process.env['VTC_LIVE_DIR'] ?? '/media/ramdisk/live';

/** HDD catchup (Prod: /mnt/Data/catchup/captures). */
export const CAPTURE_BASE = process.env['VTC_CAPTURE_DIR'] ?? '/mnt/Data/catchup/captures';

export class ConfigError extends Error {}

/** Kiểm tra 1 channel, ném ConfigError nếu sai. */
function assertChannel(c: SourceConfig['channels'][number], index: number): void {
  if (!/^[A-Za-z0-9_-]+$/.test(c.name)) {
    throw new ConfigError(`channel[${index}].name "${c.name}" chỉ cho [A-Za-z0-9_-] (tránh tách fork sai)`);
  }
  if (!Number.isInteger(c.serviceId) || c.serviceId < 0 || c.serviceId > 65535) {
    throw new ConfigError(`channel[${index}] serviceId phải 0..65535`);
  }
}

/**
 * Sinh nội dung .conf từ SourceConfig (thuần túy, không chạm đĩa).
 * @throws ConfigError khi cấu hình vô nghĩa (0 live + recordAll=false).
 */
export function generateConfText(source: SourceConfig): GeneratedConf {
  if (!/^[A-Za-z0-9_-]+$/.test(source.id)) {
    throw new ConfigError(`source.id "${source.id}" chỉ cho [A-Za-z0-9_-]`);
  }
  if (source.input.trim() === '') {
    throw new ConfigError('source.input rỗng');
  }
  source.channels.forEach(assertChannel);

  const live = source.channels.filter((c) => c.isLive);
  if (live.length === 0 && !source.recordAll) {
    // Conf chỉ còn `-O drop` là vô nghĩa, tốn CPU — chặn từ lúc sinh (như gen-conf.sh).
    throw new ConfigError(
      `Source ${source.id} vô nghĩa: 0 kênh live + recordAll=false (chỉ còn -O drop)`,
    );
  }

  const lines: string[] = [
    `# VTCCatchup conf — Source ${source.id} (rev ${source.confRev ?? 1}, 1 process 24/7)`,
    `# KHÔNG dùng --max-duration. Dừng bằng SIGTERM tới PGID.`,
    `-I ${source.input}`,
    `-P vtcmonitor`,
  ];
  for (const c of live) {
    // Mỗi kênh live = 1 nhánh fork HLS 5s trên RAMDisk (tmpfs ở Prod).
    lines.push(
      `-P fork "tsp -P zap ${c.serviceId} -O hls --duration 5 --live 5 ` +
        `--playlist ${LIVE_BASE}/${c.name}/index.m3u8 ${LIVE_BASE}/${c.name}/segment.ts"`,
    );
  }
  if (source.recordAll) {
    // --live 0 = ghi liên tục, tự cắt segment 60s, process không bao giờ tự sát.
    lines.push(`-O hls --duration 60 --live 0 ${CAPTURE_BASE}/${source.id}/catchup_%05d.ts`);
  } else {
    lines.push('-O drop');
  }
  return { content: lines.join('\n') + '\n', liveCount: live.length };
}

/**
 * Sinh + ghi file `storage/conf/<id>.conf`. Trả về nội dung + đường dẫn.
 * @param confDir thư mục chứa conf (mặc định storage/conf hoặc VTC_CONF_DIR).
 */
export function writeConfFile(source: SourceConfig, confDir: string = DEFAULT_CONF_DIR): GeneratedConf {
  const gen = generateConfText(source);
  const filePath = join(confDir, `${source.id}.conf`);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, gen.content, 'utf8');
  return { ...gen, filePath };
}
