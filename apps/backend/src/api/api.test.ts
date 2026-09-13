// api.test.ts — Test integration qua HTTP thật (fetch + port ngẫu nhiên).
// Fake tsp = script exec sleep để start/stop nhanh, không cần TSDuck.
// Mọi /api/* (trừ /api/auth/*) cần cookie login — đúng gate Prod.
// Chạy: npm test
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { createApi } from './server.js';

const fakeTsp = '/tmp/vtc-fake-api-tsp.sh';
const confDir = '/tmp/vtc-test-conf';
const capsDir = '/tmp/vtc-test-caps';
const expsDir = '/tmp/vtc-test-exps';

before(() => {
  // Fake tsp 2 chế độ: arg cuối *.ts → ghi output + exit 0 (export);
  // ngược lại exec sleep (start/stop process dài hạn).
  writeFileSync(
    fakeTsp,
    '#!/bin/sh\nout=""; for a in "$@"; do out="$a"; done\ncase "$out" in *.ts) echo fake-ts > "$out"; exit 0;; esac\nexec sleep 60\n',
    'utf8',
  );
  chmodSync(fakeTsp, 0o755);
  mkdirSync(confDir, { recursive: true });
  mkdirSync(expsDir, { recursive: true });
});

describe('API', { concurrency: false }, () => {
  let base = '';
  let close = async (): Promise<void> => {};
  let cookie = '';

  const req = (path: string, init?: RequestInit): Promise<Response> =>
    fetch(`${base}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), ...(cookie === '' ? {} : { cookie }) },
    });

  before(async () => {
    const api = createApi({
      port: 0,
      confDir,
      captureDir: capsDir,
      exportsDir: expsDir,
      tspBin: fakeTsp,
      jwtSecret: 'test-secret',
      adminPass: 'test-admin-123',
      persist: false,
      autoStart: false,
    });
    const s = await api.listen(0);
    base = `http://127.0.0.1:${s.port}`;
    close = s.close;
    // Login lấy cookie cho các test sau.
    const r = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'test-admin-123' }),
    });
    assert.equal(r.status, 200);
    const setCookie = r.headers.get('set-cookie') ?? '';
    assert.match(setCookie, /vtc_token=.+;.*HttpOnly/);
    cookie = setCookie.split(';')[0] ?? '';
  });

  after(async () => {
    await close();
  });

  const body = {
    id: 'API1',
    input: 'file /tmp/vtc-demo/input.ts --repeat',
    recordAll: true,
    channels: [
      { name: 'demo4', serviceId: 4, isLive: true },
      { name: 'demo5', serviceId: 5, isLive: true },
    ],
  };

  it('health OK (public)', async () => {
    const r = await fetch(`${base}/health`);
    assert.equal(r.status, 200);
  });

  it('không cookie → 401, không chạm được nghiệp vụ', async () => {
    const r = await fetch(`${base}/api/sources`);
    assert.equal(r.status, 401);
    const r2 = await fetch(`${base}/api/sources/API1/start`, { method: 'POST' });
    assert.equal(r2.status, 401);
  });

  it('login sai → 401 message chung', async () => {
    const r = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'sai-hoan-toan' }),
    });
    assert.equal(r.status, 401);
  });

  it('CRUD source', async () => {
    let r = await req('/api/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(r.status, 201);

    r = await req('/api/sources');
    const list = (await r.json()) as unknown[];
    assert.equal(list.length, 1);

    r = await req('/api/sources/API1');
    assert.equal(r.status, 200);
  });

  it('preview-conf khớp logic ConfigGenerator', async () => {
    const r = await req('/api/sources/API1/preview-conf');
    assert.equal(r.status, 200);
    const j = (await r.json()) as { conf: string; liveCount: number };
    assert.equal(j.liveCount, 2);
    assert.match(j.conf, /-P fork "tsp -P zap 4/);
  });

  it('start rồi stop (fake tsp, kill nhóm thật)', async () => {
    let r = await req('/api/sources/API1/start', { method: 'POST' });
    assert.equal(r.status, 200);
    const started = (await r.json()) as { pid: number };
    assert.ok(started.pid > 0);

    r = await req('/api/sources/API1');
    const cur = (await r.json()) as { status: string };
    assert.equal(cur.status, 'RUNNING');

    r = await req('/api/sources/API1/stop', { method: 'POST' });
    assert.equal(r.status, 200);
  });

  it('đổi mật khẩu: sai hiện tại → 401, đúng → login lại được', async () => {
    let r = await req('/api/auth/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'sai', newPassword: 'newpass-123', confirmPassword: 'newpass-123' }),
    });
    assert.equal(r.status, 401);

    r = await req('/api/auth/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'test-admin-123', newPassword: 'short', confirmPassword: 'short' }),
    });
    assert.equal(r.status, 400); // < 8 ký tự

    r = await req('/api/auth/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'test-admin-123',
        newPassword: 'newpass-123',
        confirmPassword: 'newpass-123',
      }),
    });
    assert.equal(r.status, 200);

    // Login bằng MK mới OK, MK cũ fail.
    const ok = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'newpass-123' }),
    });
    assert.equal(ok.status, 200);
    const bad = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'test-admin-123' }),
    });
    assert.equal(bad.status, 401);
  });

  it('forgot-password luôn message chung (kể cả email lạ)', async () => {
    for (const email of ['admin@vtc.local', 'khong-ton-tai@x.y']) {
      const r = await fetch(`${base}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      assert.equal(r.status, 200);
      const j = (await r.json()) as { message: string };
      assert.match(j.message, /Nếu email hợp lệ/);
    }
  });

  it('admin gc + hls-health cần auth', async () => {
    const noAuth = await fetch(`${base}/api/admin/gc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(noAuth.status, 401);

    const r = await req('/api/admin/gc', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dryRun: true }),
    });
    assert.equal(r.status, 200);
    const j = (await r.json()) as { deleted: string[]; dryRun: boolean };
    assert.equal(j.dryRun, true);
    assert.ok(Array.isArray(j.deleted));

    const h = await req('/api/admin/hls-health');
    assert.equal(h.status, 200);
  });

  it('exports: submit → poll SUCCESS → download → delete', async () => {
    // Seed 1 chunk catchup cho S1 phủ thời điểm hiện tại.
    const { mkdirSync: mk, writeFileSync: wr } = await import('node:fs');
    mk(`${capsDir}/S1`, { recursive: true });
    wr(`${capsDir}/S1/catchup_00001.ts`, 'chunk');

    const noAuth = await fetch(`${base}/api/exports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(noAuth.status, 401);

    const now = Date.now();
    let r = await req('/api/exports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channelName: 'demo4',
        sourceId: 'S1',
        serviceId: 4,
        inPoint: new Date(now - 120_000).toISOString(),
        outPoint: new Date(now).toISOString(),
      }),
    });
    assert.equal(r.status, 200);
    const created = (await r.json()) as { id: string; status: string };
    assert.ok(created.id.startsWith('exp_'));

    // Poll tới trạng thái cuối (fake tsp xong trong ms).
    let job: { status: string; fileName: string } = { status: created.status, fileName: '' };
    for (let i = 0; i < 100 && (job.status === 'QUEUED' || job.status === 'PROCESSING'); i++) {
      await new Promise((rr) => setTimeout(rr, 50));
      const g = await req(`/api/exports/${created.id}`);
      job = (await g.json()) as typeof job;
    }
    assert.equal(job.status, 'SUCCESS');

    // Download stream: header attachment + đúng tên file.
    r = await req(`/api/exports/${created.id}/download`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-disposition') ?? '', /attachment; filename="demo4_.*\.ts"/);
    assert.match(await r.text(), /fake-ts/);

    // Xóa: file vật lý mất + record mất.
    r = await req(`/api/exports/${created.id}`, { method: 'DELETE' });
    assert.equal(r.status, 200);
    r = await req(`/api/exports/${created.id}`);
    assert.equal(r.status, 404);
  });

  it('exports: quá 6h bị chặn 400', async () => {
    const now = Date.now();
    const r = await req('/api/exports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channelName: 'demo4',
        sourceId: 'S1',
        serviceId: 4,
        inPoint: new Date(now - 7 * 3600_000).toISOString(),
        outPoint: new Date(now).toISOString(),
      }),
    });
    assert.equal(r.status, 400);
    const j = (await r.json()) as { error: string };
    assert.match(j.error, /tối đa 6 tiếng/);
  });

  it('từ chối config xấu ngay lúc tạo (400, không đợi tới start)', async () => {
    const r = await req('/api/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, id: 'BAD', channels: [{ name: 'ten xau', serviceId: 1, isLive: true }] }),
    });
    assert.equal(r.status, 400);
  });

  it('SSE cần auth + trả event', async () => {
    const noAuth = await fetch(`${base}/api/system/stream`);
    assert.equal(noAuth.status, 401);
    await noAuth.body?.cancel().catch(() => {});

    const ctrl = new AbortController();
    const res = await req('/api/system/stream', { signal: ctrl.signal });
    assert.equal(res.status, 200);
    const reader = res.body?.getReader();
    assert.ok(reader);
    const { value } = await reader.read();
    const txt = new TextDecoder().decode(value);
    assert.match(txt, /^data: /);
    const payload = JSON.parse(txt.replace(/^data: /, '')) as { cpu: number };
    assert.equal(typeof payload.cpu, 'number');
    ctrl.abort();
    await reader.cancel().catch(() => {});
  });
});

describe('auto-restart', { concurrency: false }, () => {
  it('crash → ERROR → tự RUNNING lại; stop tay thì ở yên STOPPED', async () => {
    const fakeExit = '/tmp/vtc-fake-exit3.sh';
    writeFileSync(fakeExit, '#!/bin/sh\nexit 3\n', 'utf8');
    chmodSync(fakeExit, 0o755);

    const api = createApi({
      port: 0,
      confDir: '/tmp/vtc-test-conf2',
      tspBin: fakeExit,
      jwtSecret: 'test-secret',
      adminPass: 'pw-restart-1',
      restartDelayMs: 150,
      persist: false,
      autoStart: false,
    });
    const s = await api.listen(0);
    const b = `http://127.0.0.1:${s.port}`;
    try {
      const login = await fetch(`${b}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'pw-restart-1' }),
      });
      const ck = (login.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
      const authed = (path: string, init?: RequestInit): Promise<Response> =>
        fetch(`${b}${path}`, { ...init, headers: { ...(init?.headers ?? {}), cookie: ck } });

      await authed('/api/sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: 'RS1',
          input: 'file /tmp/x.ts',
          recordAll: false,
          channels: [{ name: 'c1', serviceId: 1, isLive: true }],
        }),
      });
      await authed('/api/sources/RS1/start', { method: 'POST' });

      // Fake exit 3 ngay → vòng restart 150ms đưa về RUNNING (poll tối đa 5s).
      let status = '';
      for (let i = 0; i < 100; i++) {
        const cur = (await (await authed('/api/sources/RS1')).json()) as { status: string };
        status = cur.status;
        if (status === 'RUNNING' && i > 2) break; // qua ít nhất 1 vòng crash→restart
        await new Promise((rr) => setTimeout(rr, 50));
      }
      assert.equal(status, 'RUNNING');

      // Stop tay → ở yên STOPPED (không restart nữa).
      await authed('/api/sources/RS1/stop', { method: 'POST' });
      await new Promise((rr) => setTimeout(rr, 400));
      const after = (await (await authed('/api/sources/RS1')).json()) as { status: string };
      assert.equal(after.status, 'STOPPED');
    } finally {
      await s.close();
    }
  });
});
