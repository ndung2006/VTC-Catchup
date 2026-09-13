'use client';
// Trang đổi mật khẩu (dùng API /api/auth/change-password đã gate JWT).
import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { api } from '@/lib/api';

export default function AccountPage(): React.JSX.Element {
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [cf, setCf] = useState('');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setMsg('');
    setOk(false);
    if (nw.length < 8) return setMsg('Mật khẩu mới tối thiểu 8 ký tự.');
    if (nw !== cf) return setMsg('Xác nhận mật khẩu không khớp.');
    try {
      await api.changePassword(cur, nw, cf);
      setOk(true);
      setMsg('Đổi mật khẩu thành công.');
      setCur('');
      setNw('');
      setCf('');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Đổi mật khẩu thất bại');
    }
  };

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1">
        <Header onMenu={() => {}} />
        <main className="space-y-4 p-4">
          <h1 className="text-xl font-bold">TÀI KHOẢN — ĐỔI MẬT KHẨU</h1>
          <form onSubmit={submit} className="max-w-md space-y-3 rounded-xl bg-white p-4 shadow">
            <input
              type="password"
              value={cur}
              onChange={(e) => setCur(e.target.value)}
              placeholder="Mật khẩu hiện tại"
              className="w-full rounded border px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={nw}
              onChange={(e) => setNw(e.target.value)}
              placeholder="Mật khẩu mới (≥ 8 ký tự)"
              className="w-full rounded border px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={cf}
              onChange={(e) => setCf(e.target.value)}
              placeholder="Xác nhận mật khẩu mới"
              className="w-full rounded border px-3 py-2 text-sm"
            />
            {msg !== '' && <p className={`text-sm ${ok ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}
            <button className="rounded bg-slate-900 px-4 py-2 text-sm text-white">Đổi mật khẩu</button>
          </form>
        </main>
      </div>
    </div>
  );
}
