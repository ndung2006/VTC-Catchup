// logger.test.ts — Ghi file + xoay vòng, không ném lỗi.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { getLogDir, logger, setLogDir } from './logger.js';

const dir = '/tmp/vtc-test-logs';

beforeEach(() => {
  rmSync(dir, { recursive: true, force: true });
  setLogDir(dir);
  process.env['VTC_LOG_MAX_BYTES'] = String(256);
  process.env['VTC_LOG_KEEP'] = '3';
});

describe('logger', () => {
  it('ghi stdout + file vtc.log', () => {
    logger.info('hello-logger');
    const txt = readFileSync(join(dir, 'vtc.log'), 'utf8');
    assert.match(txt, /\[INFO\] hello-logger/);
    assert.equal(getLogDir(), dir);
  });

  it('xoay file khi vượt max bytes, giữ bản cũ', () => {
    for (let i = 0; i < 30; i++) logger.info(`dòng log số ${i} — đệm cho đầy file`);
    assert.ok(existsSync(join(dir, 'vtc.log')));
    assert.ok(existsSync(join(dir, 'vtc.log.1')));
  });

  it('setLogDir(undefined) trả về env/mặc định, không crash', () => {
    setLogDir(undefined);
    delete process.env['VTC_LOG_DIR'];
    assert.equal(getLogDir(), 'storage/logs');
    setLogDir(dir);
  });
});
