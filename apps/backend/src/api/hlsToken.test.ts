// hlsToken.test.ts — Ký/verify HMAC, không cần mạng.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clampHlsTtl, signHlsToken, verifyHlsToken } from './hlsToken.js';

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
});
