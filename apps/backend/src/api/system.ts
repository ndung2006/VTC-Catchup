//=============================================================================
// system.ts — Đọc tài nguyên máy cho SSE (thay lib systeminformation ở Phase 2).
// Chỉ dùng node:os + /proc (Linux) để giữ zero-dependency.
// Payload khớp PRD §7: {cpu, ram_used, disk_percent, network:{tx, rx}}.
//=============================================================================
import { cpus, totalmem, freemem } from 'node:os';
import { readFile } from 'node:fs/promises';

export interface SystemSnapshot {
  /** % CPU tổng (trung bình mọi core). */
  cpu: number;
  /** RAM đã dùng, MB. */
  ramUsedMb: number;
  /** % RAM đã dùng. */
  ramPercent: number;
  /** % disk phân vùng captures (null khi không đo được). */
  diskPercent: number | null;
  network: { txBytes: number; rxBytes: number };
}

let prevIdle = 0;
let prevTotal = 0;

/** % CPU từ lúc gọi trước (lần đầu trả 0). */
export function cpuPercent(): number {
  let idle = 0;
  let total = 0;
  for (const c of cpus()) {
    idle += c.times.idle;
    total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
  }
  const dIdle = idle - prevIdle;
  const dTotal = total - prevTotal;
  prevIdle = idle;
  prevTotal = total;
  if (dTotal <= 0) return 0;
  return Math.round(((1 - dIdle / dTotal) * 100) * 10) / 10;
}

/** Đọc bytes mạng tổng từ /proc/net/dev (Linux). Ngoài Linux trả 0. */
export async function netBytes(): Promise<{ tx: number; rx: number }> {
  try {
    const txt = await readFile('/proc/net/dev', 'utf8');
    let rx = 0;
    let tx = 0;
    for (const line of txt.split('\n')) {
      const m = /^\s*\w+:(\s*\d+){16}/.exec(line);
      if (m === null) continue;
      const nums = line.split(':')[1]?.trim().split(/\s+/).map(Number) ?? [];
      rx += nums[0] ?? 0;
      tx += nums[8] ?? 0;
    }
    return { tx, rx };
  } catch {
    return { tx: 0, rx: 0 };
  }
}

/** % disk đã dùng tại path (dùng `df`, null khi lỗi). */
export async function diskPercentAt(path: string): Promise<number | null> {
  try {
    const { execFile } = await import('node:child_process');
    const out: string = await new Promise((resolve, reject) => {
      execFile('df', ['-P', path], (err, stdout) => (err ? reject(err) : resolve(stdout)));
    });
    const line = out.trim().split('\n')[1] ?? '';
    const pct = /(\d+)%/.exec(line)?.[1];
    return pct === undefined ? null : Number(pct);
  } catch {
    return null;
  }
}

/** Chụp 1 snapshot đầy đủ. */
export async function snapshot(captureDir: string): Promise<SystemSnapshot> {
  const total = totalmem();
  const free = freemem();
  const used = total - free;
  const [net, disk] = await Promise.all([netBytes(), diskPercentAt(captureDir)]);
  return {
    cpu: cpuPercent(),
    ramUsedMb: Math.round(used / 1024 / 1024),
    ramPercent: Math.round(((used / total) * 100) * 10) / 10,
    diskPercent: disk,
    network: { txBytes: net.tx, rxBytes: net.rx },
  };
}
