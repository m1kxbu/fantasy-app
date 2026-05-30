/**
 * Cron route authorization. Accepts either:
 *   - `?secret=<CRON_SECRET>` query param (handy for manual curl from a
 *     dev machine)
 *   - `Authorization: Bearer <CRON_SECRET>` header (Vercel Cron sends
 *     this automatically when CRON_SECRET is set as an env var)
 *
 * Returns null when authorized; an error message string otherwise.
 */
export function checkCronAuth(request: Request): string | null {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 8) {
    return "CRON_SECRET env var is not set (or is too short)";
  }

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("secret");
  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (queryToken && constantTimeEqual(queryToken, expected)) return null;
  if (bearerToken && constantTimeEqual(bearerToken, expected)) return null;
  return "unauthorized";
}

/** Constant-time string comparison to avoid timing attacks on the secret. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
