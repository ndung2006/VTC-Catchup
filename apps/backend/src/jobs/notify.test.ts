// notify.test.ts + healthcheck.test.ts — Test không cần mạng/Telegram thật.
// Chạy: npm test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TelegramNotifier, processAlertText } from './notify.js';
import { checkHlsHealth } from './healthcheck.js';

describe('TelegramNotifier', () => {
  it('chưa cấu hình → log, không crash', async () => {
    const n = new TelegramNotifier({ botToken: '', chatId: '' });
    assert.equal(n.configured, false);
    assert.equal(await n.alert('k', 'test'), 'logged');
  });

  it('cooldown chặn spam cùng key', async () => {
    let calls = 0;
    const fakeFetch = (async () => {
      calls++;
      return new Response('{"ok":true}', { status: 200 });
    }) as typeof fetch;
    const n = new TelegramNotifier({ botToken: 'T', chatId: 'C', cooldownMs: 60_000, fetchFn: fakeFetch });
    assert.equal(await n.alert('src1', 'lỗi 1', 1000), 'sent');
    assert.equal(await n.alert('src1', 'lỗi 2', 2000), 'skipped-cooldown');
    assert.equal(await n.alert('src2', 'lỗi khác', 2000), 'sent'); // key khác đi qua
    assert.equal(calls, 2);
  });

  it('fetch lỗi mạng → error (không ném)', async () => {
    const bad = (async () => {
      throw new Error('net down');
    }) as typeof fetch;
    const n = new TelegramNotifier({ botToken: 'T', chatId: 'C', fetchFn: bad });
    assert.equal(await n.alert('k', 'x'), 'error');
  });

  it('fetch treo + timeout → error nhanh (không treo API)', async () => {
    const hanging = ((_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new Error('aborted')));
      })) as unknown as typeof fetch;
    const n = new TelegramNotifier({ botToken: 'T', chatId: 'C', fetchFn: hanging, timeoutMs: 50 });
    const t0 = Date.now();
    assert.equal(await n.alert('k', 'x'), 'error');
    assert.ok(Date.now() - t0 < 5000, 'phải timeout trong ~50ms, không treo');
  });

  it('template tin đúng chuẩn filter', () => {
    const t = processAlertText('TS8', 'mất tín hiệu đầu vào');
    assert.match(t, /\[CẢNH BÁO\]\[TS8\] mất tín hiệu đầu vào/);
  });
});

describe('checkHlsHealth', () => {
  it('fresh OK, cũ/missing stale', async () => {
    const base = mkdtempSync(join(tmpdir(), 'vtc-hls-'));
    mkdirSync(join(base, 'fresh'), { recursive: true });
    writeFileSync(join(base, 'fresh', 'index.m3u8'), '#m3u8');
    mkdirSync(join(base, 'old'), { recursive: true });
    writeFileSync(join(base, 'old', 'index.m3u8'), '#m3u8');
    const t = new Date(Date.now() - 120 * 1000);
    utimesSync(join(base, 'old', 'index.m3u8'), t, t);
    mkdirSync(join(base, 'empty'), { recursive: true }); // không có playlist

    const out = await checkHlsHealth(base, 15);
    const byName = Object.fromEntries(out.map((o) => [o.channel, o]));
    assert.equal(byName['fresh']?.stale, false);
    assert.equal(byName['old']?.stale, true);
    assert.equal(byName['empty']?.stale, true);
    assert.equal(byName['empty']?.ageSec, null);
  });

  it('thư mục không tồn tại → mảng rỗng', async () => {
    assert.deepEqual(await checkHlsHealth('/khong/ton/tai/xyz'), []);
  });
});
