'use client';
// Trang quên mật khẩu: luôn hiện message chung (chống enumerate email).
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function ForgotPassword(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setMsg('');
    try {
      const r = await api.forgotPassword(email);
      setMsg(r.message);
    } catch {
      setMsg('Gửi yêu cầu thất bại, thử lại sau.');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={submit} className="w-80 space-y-3 rounded-xl bg-white p-6 shadow">
        <h1 className="text-lg font-bold">Quên mật khẩu</h1>
        <p className="text-sm text-slate-500">Nhập email tài khoản để nhận link khôi phục.</p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          className="w-full rounded border px-3 py-2 text-sm"
        />
        {msg !== '' && <p className="text-sm text-slate-600">{msg}</p>}
        <button className="w-full rounded bg-slate-900 py-2 text-sm text-white">Gửi link khôi phục</button>
        <Link href="/login" className="block text-center text-sm text-slate-500">
          Quay lại đăng nhập
        </Link>
      </form>
    </main>
  );
}
