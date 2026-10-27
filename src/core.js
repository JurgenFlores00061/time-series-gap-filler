/**
 * Time Series Gap Filler — core detection logic.
 *
 * findGaps walks a sorted list of epoch-millisecond timestamps and emits
 * the intervals that are *missing* relative to the expected step size.
 *
 * Interpretation chosen (stated plainly so callers do not guess):
 * The input is a dense sorted sequence of observations taken at a nominal
 * resolution. When two adjacent timestamps are further apart than `stepMs`,
 * every whole `stepMs` boundary between them that is NOT present in the input
 * is reported as a gap. We never report the last seen timestamp itself as a
 * gap, and we never extrapolate beyond the final observation. This keeps the
 * output finite and tied strictly to observed data.
 *
 * Why milliseconds? Epoch-ms is the lowest common denominator across JS Date,
 * most databases, and JSON logging. Callers convert from their own units.
 */

/**
 * @typedef {[number, number]} GapRange
 *   A half-open-ish pair [gapStartMs, gapEndMs] where gapStartMs is the
 *   missing boundary and gapEndMs is the next expected boundary (gapStartMs + stepMs).
 *   gapEndMs may equal a timestamp that *is* present in the input — it is the
 *   bookend of the missing slot, not itself reported as missing.
 */

/**
 * Detect missing intervals in a sorted timestamp sequence.
 *
 * @param {number[]} timestamps  Epoch milliseconds, sorted ascending.
 * @param {object}  options
 * @param {number}  options.stepMs      Expected interval between observations.
 * @param {number} [options.toleranceMs] Permitted jitter before a gap is declared.
 *        Defaults to stepMs / 2, which treats any offset less than half a step
 *        as noise rather than a structural gap. We chose half because at
 *        exactly half the step the timestamp is ambiguous between the slot
 *        before and the slot after, and we prefer not to manufacture a gap
 *        from ambiguity.
 * @returns {GapRange[]} gaps, ordered by start time.
 */
export function findGaps(timestamps, options) {
  if (!Array.isArray(timestamps)) {
    throw new TypeError('timestamps must be an array of numbers');
  }
  if (options === null || typeof options !== 'object') {
    throw new TypeError('options must be an object');
  }
  const { stepMs } = options;
  if (typeof stepMs !== 'number' || !Number.isFinite(stepMs) || stepMs <= 0) {
    throw new RangeError('options.stepMs must be a positive finite number');
  }
  const toleranceMs =
    typeof options.toleranceMs === 'number' && Number.isFinite(options.toleranceMs)
      ? options.toleranceMs
      : stepMs / 2;
  if (toleranceMs < 0) {
    throw new RangeError('options.toleranceMs must not be negative');
  }

  // Fewer than two observations means no adjacent pair to inspect, hence no gaps.
  if (timestamps.length < 2) return [];

  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    if (typeof t !== 'number' || !Number.isFinite(t)) {
      throw new TypeError(`timestamps[${i}] is not a finite number`);
    }
    if (i > 0 && t < timestamps[i - 1]) {
      throw new RangeError(`timestamps must be sorted ascending; index ${i} breaks order`);
    }
  }

  /** @type {GapRange[]} */
  const gaps = [];

  for (let i = 1; i < timestamps.length; i++) {
    const prev = timestamps[i - 1];
    const curr = timestamps[i];
    const delta = curr - prev;

    // Within tolerance of a single step: not a gap, just jitter.
    if (delta <= stepMs + toleranceMs) continue;

    // The first missing boundary is the step after prev. We walk forward by
    // whole steps and emit each boundary that lands strictly before curr.
    // Using prev + stepMs (rather than rounding prev to a grid) means we
    // anchor gaps to the observed data, not to an assumed epoch alignment.
    let nextBoundary = prev + stepMs;
    // Stop when nextBoundary is within tolerance of curr — at that point the
    // slot is effectively filled by curr and reporting it would double-count.
    while (curr - nextBoundary > toleranceMs) {
      gaps.push([nextBoundary, nextBoundary + stepMs]);
      nextBoundary += stepMs;
    }
  }

  return gaps;
}
