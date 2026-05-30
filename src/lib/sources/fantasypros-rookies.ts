/**
 * FantasyPros rookies-only ADP page.
 *
 * Endpoint: https://www.fantasypros.com/nfl/adp/rookies.php
 *
 * The page uses the exact same `table#data` shape as the overall pages,
 * so we reuse parseFpAdpTable for the heavy lifting. The only thing
 * unique about it is *which* players appear — they're all rookies.
 * We extract them as a slim "rookie identity" set (canonical_name +
 * position + fp_slug), discard the ADP / rank fields (those belong to
 * a separate pool than the overall consensus), and feed the result to
 * markRookies() to update the players table.
 */

import { parseFpAdpTable } from "./fantasypros";

export const FP_ROOKIES_URL = "https://www.fantasypros.com/nfl/adp/rookies.php";

export type RookieIdentity = {
  canonicalName: string;
  displayName: string;
  position: string;
  fpSlug: string | null;
};

export async function fetchFpRookies(
  userAgent: string,
  signal?: AbortSignal,
): Promise<{ raw: string; contentType: string; rookies: RookieIdentity[] }> {
  const res = await fetch(FP_ROOKIES_URL, {
    headers: {
      "User-Agent": userAgent,
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
    signal,
  });

  if (!res.ok) {
    throw new Error(
      `FantasyPros rookies fetch failed: HTTP ${res.status} ${res.statusText}`,
    );
  }
  const contentType = res.headers.get("content-type") ?? "text/html";
  const raw = await res.text();
  const rows = parseFpAdpTable(raw);

  const rookies: RookieIdentity[] = rows.map((r) => ({
    canonicalName: r.canonicalName,
    displayName: r.displayName,
    position: r.position,
    fpSlug: r.fpSlug,
  }));

  return { raw, contentType, rookies };
}
