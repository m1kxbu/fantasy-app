import { NextResponse } from "next/server";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import {
  computeDeltas,
  sparklineSeries,
  type Snapshot,
} from "@/lib/deltas";
import { SCORING_FORMATS, type ScoringFormat } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 31 days so the 30-day window has at least one "boundary" snapshot to land on.
const HISTORY_DAYS = 31;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type PlayerOut = {
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
  deltas: ReturnType<typeof computeDeltas>;
  series30d: ReturnType<typeof sparklineSeries>;
  capturedAt: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const formatParam = url.searchParams.get("format") ?? "ppr";
  if (!SCORING_FORMATS.includes(formatParam as ScoringFormat)) {
    return NextResponse.json(
      { error: `format must be one of: ${SCORING_FORMATS.join(", ")}` },
      { status: 400 },
    );
  }
  const format = formatParam as ScoringFormat;

  let conn;
  try {
    conn = db();
  } catch (err) {
    return NextResponse.json(
      {
        error: "database not configured",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }

  const cutoff = new Date(Date.now() - HISTORY_DAYS * MS_PER_DAY);

  // 1. all recent snapshots for this format
  const rows = await conn
    .select({
      playerId: schema.adpSnapshots.playerId,
      source: schema.adpSnapshots.source,
      adp: schema.adpSnapshots.adp,
      overallRank: schema.adpSnapshots.overallRank,
      posRank: schema.adpSnapshots.posRank,
      timesDrafted: schema.adpSnapshots.timesDrafted,
      adpHigh: schema.adpSnapshots.adpHigh,
      adpLow: schema.adpSnapshots.adpLow,
      adpStdev: schema.adpSnapshots.adpStdev,
      capturedAt: schema.adpSnapshots.capturedAt,
    })
    .from(schema.adpSnapshots)
    .where(
      and(
        eq(schema.adpSnapshots.format, format),
        gte(schema.adpSnapshots.capturedAt, cutoff),
      ),
    )
    .orderBy(
      asc(schema.adpSnapshots.playerId),
      desc(schema.adpSnapshots.capturedAt),
    );

  if (rows.length === 0) {
    return NextResponse.json({
      format,
      capturedAt: null,
      players: [],
      note: "no snapshots yet — ingestion has not run for this format",
    });
  }

  // 2. group snapshots by player (already sorted; each group is DESC)
  const byPlayer = new Map<number, typeof rows>();
  for (const row of rows) {
    const list = byPlayer.get(row.playerId) ?? [];
    list.push(row);
    byPlayer.set(row.playerId, list);
  }

  // 3. fetch player metadata for the active set
  const playerIds = [...byPlayer.keys()];
  const playerMeta = await conn
    .select()
    .from(schema.players)
    .where(inArray(schema.players.id, playerIds));
  const metaById = new Map(playerMeta.map((p) => [p.id, p]));

  // 4. compose the response
  const players: PlayerOut[] = [];
  let latestSnapshotAt = 0;

  for (const [playerId, snaps] of byPlayer) {
    const meta = metaById.get(playerId);
    if (!meta) continue;

    const current = snaps[0];
    const currentAdp = Number(current.adp);
    latestSnapshotAt = Math.max(
      latestSnapshotAt,
      current.capturedAt.getTime(),
    );

    const snapshotsForMath: Snapshot[] = snaps.map((s) => ({
      capturedAt: s.capturedAt,
      adp: Number(s.adp),
    }));

    players.push({
      id: playerId,
      name: meta.displayName,
      slug: meta.fpSlug,
      position: meta.position,
      team: meta.team,
      bye: meta.byeWeek,
      isRookie: meta.isRookie,
      adp: currentAdp,
      overallRank: current.overallRank,
      posRank: current.posRank,
      source: current.source,
      timesDrafted: current.timesDrafted,
      adpHigh: nullableNumber(current.adpHigh),
      adpLow: nullableNumber(current.adpLow),
      adpStdev: nullableNumber(current.adpStdev),
      deltas: computeDeltas(snapshotsForMath),
      series30d: sparklineSeries(snapshotsForMath, 30),
      capturedAt: current.capturedAt.toISOString(),
    });
  }

  // Sort by ADP ascending for default display.
  players.sort((a, b) => a.adp - b.adp);

  return NextResponse.json({
    format,
    capturedAt: latestSnapshotAt
      ? new Date(latestSnapshotAt).toISOString()
      : null,
    players,
  });
}

function nullableNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
