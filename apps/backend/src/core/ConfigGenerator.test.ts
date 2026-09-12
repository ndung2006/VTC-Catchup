// ConfigGenerator.test.ts — Test không cần tsp thật (thuần logic sinh conf).
// Chạy: npm test  (tsx --test src/core/*.test.ts)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError, generateConfText } from './ConfigGenerator.js';

describe('ConfigGenerator', () => {
  it('sinh MPTS 2 kênh live + record_all (đúng PRD §3.1)', () => {
    const gen = generateConfText({
      id: 'DEMO',
      input: 'file /tmp/vtc-demo/input.ts --repeat',
      recordAll: true,
      channels: [
        { name: 'demo4', serviceId: 4, isLive: true },
        { name: 'demo5', serviceId: 5, isLive: true },
      ],
    });
    assert.equal(gen.liveCount, 2);
    assert.match(gen.content, /-I file \/tmp\/vtc-demo\/input\.ts --repeat/);
    assert.match(gen.content, /-P vtcmonitor/);
    assert.match(gen.content, /-P fork "tsp -P zap 4 -O hls/);
    assert.match(gen.content, /-P fork "tsp -P zap 5 -O hls/);
    assert.match(gen.content, /-O hls --duration 60 --live 0/);
    // Nguyên tắc vàng: không có *dòng option* nào dùng max-duration
    // (comment giải thích được phép nhắc tên flag).
    const optionLines = gen.content.split('\n').filter((l) => l.startsWith('-'));
    assert.ok(optionLines.every((l) => !l.includes('max-duration')));
  });

  it('recordAll=false sinh -O drop', () => {
    const gen = generateConfText({
      id: 'LIVE',
      input: 'ip 239.69.69.10:1234',
      recordAll: false,
      channels: [{ name: 'DongNai1', serviceId: 2004, isLive: true }],
    });
    assert.match(gen.content, /-O drop/);
  });

  it('chặn conf vô nghĩa (0 live + record false)', () => {
    assert.throws(
      () =>
        generateConfText({ id: 'EMPTY', input: 'file /tmp/a.ts', recordAll: false, channels: [] }),
      ConfigError,
    );
  });

  it('chặn tên kênh có dấu cách (vỡ fork quote)', () => {
    assert.throws(
      () =>
        generateConfText({
          id: 'X',
          input: 'file /tmp/a.ts',
          recordAll: true,
          channels: [{ name: 'kenh xau', serviceId: 1, isLive: true }],
        }),
      ConfigError,
    );
  });
});
