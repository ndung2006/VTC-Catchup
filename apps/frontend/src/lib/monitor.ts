// lib/monitor.ts — Hàm thuần cho SystemMonitor (màu ngưỡng + cửa sổ trượt).
// Tách riêng để test được bằng node --test (không cần trình duyệt).

/** Màu ngưỡng PRD: xanh <60, cam 60–85, đỏ >85. */
export function thresholdColor(pct: number | null): string {
  if (pct === null) return '#94a3b8'; // xám khi không đo được
  if (pct > 85) return '#ef4444';
  if (pct >= 60) return '#f59e0b';
  return '#22c55e';
}

/** Thêm điểm mới vào cửa sổ trượt, giữ tối đa `max` điểm (~2 phút với 2s/điểm). */
export function pushPoint<T>(win: T[], p: T, max = 60): T[] {
  const next = [...win, p];
  return next.length > max ? next.slice(next.length - max) : next;
}
