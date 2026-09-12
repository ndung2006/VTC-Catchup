'use client';
// Trang xem Live 1 kênh (PRD §4.7): tiêu đề IN HOA + Stream Link Box + Copy + player.
// Đổi kênh = đổi route (không reload trang); LivePlayer tự destroy instance cũ.
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { LivePlayer } from '@/components/LivePlayer';
import { CopyButton } from '@/components/CopyButton';
import { api, hlsUrl, type Source } from '@/lib/api';

export default function ChannelPage({ params }: { params: { id: string } }): React.JSX.Element {
  const name = decodeURIComponent(params.id);
  const [found, setFound] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .sources()
      .then((ss: Source[]) => setFound(ss.some((s) => s.channels.some((c) => c.name === name))))
      .catch(() => setFound(false));
  }, [name]);

  const url = hlsUrl(name);

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1">
        <Header onMenu={() => {}} />
        <main className="space-y-4 p-4">
          <h1 className="text-xl font-bold uppercase">Kênh truyền hình {name}</h1>
          <div className="flex items-center gap-2 rounded-xl bg-white p-3 shadow">
            <code className="flex-1 truncate text-sm text-slate-600">{url}</code>
            <CopyButton text={url} />
          </div>
          {found === false && (
            <p className="text-sm text-amber-600">Kênh chưa có trong cấu hình — kiểm tra /sources.</p>
          )}
          <LivePlayer streamUrl={url} />
        </main>
      </div>
    </div>
  );
}
