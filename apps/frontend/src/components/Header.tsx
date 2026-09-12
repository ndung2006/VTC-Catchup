'use client';
// Header light: hamburger toggle + avatar dropdown (đổi MK, logout).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export function Header({ onMenu }: { onMenu: () => void }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const logout = async (): Promise<void> => {
    await api.logout().catch(() => {});
    router.push('/login');
  };

  return (
    <header className="flex items-center justify-between border-b bg-white px-4 py-2">
      <button onClick={onMenu} aria-label="menu" className="rounded p-2 hover:bg-slate-100">
        ☰
      </button>
      <div className="relative">
        <button onClick={() => setOpen((v) => !v)} className="h-9 w-9 rounded-full bg-slate-900 text-sm text-white">
          A
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-44 rounded border bg-white py-1 text-sm shadow">
            <button
              onClick={logout}
              className="block w-full px-3 py-2 text-left hover:bg-slate-100"
            >
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
