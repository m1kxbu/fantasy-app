/**
 * Pure delta-math helpers. Snapshots come in sorted by captured_at DESC
 * (most recent first). Deltas are computed against the nearest snapshot
 * at or before (current.captured_at - windowDays). When no such snapshot
 * exists yet, the delta is `null` — never simulated.
 *
 * Sign convention: positive delta means the player's ADP got smaller
 * (drafted earlier) — i.e. stock is UP. This matches `green = rising`.
 */

export type Snapshot = {
  capturedAt: Date;
  adp: number;
};

export const DELTA_WINDOWS = [1, 7, 14, 30] as const;
export type DeltaWindowDays = (typeof DELTA_WINDOWS)[number];

export type DeltaSet = Record<`${DeltaWindowDays}D`, number | null>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Each window owns a continuous, non-overlapping age range. A given snapshot
 * therefore qualifies for at most one window. Boundaries placed at the
 * arithmetic midpoint of neighboring windows.
 *
 *   age (days)   →  window
 *   (0,   4]     →  1D
 *   (4,  10.5]   →  7D
 *   (10.5, 22]   →  14D
 *   (22,  60]    →  30D
 */
const WINDOW_AGE_BOUNDS: Record<
  DeltaWindowDays,
  { minDays: number; maxDays: number }
> = {
  1: { minDays: 0, maxDays: 4 },
  7: { minDays: 4, maxDays: 10.5 },
  14: { minDays: 10.5, maxDays: 22 },
  30: { minDays: 22, maxDays: 60 },
};

/**
 * @param snapshots — DESC by capturedAt; index 0 is "now".
 */
export function computeDeltas(snapshots: Snapshot[]): DeltaSet {
  const empty: DeltaSet = { "1D": null, "7D": null, "14D": null, "30D": null };
  if (snapshots.length === 0) return empty;

  const current = snapshots[0];
  const out: DeltaSet = { ...empty };

  for (const w of DELTA_WINDOWS) {
    const match = nearestInWindow(snapshots, current.capturedAt.getTime(), w);
    if (match === null) continue;
    // ADP smaller = stock up; positive delta means improvement.
    out[`${w}D`] = match.adp - current.adp;
  }
  return out;
}

/**
 * Among `snapshots` (DESC by capturedAt), find the one whose age relative
 * to `nowMs` falls inside the window's age band and is closest to the
 * window's ideal (`windowDays` exactly). Returns null if nothing qualifies.
 */
export function nearestInWindow(
  snapshots: Snapshot[],
  nowMs: number,
  windowDays: DeltaWindowDays,
): Snapshot | null {
  const { minDays, maxDays } = WINDOW_AGE_BOUNDS[windowDays];
  const minAgeMs = minDays * MS_PER_DAY;
  const maxAgeMs = maxDays * MS_PER_DAY;
  const idealMs = windowDays * MS_PER_DAY;

  let best: Snapshot | null = null;
  let bestDist = Infinity;

  // skip index 0 — that's the "current" snapshot
  for (let i = 1; i < snapshots.length; i++) {
    const s = snapshots[i];
    const age = nowMs - s.capturedAt.getTime();
    if (age <= minAgeMs || age > maxAgeMs) continue;
    const dist = Math.abs(age - idealMs);
    if (dist < bestDist) {
      best = s;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Trim to last 30 calendar days (relative to the most recent snapshot)
 * and return ASC by date for sparkline rendering.
 */
export function sparklineSeries(
  snapshots: Snapshot[],
  windowDays = 30,
): Array<{ date: string; adp: number }> {
  if (snapshots.length === 0) return [];
  const newest = snapshots[0].capturedAt.getTime();
  const cutoff = newest - windowDays * MS_PER_DAY;
  return snapshots
    .filter((s) => s.capturedAt.getTime() >= cutoff)
    .slice()
    .reverse()
    .map((s) => ({
      date: s.capturedAt.toISOString().slice(0, 10),
      adp: s.adp,
    }));
}
