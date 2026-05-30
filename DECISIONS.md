# Decisions

Key calls made tonight, why, and what would invalidate them.

## Data sources: hybrid FFC (PPR) + FP-scrape (BB) — Sleeper deferred

**Why:** FantasyPros has no free public API. Their official API is
partner-only with custom pricing. The "FantasyPros MCP" referenced in
search results returns 404 (dead). FFC has a clean public REST JSON
API with extras the prototype didn't have (`times_drafted`, `high`,
`low`, `stdev`). FFC has no native Best Ball format though, so BB
still comes from FantasyPros HTML.

**Tradeoff:** PPR numbers shown on the dashboard won't exactly match
fantasypros.com's PPR composite — they reflect FFC's mock-draft pool
instead. Acceptable for v1 because the trading-floor story is about
*movement*, not absolute consensus.

**Reverts if:** Owner wants strict parity with fantasypros.com's
numbers → add FP PPR as a second source and let the dashboard pick.

## Drop TanStack Query, drop drizzle-kit

**Why:** Both have material supply-chain or transitive-CVE issues
(Mini Shai-Hulud for `@tanstack/*` on 2026-05-11; abandoned
`@esbuild-kit` deps in drizzle-kit). Neither is strictly required —
native `fetch` covers our needs and hand-written SQL migrations
remove the drizzle-kit footprint entirely.

**Tradeoff:** Slightly less ergonomic. No auto-generated migrations
from schema diffs. Recoverable in v1.1+ by adopting `drizzle-kit`'s
fixed version once the @esbuild-kit issue is resolved upstream.

## Hand-scaffolded Next.js instead of `create-next-app`

**Why:** Lets every dependency be pinned to a specific known-patched
version. `package.json` `overrides` block forces Next's bundled
`postcss` up to `>=8.5.15` (fix for the May 2026 CVE that's still in
`next@16.2.6`'s default tree).

**Tradeoff:** ~30 minutes of extra setup vs. a working scaffold in
60 seconds. Paid for itself when `npm audit` came back clean.

## `.npmrc` `ignore-scripts=true`

**Why:** Mini Shai-Hulud / Antv worm patterns rely on `postinstall`
to exfiltrate. Blocking lifecycle scripts at the project level closes
that path without removing legitimate optionalDependencies (Tailwind
v4 oxide, Next.js SWC).

**Tradeoff:** Some legit deps want postinstall (rare for our tree).
Run-time still works because Tailwind v4 and Next 16 distribute
native binaries as platform-specific optionalDependencies, not
postinstall downloads.

## Delta window age buckets, not "nearest at-or-before"

**Why:** "Use whatever snapshot exists" semantics let a week-old
snapshot back-fill a "1D" delta — the timeframe label would be a lie.
Bucketing each window to a non-overlapping age range (1D = age 0–4d,
7D = 4–10.5d, 14D = 10.5–22d, 30D = 22–60d) means each snapshot
qualifies for at most one window. If the data isn't there, the
window is `null` and the UI says "—".

**Tradeoff:** If cron skips a day, some windows might briefly land on
the "wrong" snapshot during the catch-up. Acceptable; documented.

## Snapshots stamped to UTC midnight

**Why:** Idempotent. Re-running today's ingest job overwrites today's
row via `ON CONFLICT DO UPDATE` — useful for manual smoke tests and
backfills.

**Tradeoff:** Loses intra-day resolution. We chose once-daily
ingestion anyway, so no signal lost.

## Player identity = `(canonical_name, position)`

**Why:** No source-stable global ID across FFC + FP. The combination
of normalized name + position is unique enough for current rosters
(no name+position collisions in 2026 NFL). `fp_slug` and `ffc_id` are
written as aliases so each source can find "its" player after the
first ingest.

**Tradeoff:** Two real players with the same canonical name AND
position would collide. Mitigation if it happens: a small manual
overrides table that maps `(source, external_id)` directly to
`player_id`, bypassing the canonical match.

## Single Next.js monolith on Vercel

**Why:** Smallest deploy surface, one observability scope, Vercel
Cron is free (and built-in with Pro). No need to split web/scraper
until a scrape outgrows the 60s function timeout — a single
FantasyPros HTML fetch + parse runs in under 5 seconds.

**Reverts if:** Scraping multiple sources concurrently bumps against
function limits → lift the scrape jobs into GitHub Actions (write to
Neon directly) and keep Next.js for reads only.

## Skip Playwright E2E for v1

**Why:** Speed. The riskiest logic (delta math) is unit-tested with
Vitest (17 cases, all green). The UI is a faithful port of a
proven-working prototype — visual regressions are visible to the
human running the app.

**Reverts if:** Pre-merge hooks require E2E green before deploys.
Then add a single Playwright smoke that loads `/`, asserts the
header text, and asserts at least one bubble renders.
