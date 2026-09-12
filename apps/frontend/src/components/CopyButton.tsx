// CopyButton — Sao chép link .m3u8 cho VLC/đối tác (PRD §4.7) + tooltip.
'use client';
import { useState } from 'react';

export function CopyButton({ text }: { text: string }): React.JSX.Element {
  const [done, setDone] = useState(false);
  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(text);
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };
  return (
    <button
      onClick={copy}
      title={done ? 'Đã sao chép' : 'Sao chép'}
      className="shrink-0 rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
    >
      {done ? 'Đã sao chép' : 'Copy'}
    </button>
  );
}
