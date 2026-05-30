import type { Window } from "./constants";

export type Deltas = Record<Window, number | null>;

export type SparklinePoint = { date: string; adp: number };

/** Raw shape returned by /api/players for a single format. */
export type ApiPlayer = {
  id: number;
  name: string;
  slug: string | null;
  position: string;
  team: string | null;
  bye: number | null;
  isRookie: boolean;
  adp: number;
  overallRank: number | null;
  posRank: number | null;
  source: string;
  timesDrafted: number | null;
  adpHigh: number | null;
  adpLow: number | null;
  adpStdev: number | null;
  deltas: Deltas;
  series30d: SparklinePoint[];
  capturedAt: string;
};

export type ApiResponse = {
  format: "ppr" | "best_ball";
  capturedAt: string | null;
  players: ApiPlayer[];
  note?: string;
};

/** Component-friendly shape: prototype-compatible field names, plus the
 *  other format's data hung off the same record. */
export type DashboardPlayer = {
  id: number;
  n: string;
  t: string | null;
  by: number | null;
  p: string;
  posRank: number | null;
  rank: number;
  adp: number;
  ppr: number | null;
  bb: number | null;
  rk: boolean;
  slug: string | null;
  source: string;
  d: Deltas;
  trend: number[];
  // bonus FFC fields (null for FP rows)
  timesDrafted: number | null;
  adpHigh: number | null;
  adpLow: number | null;
  adpStdev: number | null;
};

export type DashboardData = {
  ppr: DashboardPlayer[];
  bb: DashboardPlayer[];
  pprCapturedAt: string | null;
  bbCapturedAt: string | null;
};
