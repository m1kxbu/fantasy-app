import { NextResponse } from "next/server";
import {
  FP_ROOKIES_URL,
  fetchFpRookies,
} from "@/lib/sources/fantasypros-rookies";
import { markRookies } from "@/lib/mark-rookies";
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
    const { raw, contentType, rookies } = await fetchFpRookies(userAgent);

    const summary = await markRookies({
      rookies,
      sourceUrl: FP_ROOKIES_URL,
      rawPayload: new TextEncoder().encode(raw),
      contentType,
    });

    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message, sourceUrl: FP_ROOKIES_URL },
      { status: 500 },
    );
  }
}
