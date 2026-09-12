// monitor.test.ts — Test ngưỡng màu + cửa sổ trượt. Chạy: npm test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { thresholdColor, pushPoint } from './monitor.js';

describe('monitor', () => {
  it('màu ngưỡng xanh/cam/đỏ', () => {
    assert.equal(thresholdColor(10), '#22c55e');
    assert.equal(thresholdColor(60), '#f59e0b');
    assert.equal(thresholdColor(85), '#f59e0b');
    assert.equal(thresholdColor(86), '#ef4444');
    assert.equal(thresholdColor(null), '#94a3b8');
  });

  it('cửa sổ trượt giữ tối đa 60', () => {
    let w: number[] = [];
    for (let i = 0; i < 70; i++) w = pushPoint(w, i);
    assert.equal(w.length, 60);
    assert.equal(w[0], 10);
  });
});
