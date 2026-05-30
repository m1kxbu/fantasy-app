/**
 * Canonical-name normalization used to match the same real-world player
 * across data sources (FFC, FantasyPros, Sleeper later). Idempotent.
 *
 * Strategy:
 *   - NFKD + strip diacritics  →  "André" / "Andre" collide
 *   - lowercase
 *   - drop suffix tokens (jr, sr, ii, iii, iv, v) so "Marvin Harrison Jr"
 *     matches "Marvin Harrison"
 *   - drop everything that isn't a-z or space, then collapse whitespace
 */
const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

export function canonicalizeName(raw: string): string {
  const stripped = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return stripped
    .split(" ")
    .filter((tok) => !SUFFIXES.has(tok))
    .join(" ");
}

/** Normalize positions to our enum: QB, RB, WR, TE, K, DST. */
export function normalizePosition(raw: string): string | null {
  const up = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (up === "DEF" || up === "DST" || up === "DEFENSE") return "DST";
  if (up === "PK" || up === "K") return "K";
  if (["QB", "RB", "WR", "TE"].includes(up)) return up;
  return null;
}

/** True if position is excluded from v1 (K, DST). */
export function isExcludedPosition(position: string): boolean {
  return position === "K" || position === "DST";
}
