/**
 * Fantasy Football Calculator (FFC) ADP source.
 *
 * Endpoint: https://fantasyfootballcalculator.com/api/v1/adp/{format}?teams=12&year=YYYY
 * Public, free, JSON. Returns up to ~150 players incl. K/DST (we filter).
 *
 * No native "best ball" format on FFC; we only use this for PPR.
 */

import { z } from "zod";

export const FFC_BASE = "https://fantasyfootballcalculator.com/api/v1/adp";

/** Map our internal format → FFC's URL segment. */
export function ffcFormatSegment(format: "ppr"): string {
  if (format === "ppr") return "ppr";
  throw new Error(`FFC does not support format: ${format as string}`);
}

const FfcPlayerSchema = z.object({
  player_id: z.union([z.number(), z.string()]),
  name: z.string().min(1),
  position: z.string().min(1),
  team: z.string().nullable().optional(),
  adp: z.number(),
  adp_formatted: z.string().optional(),
  times_drafted: z.number().int().nonnegative().optional(),
  high: z.number().int().optional(),
  low: z.number().int().optional(),
  stdev: z.number().nonnegative().optional(),
  bye: z.number().int().nullable().optional(),
});

const FfcResponseSchema = z.object({
  status: z.string().optional(),
  meta: z
    .object({
      type: z.string(),
      teams: z.number().int(),
      rounds: z.number().int(),
      total_drafts: z.number().int(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
    })
    .partial(),
  players: z.array(FfcPlayerSchema),
});

export type FfcResponse = z.infer<typeof FfcResponseSchema>;
export type FfcPlayer = z.infer<typeof FfcPlayerSchema>;

export function buildFfcUrl(opts: {
  format: "ppr";
  teams?: number;
  year?: number;
}): string {
  const teams = opts.teams ?? 12;
  const year = opts.year ?? new Date().getUTCFullYear();
  return `${FFC_BASE}/${ffcFormatSegment(opts.format)}?teams=${teams}&year=${year}`;
}

export async function fetchFfc(
  url: string,
  userAgent: string,
  signal?: AbortSignal,
): Promise<{ raw: string; parsed: FfcResponse; contentType: string }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "application/json",
    },
    cache: "no-store",
    signal,
  });

  if (!res.ok) {
    throw new Error(`FFC fetch failed: HTTP ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") ?? "application/json";
  const raw = await res.text();

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(`FFC response was not valid JSON: ${(err as Error).message}`);
  }

  const parsed = FfcResponseSchema.parse(json);
  return { raw, parsed, contentType };
}
