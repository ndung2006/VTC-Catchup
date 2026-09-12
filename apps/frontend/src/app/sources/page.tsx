'use client';
// Trang /sources tối thiểu cho Phase 4: liệt kê nguồn + trạng thái (CRUD đầy đủ ở Phase sau).
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { api, type Source } from '@/lib/api';

export default function SourcesPage(): React.JSX.Element {
  const [sources, setSources] = useState<Source[]>([]);
  useEffect(() => {
    api.sources().then(setSources).catch(() => setSources([]));
  }, []);
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1">
        <Header onMenu={() => {}} />
        <main className="space-y-4 p-4">
          <h1 className="text-xl font-bold">NGUỒN TÍN HIỆU</h1>
          {sources.map((s) => (
            <div key={s.id} className="rounded-xl bg-white p-4 shadow">
              <p className="font-semibold">
                {s.id} <span className="text-sm text-slate-500">({s.status})</span>
              </p>
              <p className="text-sm text-slate-600">{s.input}</p>
              <p className="text-sm">Kênh: {s.channels.map((c) => c.name).join(', ') || '—'}</p>
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}
