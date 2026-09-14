'use client';
// Trang xem Live 1 kênh (PRD §4.7): tiêu đề IN HOA + Stream Link Box + Copy + player.
// Link xem có token hạn dùng (cấp ở POST /api/hls-tokens, mặc định 120 phút):
// dán sang VLC/máy khác vẫn chạy tới khi hết hạn. Token hết hạn giữa chừng →
// tự cấp lại tối đa 2 lần (không hiện lỗi rồi đứng hình).
// Đổi kênh = đổi route (không reload trang); LivePlayer tự destroy instance cũ.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { LivePlayer } from '@/components/LivePlayer';
import { CopyButton } from '@/components/CopyButton';
import { api, type Source } from '@/lib/api';

export default function ChannelPage({ params }: { params: { id: string } }): React.JSX.Element {
  const name = decodeURIComponent(params.id);
  const [found, setFound] = useState<boolean | null>(null);
  const [link, setLink] = useState('');
  const [linkErr, setLinkErr] = useState('');
  const retries = useRef(0);

  const mint = useCallback(async () => {
    setLinkErr('');
    try {
      const [ss, tok] = await Promise.all([
        api.sources(),
        api.hlsToken(name, 240).catch(() => null),
      ]);
      setFound(ss.some((s) => s.channels.some((c) => c.name === name)));
      if (tok === null) {
        setLinkErr('Không cấp được link xem (kênh chưa có hoặc chưa đăng nhập).');
        return;
      }
      setLink(`${window.location.origin}${tok.url}`);
    } catch {
      setFound(false);
      setLinkErr('Không tải được thông tin kênh.');
    }
  }, [name]);

  useEffect(() => {
    retries.current = 0;
    setLink('');
    void mint();
  }, [mint]);

  const handleFatal = useCallback(() => {
    // Token hết hạn giữa lúc xem (403) → cấp lại, tối đa 2 lần chống lặp vô hạn.
    if (retries.current >= 2) return;
    retries.current += 1;
    void mint();
  }, [mint]);

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1">
        <Header onMenu={() => {}} />
        <main className="space-y-4 p-4">
          <h1 className="text-xl font-bold uppercase">Kênh truyền hình {name}</h1>
          <div className="flex items-center gap-2 rounded-xl bg-white p-3 shadow">
            <code className="flex-1 truncate text-sm text-slate-600">
              {link === '' ? 'Đang cấp link xem…' : link}
            </code>
            {link !== '' && <CopyButton text={link} />}
          </div>
          <p className="text-xs text-slate-500">
            Link có hạn dùng 4 giờ — hết hạn thì trình phát tự cấp lại, link đã copy đi thì hết hiệu lực.
          </p>
          {linkErr !== '' && <p className="text-sm text-red-600">{linkErr}</p>}
          {found === false && (
            <p className="text-sm text-amber-600">Kênh chưa có trong cấu hình — kiểm tra /sources.</p>
          )}
          {link !== '' && <LivePlayer streamUrl={link} onFatal={handleFatal} />}
        </main>
      </div>
    </div>
  );
}
