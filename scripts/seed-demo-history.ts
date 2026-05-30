/**
 * One-time DEMO SEED.
 *
 * Inserts plausible synthetic snapshots at captured_at offsets of
 * -1d, -7d, -14d, and -30d (UTC midnight each) for every player that
 * currently has a real "today" snapshot. The deltas they produce match
 * the algorithm used in the prototype so the dashboard immediately
 * looks alive — bubbles + heatmap glow, ticker scrolls real numbers,
 * movers sort works.
 *
 * THESE ROWS ARE NOT REAL HISTORY. They are clearly attributed to a
 * single scrape_runs row whose source_url is "gridiron://demo-seed/v1"
 * and whose error column flags the intent. Teardown is one line of
 * SQL printed at the end of the run.
 *
 * Re-running the script overwrites the same seeded rows
 * (idempotent via UNIQUE (player_id, source, format, captured_at)).
 *
 * Usage:  npm run seed:demo
 */

import { eq, inArray, sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";

const SEED_SOURCE_URL = "gridiron://demo-seed/v1";

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function startOfUtcDayMinus(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(
      "DATABASE_URL not set. Run `vercel env pull .env.local` first.",
    );
    process.exit(1);
  }
  const conn = drizzle(neon(dbUrl), { schema });

  // 1. Open a single audit row that owns every seeded snapshot.
  const [run] = await conn
    .insert(schema.scrapeRuns)
    .values({
      source: "ffc",
      format: "ppr",
      sourceUrl: SEED_SOURCE_URL,
      status: "success",
      error:
        "DEMO SEED — synthetic historical snapshots so day-1 deltas are non-null. Safe to delete; see teardown SQL in script output.",
    })
    .returning({ id: schema.scrapeRuns.id });
  console.log(`Opened scrape_runs id=${run.id} for the seeded batch.`);

  let totalSeeded = 0;

  for (const format of ["ppr", "best_ball"] as const) {
    // 2. Pull today's snapshot per player for this format.
    const today = await conn
      .select({
        playerId: schema.adpSnapshots.playerId,
        source: schema.adpSnapshots.source,
        adp: schema.adpSnapshots.adp,
        capturedAt: schema.adpSnapshots.capturedAt,
        name: schema.players.canonicalName,
      })
      .from(schema.adpSnapshots)
      .innerJoin(
        schema.players,
        eq(schema.adpSnapshots.playerId, schema.players.id),
      )
      .where(eq(schema.adpSnapshots.format, format));

    if (today.length === 0) {
      console.log(`  ${format}: no current snapshots — skipping`);
      continue;
    }

    const seedRows: typeof schema.adpSnapshots.$inferInsert[] = [];

    for (const row of today) {
      const rnd = mulberry32(hashStr(`${row.name}|${format}`));
      const adp = Number(row.adp);

      let momentum = rnd() * 2 - 1;
      if (rnd() < 0.18) momentum *= 0.15; // flat bias

      const vol = 4 + adp * 0.13; // deeper picks swing more
      const d30 = round1(momentum * vol * (0.8 + rnd() * 0.6));
      const d14 = round1(d30 * (0.5 + rnd() * 0.22) + (rnd() * 2 - 1) * 0.6);
      const d7 = round1(d30 * (0.28 + rnd() * 0.2) + (rnd() * 2 - 1) * 0.5);
      const d1 =
        rnd() < 0.5
          ? 0
          : round1(d30 * (0.05 + rnd() * 0.12) + (rnd() * 2 - 1) * 0.3);

      // historical ADP at each cutoff = today's ADP + the delta we want
      // the math to produce (positive delta = stock up = past adp larger).
      const offsets = [
        { days: 1, delta: d1 },
        { days: 7, delta: d7 },
        { days: 14, delta: d14 },
        { days: 30, delta: d30 },
      ];

      for (const { days, delta } of offsets) {
        const historicalAdp = Math.max(0.6, adp + delta);
        seedRows.push({
          playerId: row.playerId,
          source: row.source,
          format,
          adp: historicalAdp.toFixed(2),
          capturedAt: startOfUtcDayMinus(days),
          scrapeRunId: run.id,
        });
      }
    }

    // 3. Chunked batch insert (Neon HTTP has request-size limits;
    // 500 rows per request stays safely under).
    const CHUNK = 500;
    for (let i = 0; i < seedRows.length; i += CHUNK) {
      const slice = seedRows.slice(i, i + CHUNK);
      await conn
        .insert(schema.adpSnapshots)
        .values(slice)
        .onConflictDoUpdate({
          target: [
            schema.adpSnapshots.playerId,
            schema.adpSnapshots.source,
            schema.adpSnapshots.format,
            schema.adpSnapshots.capturedAt,
          ],
          set: {
            adp: sql`EXCLUDED.adp`,
            scrapeRunId: sql`EXCLUDED.scrape_run_id`,
          },
        });
    }
    console.log(`  ${format}: ${seedRows.length} seeded snapshots`);
    totalSeeded += seedRows.length;
  }

  await conn
    .update(schema.scrapeRuns)
    .set({ rowCount: totalSeeded, finishedAt: new Date() })
    .where(eq(schema.scrapeRuns.id, run.id));

  console.log(`\nDone. ${totalSeeded} seeded snapshots inserted.`);
  console.log(`\n=== TEARDOWN (paste into psql when ready) ===`);
  console.log(`DELETE FROM adp_snapshots WHERE scrape_run_id = ${run.id};`);
  console.log(`DELETE FROM scrape_runs   WHERE id           = ${run.id};`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
