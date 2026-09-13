'use client';
// Panel sức khỏe HLS: poll /api/admin/hls-health mỗi 15s.
// Kênh stale (playlist đứng >15s) báo đỏ — backend watchdog sẽ tự restart source.
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Row {
  channel: string;
  ageSec: number | null;
  stale: boolean;
}

export function HlsHealth(): React.JSX.Element {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async (): Promise<void> => {
      try {
        const r = await api.hlsHealth();
        if (alive) {
          setRows(r);
          setErr('');
        }
      } catch {
        if (alive) setErr('Không đọc được trạng thái HLS.');
      }
    };
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const stale = rows.filter((r) => r.stale);

  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <h2 className="mb-2 font-semibold">
        SỨC KHỎE LUỒNG LIVE{' '}
        <span className="text-sm font-normal text-slate-500">
          ({rows.length} kênh{stale.length > 0 ? ` · ${stale.length} stale` : ''})
        </span>
      </h2>
      {err !== '' && <p className="text-sm text-red-600">{err}</p>}
      {rows.length === 0 && err === '' && (
        <p className="text-sm text-slate-500">Chưa có kênh live nào (Start 1 nguồn để sinh playlist).</p>
      )}
      {rows.map((r) => (
        <div key={r.channel} className="flex items-center gap-2 border-t py-1.5 text-sm">
          <span className={r.stale ? 'text-red-600' : 'text-green-600'}>●</span>
          <span className="font-mono">{r.channel}</span>
          <span className="ml-auto text-slate-500">
            {r.ageSec === null ? 'mất playlist' : `${r.ageSec}s trước`}
            {r.stale ? ' — stale, watchdog sẽ restart' : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
