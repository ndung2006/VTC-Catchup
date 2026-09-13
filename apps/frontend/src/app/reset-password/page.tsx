'use client';
// Trang đặt lại mật khẩu từ link ?token=... (token 15 phút, 1 lần).
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

function ResetForm(): React.JSX.Element {
  const token = useSearchParams().get('token') ?? '';
  const router = useRouter();
  const [nw, setNw] = useState('');
  const [cf, setCf] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setMsg('');
    if (token === '') return setMsg('Link khôi phục thiếu token.');
    if (nw.length < 8) return setMsg('Mật khẩu mới tối thiểu 8 ký tự.');
    if (nw !== cf) return setMsg('Xác nhận mật khẩu không khớp.');
    try {
      await api.resetPassword(token, nw);
      router.push('/login');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Đặt lại mật khẩu thất bại');
    }
  };

  return (
    <form onSubmit={submit} className="w-80 space-y-3 rounded-xl bg-white p-6 shadow">
      <h1 className="text-lg font-bold">Đặt lại mật khẩu</h1>
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
      {msg !== '' && <p className="text-sm text-red-600">{msg}</p>}
      <button className="w-full rounded bg-slate-900 py-2 text-sm text-white">Đặt lại</button>
      <Link href="/login" className="block text-center text-sm text-slate-500">
        Quay lại đăng nhập
      </Link>
    </form>
  );
}

export default function ResetPassword(): React.JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Suspense>
        <ResetForm />
      </Suspense>
    </main>
  );
}
