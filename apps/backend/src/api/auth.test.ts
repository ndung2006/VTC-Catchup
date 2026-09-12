// auth.test.ts — Test đơn vị bcrypt/JWT/cookie/reset (không cần HTTP).
// Chạy: npm test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkPassword,
  hashPassword,
  jwtClearCookie,
  jwtSetCookie,
  newResetToken,
  parseCookies,
  signToken,
  verifyToken,
} from './auth.js';
import { Store } from './store.js';

describe('auth', () => {
  it('bcrypt hash khác nhau mỗi lần, compare đúng', async () => {
    const h1 = await hashPassword('mat-khau-123');
    const h2 = await hashPassword('mat-khau-123');
    assert.notEqual(h1, h2); // salt ngẫu nhiên
    assert.equal(await checkPassword('mat-khau-123', h1), true);
    assert.equal(await checkPassword('sai', h1), false);
  });

  it('JWT sign/verify, sai secret → lỗi', () => {
    const t = signToken({ username: 'admin', role: 'admin' }, 's3cret');
    assert.equal(verifyToken(t, 's3cret').sub, 'admin');
    assert.throws(() => verifyToken(t, 'khac'), /invalid signature/);
    assert.throws(() => verifyToken('khong-phai-jwt', 's3cret'), /jwt/);
  });

  it('cookie HttpOnly + parse ngược', () => {
    const set = jwtSetCookie('abc.def.ghi');
    assert.match(set, /HttpOnly/);
    assert.match(set, /Path=\//);
    const back = parseCookies('a=1; vtc_token=abc.def.ghi; b=2');
    assert.equal(back['vtc_token'], 'abc.def.ghi');
    assert.equal(jwtClearCookie().includes('Max-Age=0'), true);
  });

  it('reset token duy nhất + hết hạn 15 phút', () => {
    assert.notEqual(newResetToken(), newResetToken());
    const s = new Store();
    s.seedUser({ username: 'u', email: 'u@x.y', passwordHash: 'h', role: 'admin' });
    s.setResetToken('u', 'tok123', Date.now() + 1000);
    assert.equal(s.findUserByResetToken('tok123')?.username, 'u');
    s.setResetToken('u', 'tokHet', Date.now() - 1); // đã hết hạn
    assert.equal(s.findUserByResetToken('tokHet'), undefined);
  });
});
