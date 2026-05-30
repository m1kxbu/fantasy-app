import { NextResponse } from "next/server";
import { buildFfcUrl, fetchFfc } from "@/lib/sources/ffc";
import { ingest, normalizeFfcPlayer, type NormalizedRow } from "@/lib/ingest";
import { checkCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authErr = checkCronAuth(request);
  if (authErr) {
    return NextResponse.json({ error: authErr }, { status: 401 });
  }

  const url = new URL(request.url);
  const teams = numFromParam(url.searchParams.get("teams"), 12);
  const year = numFromParam(
    url.searchParams.get("year"),
    new Date().getUTCFullYear(),
  );

  const userAgent =
    process.env.SCRAPER_USER_AGENT ??
    "NoHubble/0.1 (+https://nohubble.com)";

  const sourceUrl = buildFfcUrl({ format: "ppr", teams, year });

  try {
    const { raw, parsed, contentType } = await fetchFfc(sourceUrl, userAgent);

    const rows: NormalizedRow[] = parsed.players
      .map(normalizeFfcPlayer)
      .filter((r): r is NormalizedRow => r !== null);

    const summary = await ingest({
      source: "ffc",
      format: "ppr",
      sourceUrl,
      rawPayload: new TextEncoder().encode(raw),
      contentType,
      rows,
    });

    return NextResponse.json({
      ok: true,
      meta: parsed.meta,
      summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message, sourceUrl },
      { status: 500 },
    );
  }
}

function numFromParam(v: string | null, fallback: number): number {
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
