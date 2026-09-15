// hlsToken.test.ts — Ký/verify HMAC, không cần mạng.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampHlsTtl,
  partnerKeys,
  signHlsToken,
  signPullToken,
  verifyHlsToken,
  verifyPartnerKey,
  verifyPullToken,
} from './hlsToken.js';

const SECRET = 'test-hls-secret';

describe('hlsToken', () => {
  it('ký đúng thì qua, hết hạn/sai kênh/sai secret thì rớt', () => {
    const exp = Date.now() + 60_000;
    const tok = signHlsToken('vtv1', exp, SECRET);
    assert.equal(tok.length, 64);
    assert.equal(verifyHlsToken('vtv1', exp, tok, SECRET), true);
    assert.equal(verifyHlsToken('vtv1', exp, tok, 'secret-khac'), false);
    assert.equal(verifyHlsToken('vtv2', exp, tok, SECRET), false);
    assert.equal(verifyHlsToken('vtv1', Date.now() - 1000, tok, SECRET), false);
    assert.equal(verifyHlsToken('vtv1', exp, '0'.repeat(64), SECRET), false);
    assert.equal(verifyHlsToken('ten xau', exp, tok, SECRET), false);
    assert.equal(verifyHlsToken('vtv1', exp, 'khong-phai-hex', SECRET), false);
  });

  it('clamp TTL 5..1440, mặc định 120', () => {
    assert.equal(clampHlsTtl(1), 5);
    assert.equal(clampHlsTtl(2000), 1440);
    assert.equal(clampHlsTtl(undefined), 120);
    assert.equal(clampHlsTtl(NaN), 120);
    assert.equal(clampHlsTtl(30), 30);
  });

  it('pull token gắn theo kênh, không hết hạn, sai là rớt', () => {
    const tok = signPullToken('vtv1', SECRET);
    assert.equal(tok.length, 64);
    assert.equal(verifyPullToken('vtv1', tok, SECRET), true);
    assert.equal(verifyPullToken('vtv2', tok, SECRET), false);
    assert.equal(verifyPullToken('vtv1', tok, 'secret-khac'), false);
    assert.equal(verifyPullToken('vtv1', '0'.repeat(64), SECRET), false);
    // Pull token khác hẳn token có hạn (miền ký khác nhau).
    const exp = Date.now() + 60000;
    assert.notEqual(tok, signHlsToken('vtv1', exp, SECRET));
  });

  it('partner keys: parse name:key, verify Bearer, sai là null', () => {
    process.env['VTC_PARTNER_KEYS'] = 'vtvgo:KEYMOT, don-gian';
    try {
      assert.deepEqual(partnerKeys(), [
        { name: 'vtvgo', key: 'KEYMOT' },
        { name: 'partner', key: 'don-gian' },
      ]);
      assert.equal(verifyPartnerKey('Bearer KEYMOT'), 'vtvgo');
      assert.equal(verifyPartnerKey('Bearer don-gian'), 'partner');
      assert.equal(verifyPartnerKey('Bearer sai'), null);
      assert.equal(verifyPartnerKey('Basic KEYMOT'), null);
      assert.equal(verifyPartnerKey(undefined), null);
    } finally {
      delete process.env['VTC_PARTNER_KEYS'];
    }
    assert.deepEqual(partnerKeys(), []);
  });
});
