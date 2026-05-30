import { NextResponse } from "next/server";
import {
  FP_BB_OVERALL_URL,
  fetchAndParseFp,
} from "@/lib/sources/fantasypros";
import { ingest } from "@/lib/ingest";
import { checkCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authErr = checkCronAuth(request);
  if (authErr) {
    return NextResponse.json({ error: authErr }, { status: 401 });
  }

  const userAgent =
    process.env.SCRAPER_USER_AGENT ??
    "NoHubble/0.1 (+https://nohubble.com)";

  try {
    const { raw, contentType, rows } = await fetchAndParseFp(
      FP_BB_OVERALL_URL,
      userAgent,
    );

    const summary = await ingest({
      source: "fantasypros",
      format: "best_ball",
      sourceUrl: FP_BB_OVERALL_URL,
      rawPayload: new TextEncoder().encode(raw),
      contentType,
      rows,
    });

    return NextResponse.json({
      ok: true,
      sourceUrl: FP_BB_OVERALL_URL,
      summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message, sourceUrl: FP_BB_OVERALL_URL },
      { status: 500 },
    );
  }
}
