'use client';
//=============================================================================
// SystemMonitor — Giám sát tài nguyên qua SSE backend (PRD §4.2).
//  - GET /api/system/stream (rewrite về backend), event mỗi 2s.
//  - RadialBar CPU/RAM/DISK đổi màu theo ngưỡng, AreaChart mạng Tx/Rx.
//  - EventSource tự reconnect; unmount thì close (không rò kết nối).
//=============================================================================
import { useEffect, useState } from 'react';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { pushPoint, thresholdColor } from '@/lib/monitor';
import type { SystemEvent } from '@/lib/api';

interface NetPoint {
  t: string;
  tx: number;
  rx: number;
}

export function SystemMonitor(): React.JSX.Element {
  const [sys, setSys] = useState<SystemEvent | null>(null);
  const [net, setNet] = useState<NetPoint[]>([]);
  const [down, setDown] = useState(false);

  useEffect(() => {
    const es = new EventSource('/api/system/stream');
    es.onmessage = (ev: MessageEvent<string>) => {
      const s = JSON.parse(ev.data) as SystemEvent;
      setSys(s);
      setDown(false);
      setNet((w) =>
        pushPoint(w, {
          t: new Date().toLocaleTimeString('vi-VN'),
          tx: s.network.tx,
          rx: s.network.rx,
        }),
      );
    };
    es.onerror = () => setDown(true);
    return () => es.close();
  }, []);

  const gauges = [
    { name: 'CPU', value: sys?.cpu ?? 0 },
    { name: 'RAM', value: sys?.ram_percent ?? 0 },
    { name: 'DISK', value: sys?.disk_percent ?? 0 },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl bg-white p-4 shadow">
        <h2 className="mb-2 font-semibold">Tài nguyên {down && <span className="text-red-500">(mất kết nối SSE)</span>}</h2>
        <ResponsiveContainer width="100%" height={220}>
          <RadialBarChart innerRadius="20%" outerRadius="90%" data={gauges} startAngle={180} endAngle={0}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} label={{ fill: '#334155', position: 'insideStart' }} />
            <Tooltip formatter={(v: unknown) => `${String(v)}%`} />
          </RadialBarChart>
        </ResponsiveContainer>
        <ul className="mt-2 space-y-1 text-sm">
          {gauges.map((g) => (
            <li key={g.name} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: thresholdColor(g.value) }} />
              {g.name}: {g.value}%
            </li>
          ))}
          <li className="text-slate-500">RAM dùng: {sys?.ram_used ?? 0} MB</li>
        </ul>
      </div>
      <div className="rounded-xl bg-white p-4 shadow">
        <h2 className="mb-2 font-semibold">Mạng (bytes tích lũy)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={net}>
            <XAxis dataKey="t" tick={false} />
            <YAxis tickFormatter={(v: number) => `${Math.round(v / 1024 / 1024)}M`} width={45} />
            <Tooltip />
            <Area type="monotone" dataKey="tx" name="Tải lên" stroke="#ef4444" fill="#fecaca" />
            <Area type="monotone" dataKey="rx" name="Tải về" stroke="#22c55e" fill="#bbf7d0" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
