import { sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import {
  canonicalizeName,
  normalizePosition,
  isExcludedPosition,
} from "@/lib/canonicalize";
import type { AdpSource, ScoringFormat } from "@/db/schema";

export type NormalizedRow = {
  canonicalName: string;
  displayName: string;
  position: string; // QB/RB/WR/TE (K/DST already filtered)
  team: string | null;
  byeWeek: number | null;
  isRookie: boolean;
  fpSlug: string | null;
  ffcId: string | null;
  adp: number;
  overallRank: number | null;
  posRank: number | null;
  timesDrafted: number | null;
  adpHigh: number | null;
  adpLow: number | null;
  adpStdev: number | null;
};

export type IngestSummary = {
  scrapeRunId: number;
  totalParsed: number;
  ingested: number;
  excludedPositions: number;
};

/**
 * Atomic-ish ingestion: opens a scrape_run row, stores the raw payload,
 * batch-upserts players, batch-inserts/updates today's adp_snapshots,
 * closes the scrape_run with status.
 *
 * `capturedAt` is normalized to UTC midnight so we have exactly one
 * snapshot row per (player, source, format, day). Re-running the same
 * day overwrites that day's row (idempotent).
 */
export async function ingest(args: {
  source: AdpSource;
  format: ScoringFormat;
  sourceUrl: string;
  rawPayload: Uint8Array;
  contentType: string;
  rows: NormalizedRow[];
  capturedAt?: Date;
}): Promise<IngestSummary> {
  const conn = db();
  const capturedAt = args.capturedAt ?? startOfUtcDay(new Date());

  const filtered = args.rows.filter(
    (r) => !isExcludedPosition(r.position),
  );
  const excludedPositions = args.rows.length - filtered.length;

  // 1. open scrape_run
  const [run] = await conn
    .insert(schema.scrapeRuns)
    .values({
      source: args.source,
      format: args.format,
      sourceUrl: args.sourceUrl,
      status: "pending",
    })
    .returning({ id: schema.scrapeRuns.id });

  try {
    // 2. store raw payload
    await conn.insert(schema.rawPayloads).values({
      scrapeRunId: run.id,
      sourceUrl: args.sourceUrl,
      contentType: args.contentType,
      payload: args.rawPayload,
    });

    if (filtered.length === 0) {
      await closeRun(run.id, "success", 0, null);
      return {
        scrapeRunId: run.id,
        totalParsed: args.rows.length,
        ingested: 0,
        excludedPositions,
      };
    }

    // 3. derive overall + pos rank from ADP if the source didn't give it
    withDerivedRanks(filtered);

    // 4. batch upsert players, get back IDs keyed by (canonical_name, position)
    const playerValues = filtered.map((r) => ({
      canonicalName: r.canonicalName,
      displayName: r.displayName,
      position: r.position,
      team: r.team,
      byeWeek: r.byeWeek,
      isRookie: r.isRookie,
      fpSlug: r.fpSlug,
      ffcId: r.ffcId,
    }));

    const upserted = await conn
      .insert(schema.players)
      .values(playerValues)
      .onConflictDoUpdate({
        target: [schema.players.canonicalName, schema.players.position],
        set: {
          displayName: sql`EXCLUDED.display_name`,
          team: sql`COALESCE(EXCLUDED.team, ${schema.players.team})`,
          byeWeek: sql`COALESCE(EXCLUDED.bye_week, ${schema.players.byeWeek})`,
          fpSlug: sql`COALESCE(EXCLUDED.fp_slug, ${schema.players.fpSlug})`,
          ffcId: sql`COALESCE(EXCLUDED.ffc_id, ${schema.players.ffcId})`,
          updatedAt: sql`NOW()`,
        },
      })
      .returning({
        id: schema.players.id,
        canonicalName: schema.players.canonicalName,
        position: schema.players.position,
      });

    const idByKey = new Map<string, number>();
    for (const row of upserted) {
      idByKey.set(`${row.canonicalName}|${row.position}`, row.id);
    }

    // 5. batch insert / update today's snapshots
    const snapshotValues = filtered
      .map((r) => {
        const playerId = idByKey.get(`${r.canonicalName}|${r.position}`);
        if (playerId === undefined) return null;
        return {
          playerId,
          source: args.source,
          format: args.format,
          adp: r.adp.toFixed(2),
          overallRank: r.overallRank,
          posRank: r.posRank,
          timesDrafted: r.timesDrafted,
          adpHigh: r.adpHigh !== null ? r.adpHigh.toFixed(2) : null,
          adpLow: r.adpLow !== null ? r.adpLow.toFixed(2) : null,
          adpStdev: r.adpStdev !== null ? r.adpStdev.toFixed(2) : null,
          capturedAt,
          scrapeRunId: run.id,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    await conn
      .insert(schema.adpSnapshots)
      .values(snapshotValues)
      .onConflictDoUpdate({
        target: [
          schema.adpSnapshots.playerId,
          schema.adpSnapshots.source,
          schema.adpSnapshots.format,
          schema.adpSnapshots.capturedAt,
        ],
        set: {
          adp: sql`EXCLUDED.adp`,
          overallRank: sql`EXCLUDED.overall_rank`,
          posRank: sql`EXCLUDED.pos_rank`,
          timesDrafted: sql`EXCLUDED.times_drafted`,
          adpHigh: sql`EXCLUDED.adp_high`,
          adpLow: sql`EXCLUDED.adp_low`,
          adpStdev: sql`EXCLUDED.adp_stdev`,
          scrapeRunId: sql`EXCLUDED.scrape_run_id`,
        },
      });

    await closeRun(run.id, "success", snapshotValues.length, null);

    return {
      scrapeRunId: run.id,
      totalParsed: args.rows.length,
      ingested: snapshotValues.length,
      excludedPositions,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await closeRun(run.id, "parse_error", 0, message).catch(() => {});
    throw err;
  }
}

async function closeRun(
  runId: number,
  status: "success" | "parse_error" | "fetch_error",
  rowCount: number,
  errMessage: string | null,
) {
  const conn = db();
  await conn
    .update(schema.scrapeRuns)
    .set({
      status,
      rowCount,
      error: errMessage,
      finishedAt: new Date(),
    })
    .where(sql`${schema.scrapeRuns.id} = ${runId}`);
}

function startOfUtcDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

/** Sort by ADP, assign overall rank and per-position rank in-place. */
function withDerivedRanks(rows: NormalizedRow[]) {
  const byAdp = [...rows].sort((a, b) => a.adp - b.adp);
  const overall = new Map<NormalizedRow, number>();
  byAdp.forEach((r, i) => overall.set(r, i + 1));

  const posCounter = new Map<string, number>();
  for (const r of byAdp) {
    const next = (posCounter.get(r.position) ?? 0) + 1;
    posCounter.set(r.position, next);
    if (r.overallRank == null) r.overallRank = overall.get(r) ?? null;
    if (r.posRank == null) r.posRank = next;
  }
}

export { startOfUtcDay };

/** Normalize a player row from the FFC API into our common shape. */
export function normalizeFfcPlayer(p: {
  player_id: number | string;
  name: string;
  position: string;
  team?: string | null;
  bye?: number | null;
  adp: number;
  times_drafted?: number;
  high?: number;
  low?: number;
  stdev?: number;
}): NormalizedRow | null {
  const position = normalizePosition(p.position);
  if (!position) return null;
  return {
    canonicalName: canonicalizeName(p.name),
    displayName: p.name.trim(),
    position,
    team: p.team ? p.team.toUpperCase() : null,
    byeWeek: typeof p.bye === "number" ? p.bye : null,
    isRookie: false, // FFC doesn't tag rookies; future improvement: cross-reference rookies endpoint
    fpSlug: null,
    ffcId: String(p.player_id),
    adp: p.adp,
    overallRank: null, // derived
    posRank: null, // derived
    timesDrafted: p.times_drafted ?? null,
    adpHigh: p.high ?? null,
    adpLow: p.low ?? null,
    adpStdev: p.stdev ?? null,
  };
}
