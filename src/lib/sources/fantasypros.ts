/**
 * FantasyPros consensus ADP scraper.
 *
 * Strategy: HTML scrape of the public overall pages (PPR + Best Ball).
 * The "AVG" column is the consensus ADP we care about — it's the LAST
 * column of every data row regardless of how many individual sources
 * (Underdog / BB10 / Drafters / DraftKings / ...) are aggregated above
 * it, so the parser keys off "last td" rather than a fixed index.
 *
 * Rookie detection is not derivable from this page; we cross-reference
 * /nfl/adp/rookies.php separately when we want it. For v1 best-ball
 * ingestion we leave is_rookie=false and revisit later.
 */

import * as cheerio from "cheerio";
import { canonicalizeName, normalizePosition } from "@/lib/canonicalize";
import type { NormalizedRow } from "@/lib/ingest";

export const FP_BB_OVERALL_URL =
  "https://www.fantasypros.com/nfl/adp/best-ball-overall.php";
export const FP_PPR_OVERALL_URL =
  "https://www.fantasypros.com/nfl/adp/ppr-overall.php";

export type FpScrapeResult = {
  raw: string;
  contentType: string;
  rows: NormalizedRow[];
};

export async function fetchAndParseFp(
  url: string,
  userAgent: string,
  signal?: AbortSignal,
): Promise<FpScrapeResult> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
    signal,
  });

  if (!res.ok) {
    throw new Error(
      `FantasyPros fetch failed: HTTP ${res.status} ${res.statusText}`,
    );
  }
  const contentType = res.headers.get("content-type") ?? "text/html";
  const raw = await res.text();
  const rows = parseFpAdpTable(raw);
  return { raw, contentType, rows };
}

export function parseFpAdpTable(html: string): NormalizedRow[] {
  const $ = cheerio.load(html);
  const out: NormalizedRow[] = [];

  // The ADP table is keyed by id="data" across PPR / BB / position pages.
  const rows = $("table#data tbody tr");
  if (rows.length === 0) {
    throw new Error("FantasyPros: table#data tbody tr not found");
  }

  rows.each((_, tr) => {
    const tds = $(tr).children("td");
    if (tds.length < 4) return; // header or summary row

    const rankRaw = tds.eq(0).text().trim();
    const overallRank = Number.parseInt(rankRaw, 10);
    if (!Number.isFinite(overallRank)) return;

    const playerCell = tds.eq(1);
    const anchor = playerCell.find("a.player-name").first();
    if (anchor.length === 0) return;

    const href = anchor.attr("href") ?? "";
    const slugMatch = href.match(/\/players\/([^/.]+)\.php/);
    const teamPageMatch = href.match(/\/teams\/([^/.]+)\.php/);
    const fpSlug = slugMatch ? slugMatch[1] : null;

    const rawDisplay =
      anchor.attr("fp-player-name") ?? anchor.text().trim();
    let displayName = rawDisplay.replace(/\s+DST$/i, "").trim();
    if (!displayName) return;

    const smalls = playerCell.find("small");
    let team: string | null = null;
    let byeWeek: number | null = null;

    smalls.each((__, sm) => {
      const txt = $(sm).text().trim();
      const byeMatch = txt.match(/^\((\d+)\)$/);
      if (byeMatch) {
        byeWeek = Number.parseInt(byeMatch[1], 10);
      } else if (/^[A-Z]{2,3}$/.test(txt)) {
        team = txt;
      }
    });

    // Position + position-rank, e.g. "RB1", "WR12", "DST3"
    const posCell = tds.eq(2).text().trim();
    const posMatch = posCell.match(/^([A-Z]+)(\d+)?$/);
    if (!posMatch) return;
    const position = normalizePosition(posMatch[1]);
    if (!position) return;
    const posRank = posMatch[2] ? Number.parseInt(posMatch[2], 10) : null;

    // AVG = last td
    const avgRaw = tds.eq(tds.length - 1).text().trim();
    const adp = Number.parseFloat(avgRaw);
    if (!Number.isFinite(adp)) return;

    // Defenses use a /teams/ URL instead of /players/; we still capture the
    // team-page slug into fp_slug so multi-source identity stays consistent.
    const slugForDb = fpSlug ?? (teamPageMatch ? teamPageMatch[1] : null);

    out.push({
      canonicalName: canonicalizeName(displayName),
      displayName,
      position,
      team,
      byeWeek,
      isRookie: false,
      fpSlug: slugForDb,
      ffcId: null,
      adp,
      overallRank,
      posRank,
      timesDrafted: null,
      adpHigh: null,
      adpLow: null,
      adpStdev: null,
    });
  });

  return out;
}
