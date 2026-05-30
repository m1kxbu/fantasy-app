import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { RookieIdentity } from "@/lib/sources/fantasypros-rookies";

export type MarkRookiesSummary = {
  scrapeRunId: number;
  rookiesParsed: number;
  playersMatched: number;
  playersNewlyFlagged: number;
  unmatchedRookies: string[]; // display names of rookies not in players table
};

/**
 * Idempotent: sets is_rookie=true on every players row whose
 * (canonical_name, position) matches a rookie from the FP rookies page.
 *
 * Players not present in the rookies set are left alone (does NOT
 * unset is_rookie=false on previously-flagged rookies, so a player
 * accidentally double-counted across years stays flagged).
 *
 * Also fills in fp_slug if the players row had it NULL.
 *
 * Wrapped in a scrape_runs row for audit consistency with the other
 * ingest paths. We tag the run as `source=fantasypros, format=ppr`
 * arbitrarily — the scrape_runs schema doesn't have a `format=meta`
 * option and this row isn't writing any ADP snapshots anyway.
 */
export async function markRookies(args: {
  rookies: RookieIdentity[];
  sourceUrl: string;
  rawPayload: Uint8Array;
  contentType: string;
}): Promise<MarkRookiesSummary> {
  const conn = db();

  const [run] = await conn
    .insert(schema.scrapeRuns)
    .values({
      source: "fantasypros",
      format: "ppr",
      sourceUrl: args.sourceUrl,
      status: "pending",
    })
    .returning({ id: schema.scrapeRuns.id });

  try {
    await conn.insert(schema.rawPayloads).values({
      scrapeRunId: run.id,
      sourceUrl: args.sourceUrl,
      contentType: args.contentType,
      payload: args.rawPayload,
    });

    if (args.rookies.length === 0) {
      await closeRun(run.id, "success", 0, null);
      return {
        scrapeRunId: run.id,
        rookiesParsed: 0,
        playersMatched: 0,
        playersNewlyFlagged: 0,
        unmatchedRookies: [],
      };
    }

    // 1. Pull every players row whose (canonical_name, position) matches
    //    a rookie identity. Done in one query via two parallel arrays.
    const names = args.rookies.map((r) => r.canonicalName);
    const positions = args.rookies.map((r) => r.position);
    const dedupNames = Array.from(new Set(names));
    const dedupPos = Array.from(new Set(positions));

    const candidates = await conn
      .select({
        id: schema.players.id,
        canonicalName: schema.players.canonicalName,
        position: schema.players.position,
        isRookie: schema.players.isRookie,
        fpSlug: schema.players.fpSlug,
      })
      .from(schema.players)
      .where(
        and(
          inArray(schema.players.canonicalName, dedupNames),
          inArray(schema.players.position, dedupPos),
        ),
      );

    // 2. Build a quick lookup from rookie identity to "is in candidate set".
    const candidateKey = (n: string, p: string) => `${n}|${p}`;
    const candidateMap = new Map<
      string,
      (typeof candidates)[number]
    >();
    for (const c of candidates) {
      candidateMap.set(candidateKey(c.canonicalName, c.position), c);
    }

    // 3. Walk the rookies list — count matches + collect unmatched names.
    const matched: typeof candidates = [];
    const unmatchedRookies: string[] = [];
    const fpSlugByPlayerId = new Map<number, string>();

    for (const r of args.rookies) {
      const found = candidateMap.get(candidateKey(r.canonicalName, r.position));
      if (!found) {
        unmatchedRookies.push(`${r.displayName} (${r.position})`);
        continue;
      }
      matched.push(found);
      if (!found.fpSlug && r.fpSlug) {
        fpSlugByPlayerId.set(found.id, r.fpSlug);
      }
    }

    const playersNewlyFlagged = matched.filter((m) => !m.isRookie).length;

    // 4. Set is_rookie=true for every match. Use one UPDATE keyed by id list.
    const matchedIds = matched.map((m) => m.id);
    if (matchedIds.length > 0) {
      await conn
        .update(schema.players)
        .set({ isRookie: true, updatedAt: new Date() })
        .where(
          and(
            inArray(schema.players.id, matchedIds),
            eq(schema.players.isRookie, false),
          ),
        );
    }

    // 5. Fill in any newly-discovered fp_slug values per-player (rare path).
    for (const [playerId, slug] of fpSlugByPlayerId) {
      await conn
        .update(schema.players)
        .set({ fpSlug: slug, updatedAt: new Date() })
        .where(
          and(
            eq(schema.players.id, playerId),
            // only fill when still null — protects existing slugs from clobber
            sql`${schema.players.fpSlug} IS NULL`,
          ),
        );
    }

    await closeRun(run.id, "success", matched.length, null);

    return {
      scrapeRunId: run.id,
      rookiesParsed: args.rookies.length,
      playersMatched: matched.length,
      playersNewlyFlagged,
      unmatchedRookies,
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
    .where(eq(schema.scrapeRuns.id, runId));
}

// Re-export so the route can dedupe rookies down to ones not already
// flagged (a future micro-optimization; not needed today).
export { ne };
