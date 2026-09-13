// mailer.test.ts — Không cần mạng: chỉ test nhánh chưa cấu hình + helper.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetLink, sendResetMail, smtpConfigured } from './mailer.js';
import { setLogDir } from '../core/logger.js';

beforeEach(() => {
  setLogDir('/tmp/vtc-test-mail-logs');
  delete process.env['VTC_SMTP_HOST'];
});

describe('mailer', () => {
  it('chưa cấu hình SMTP → logged, không ném', async () => {
    assert.equal(smtpConfigured(), false);
    assert.equal(await sendResetMail('a@x.y', 'tok123'), 'logged');
  });

  it('resetLink ghép đúng base + token', () => {
    process.env['VTC_PUBLIC_BASE_URL'] = 'https://vidu.test/';
    assert.equal(resetLink('tok123'), 'https://vidu.test/reset-password?token=tok123');
    delete process.env['VTC_PUBLIC_BASE_URL'];
  });
});
