const SUFFIX = new Set(["jr.", "jr", "sr.", "sr", "ii", "iii", "iv"]);

/** Show "Chase" not "Ja'Marr Chase" when space is tight; handles
 *  multi-word surnames (St. Brown, Van Noy, De Mello, Le Caron). */
export function lastName(n: string): string {
  const parts = n.split(" ").filter((x) => !SUFFIX.has(x.toLowerCase()));
  let last = parts[parts.length - 1] ?? n;
  if (
    parts.length >= 2 &&
    /^(st\.|de|van|le)$/i.test(parts[parts.length - 2])
  ) {
    last = `${parts[parts.length - 2]} ${last}`;
  }
  return last;
}

/** Format a delta as ▲/▼/− with one decimal. Null becomes "—". */
export function fmtDelta(d: number | null): string {
  if (d === null) return "—";
  const sign = d > 0 ? "+" : d < 0 ? "−" : "±";
  return `${sign}${Math.abs(d).toFixed(1)}`;
}

export function fmtDeltaArrow(d: number | null): string {
  if (d === null) return "—";
  return d > 0 ? "▲" : d < 0 ? "▼" : "–";
}
