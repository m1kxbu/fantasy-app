import { describe, it, expect } from "vitest";
import {
  computeDeltas,
  sparklineSeries,
  nearestInWindow,
  type Snapshot,
} from "./deltas";

const MS_DAY = 24 * 60 * 60 * 1000;
const BASE = "2026-05-29T00:00:00Z";

function snap(dayOffset: number, adp: number, from = BASE): Snapshot {
  return {
    capturedAt: new Date(new Date(from).getTime() + dayOffset * MS_DAY),
    adp,
  };
}

describe("computeDeltas", () => {
  it("returns all null when there are no snapshots", () => {
    expect(computeDeltas([])).toEqual({
      "1D": null,
      "7D": null,
      "14D": null,
      "30D": null,
    });
  });

  it("returns all null when only the current snapshot exists", () => {
    expect(computeDeltas([snap(0, 12.4)])).toEqual({
      "1D": null,
      "7D": null,
      "14D": null,
      "30D": null,
    });
  });

  it("computes positive delta when ADP got smaller (stock up)", () => {
    // current=10 today; 7d ago adp was 14 → moved up 4 spots
    const snaps = [snap(0, 10), snap(-7, 14)];
    expect(computeDeltas(snaps)).toEqual({
      "1D": null, // 7-day-old snap doesn't qualify for 1D
      "7D": 4,
      "14D": null,
      "30D": null,
    });
  });

  it("computes negative delta when ADP got larger (stock down)", () => {
    const snaps = [snap(0, 14), snap(-7, 10)];
    expect(computeDeltas(snaps)["7D"]).toBe(-4);
  });

  it("each window only matches snapshots within ±50% of its size", () => {
    // current at day 0; snaps at -1, -7, -14, -30
    const snaps = [
      snap(0, 10),
      snap(-1, 11),
      snap(-7, 13),
      snap(-14, 14),
      snap(-30, 18),
    ];
    expect(computeDeltas(snaps)).toEqual({
      "1D": 1,
      "7D": 3,
      "14D": 4,
      "30D": 8,
    });
  });

  it("picks the closest-to-ideal snapshot when multiple qualify for a window", () => {
    // For the 7D window (range 3.5–10.5 days), -7 is closer than -5.
    const snaps = [snap(0, 10), snap(-5, 12), snap(-7, 13)];
    expect(computeDeltas(snaps)["7D"]).toBe(3);
  });

  it("does not let a 7-day-old snapshot back-fill a 1D delta", () => {
    const snaps = [snap(0, 10), snap(-7, 14)];
    expect(computeDeltas(snaps)["1D"]).toBeNull();
  });

  it("does not let a 14-day-old snapshot back-fill a 30D delta", () => {
    // 14d-old is below the 30D minAge (15d) → null
    const snaps = [snap(0, 10), snap(-14, 14)];
    expect(computeDeltas(snaps)["30D"]).toBeNull();
  });

  it("ignores duplicate timestamps gracefully", () => {
    const snaps = [snap(0, 10), snap(0, 10), snap(-7, 14)];
    expect(computeDeltas(snaps)["7D"]).toBe(4);
  });

  it("handles decimal ADP values precisely", () => {
    const snaps = [snap(0, 12.4), snap(-7, 16.1)];
    expect(computeDeltas(snaps)["7D"]).toBeCloseTo(3.7, 5);
  });
});

describe("nearestInWindow", () => {
  it("returns null when no snapshot falls in the tolerance window", () => {
    const snaps = [snap(0, 10), snap(-3, 12)];
    expect(nearestInWindow(snaps, snaps[0].capturedAt.getTime(), 30)).toBeNull();
  });

  it("picks the snapshot whose age is closest to the ideal window", () => {
    const snaps = [
      snap(0, 10),
      snap(-5, 12), // age 5d
      snap(-7, 13), // age 7d ← closest to 7d ideal
      snap(-9, 14), // age 9d
    ];
    const match = nearestInWindow(snaps, snaps[0].capturedAt.getTime(), 7);
    expect(match?.adp).toBe(13);
  });

  it("rejects snapshots whose age is below window/2", () => {
    // For 7D, min age is 3.5d; -3 day snap doesn't qualify.
    const snaps = [snap(0, 10), snap(-3, 13)];
    expect(nearestInWindow(snaps, snaps[0].capturedAt.getTime(), 7)).toBeNull();
  });

  it("rejects snapshots whose age is above window*1.5", () => {
    // For 7D, max age is 10.5d; -11 day snap doesn't qualify.
    const snaps = [snap(0, 10), snap(-11, 14)];
    expect(nearestInWindow(snaps, snaps[0].capturedAt.getTime(), 7)).toBeNull();
  });
});

describe("sparklineSeries", () => {
  it("returns ASC dates limited to the window", () => {
    const snaps = [
      snap(0, 10),
      snap(-10, 13),
      snap(-20, 14),
      snap(-29, 15),
      snap(-31, 16), // outside 30d window
    ];
    const series = sparklineSeries(snaps, 30);
    expect(series.map((s) => s.adp)).toEqual([15, 14, 13, 10]);
    expect(series[0].date <= series[series.length - 1].date).toBe(true);
  });

  it("returns empty when no snapshots", () => {
    expect(sparklineSeries([])).toEqual([]);
  });

  it("returns single point when only current snapshot exists", () => {
    const series = sparklineSeries([snap(0, 10)]);
    expect(series).toHaveLength(1);
    expect(series[0].adp).toBe(10);
  });
});
