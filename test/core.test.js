import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findGaps } from '../src/index.js';

test('findGaps is the named export of the package', () => {
  assert.equal(typeof findGaps, 'function');
});

test('no gaps when timestamps are contiguous at the step size', () => {
  const ts = [1000, 2000, 3000, 4000];
  const gaps = findGaps(ts, { stepMs: 1000 });
  assert.deepEqual(gaps, []);
});

test('detects a single missing slot between two timestamps', () => {
  const ts = [1000, 3000];
  const gaps = findGaps(ts, { stepMs: 1000 });
  assert.deepEqual(gaps, [[2000, 3000]]);
});

test('detects multiple consecutive missing slots', () => {
  const ts = [1000, 5000];
  const gaps = findGaps(ts, { stepMs: 1000 });
  assert.deepEqual(gaps, [
    [2000, 3000],
    [3000, 4000],
    [4000, 5000],
  ]);
});

test('gap end equals the timestamp that bookends the missing run', () => {
  // [2000,3000] — 3000 is present in the input but is the *boundary* of the
  // gap slot, not reported as missing itself.
  const ts = [1000, 3000];
  const gaps = findGaps(ts, { stepMs: 1000 });
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0][1], 3000);
});

test('jitter within tolerance is not a gap', () => {
  // 150ms late on a 1000ms step, tolerance 200ms → still contiguous.
  const ts = [1000, 2150, 3000];
  const gaps = findGaps(ts, { stepMs: 1000, toleranceMs: 200 });
  assert.deepEqual(gaps, []);
});

test('jitter beyond tolerance produces a gap', () => {
  const ts = [1000, 2300, 3000];
  const gaps = findGaps(ts, { stepMs: 1000, toleranceMs: 200 });
  // 2300 is 300ms past 2000 and 700ms before 3000 → slot 2000 is missing.
  assert.deepEqual(gaps, [[2000, 3000]]);
});

test('default tolerance is half the step size', () => {
  // step 1000 → default tolerance 500. 1400 is within 500 of 1000+1000? no:
  // delta 400 < 1000+500, so NOT a gap. Then 1400→2000 delta 600 > 1500? no.
  // So no gaps.
  const ts = [1000, 1400, 2000];
  const gaps = findGaps(ts, { stepMs: 1000 });
  assert.deepEqual(gaps, []);
});

test('a gap in the middle of a longer sequence is reported once', () => {
  const ts = [0, 1000, 3000, 4000, 5000];
  const gaps = findGaps(ts, { stepMs: 1000 });
  assert.deepEqual(gaps, [[2000, 3000]]);
});

test('returns empty array for fewer than two timestamps', () => {
  assert.deepEqual(findGaps([], { stepMs: 1000 }), []);
  assert.deepEqual(findGaps([1000], { stepMs: 1000 }), []);
});

test('throws on non-array timestamps', () => {
  assert.throws(() => findGaps('nope', { stepMs: 1000 }), TypeError);
});

test('throws on non-positive stepMs', () => {
  assert.throws(() => findGaps([1, 2], { stepMs: 0 }), RangeError);
  assert.throws(() => findGaps([1, 2], { stepMs: -100 }), RangeError);
  assert.throws(() => findGaps([1, 2], { stepMs: Infinity }), RangeError);
});

test('throws on unsorted input', () => {
  assert.throws(() => findGaps([3000, 1000], { stepMs: 1000 }), RangeError);
});

test('throws on non-number entries', () => {
  assert.throws(() => findGaps([1000, 'x'], { stepMs: 1000 }), TypeError);
  assert.throws(() => findGaps([1000, NaN], { stepMs: 1000 }), TypeError);
});

test('rejects negative tolerance', () => {
  assert.throws(() => findGaps([1, 2], { stepMs: 1000, toleranceMs: -1 }), RangeError);
});
