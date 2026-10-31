# time-series-gap-filler

Detects missing intervals in a sorted sequence of epoch-millisecond timestamps and returns the gap ranges at a fixed resolution.

```js
import { findGaps } from 'time-series-gap-filler';

const ts = [1000, 2000, 5000, 6000]; // 3000 and 4000 are missing
const gaps = findGaps(ts, { stepMs: 1000 });
// => [[3000, 4000], [4000, 5000]]
```

## Why

Telemetry, logs, and sensor feeds are often expected at a fixed cadence but arrive with jitter and outright holes. This library does one thing: given a sorted array of timestamps and an expected step, it tells you exactly which slots are missing so you can backfill, interpolate, or flag them.

The trade-off is that gaps are anchored to the observed timestamps rather than to an epoch-aligned grid. The first missing boundary after an observation is `prev + stepMs`, not the nearest rounded slot. This keeps the library honest about what it actually saw: it does not assume the series started on a tidy boundary, and it never extrapolates past the final observation.

## The awkward edge

Jitter. If your data can be late by some fraction of a step, pass `toleranceMs` so the filler does not turn noise into gaps. The default tolerance is `stepMs / 2` — at exactly half a step the slot is ambiguous between the preceding and following boundary, so we choose not to manufacture a gap there. If your jitter is larger than half a step, raise `toleranceMs` explicitly.

The exported API is exactly `{ findGaps }`. `findGaps(timestamps, { stepMs, toleranceMs? })` returns an array of `[gapStartMs, gapEndMs]` pairs where `gapEndMs` is `gapStartMs + stepMs`. `gapEndMs` may equal a timestamp that is present in the input — it is the bookend of the missing slot, not itself reported as missing.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

