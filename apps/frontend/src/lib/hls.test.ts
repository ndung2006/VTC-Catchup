// hls.test.ts — Verify token + viết lại playlist (thuần túy, không đĩa/mạng).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { rewritePlaylist, verifyHlsQuery } from './hls.js';

const SECRET = 'test-hls-secret-fe';
const tok = (channel: string, exp: number): string =>
  createHmac('sha256', SECRET).update(`${channel}.${exp}`, 'utf8').digest('hex');

describe('verifyHlsQuery', () => {
  it('đúng thì qua; sai/hết hạn/thiếu secret thì rớt', () => {
    const exp = Date.now() + 60000;
    assert.equal(verifyHlsQuery('vtv1', String(exp), tok('vtv1', exp), SECRET), true);
    assert.equal(verifyHlsQuery('vtv1', String(exp), tok('vtv1', exp), 'khac'), false);
    assert.equal(verifyHlsQuery('vtv2', String(exp), tok('vtv1', exp), SECRET), false);
    assert.equal(verifyHlsQuery('vtv1', String(Date.now() - 1), tok('vtv1', Date.now() - 1), SECRET), false);
    assert.equal(verifyHlsQuery('vtv1', String(exp), null, SECRET), false);
    assert.equal(verifyHlsQuery('vtv1', null, tok('vtv1', exp), SECRET), false);
    assert.equal(verifyHlsQuery('vtv1', String(exp), tok('vtv1', exp), ''), false);
    assert.equal(verifyHlsQuery('ten xau!', String(exp), tok('ten xau!', exp), SECRET), false);
  });
});

describe('rewritePlaylist', () => {
  it('gắn token vào segment + URI map, giữ nguyên tag', () => {
    const src = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:5',
      '#EXT-X-MAP:URI="init.mp4"',
      '#EXTINF:5.0,',
      'segment_001.ts',
      '#EXTINF:5.0,',
      'segment_002.ts',
      '#EXT-X-ENDLIST',
    ].join('\n');
    const out = rewritePlaylist(src, 'TOK', 123);
    assert.ok(out.includes('#EXTM3U'));
    assert.ok(out.includes('#EXT-X-VERSION:3'));
    assert.ok(out.includes('#EXT-X-MAP:URI="init.mp4?token=TOK&exp=123"'));
    assert.ok(out.includes('segment_001.ts?token=TOK&exp=123'));
    assert.ok(out.includes('segment_002.ts?token=TOK&exp=123'));
    assert.ok(!out.includes('#EXTINF:5.0,?token='));
  });

  it('dòng đã có query thì giữ nguyên', () => {
    const out = rewritePlaylist('seg.ts?x=1', 'TOK', 123);
    assert.equal(out, 'seg.ts?x=1');
  });
});
