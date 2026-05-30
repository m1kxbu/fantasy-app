# PROGRESS

Session log per the handoff. Updated at the end of each work session.

---

## 2026-05-30 — Session 1 (Claude Code, single sitting)

### Shipped
- Repo bootstrapped, pushed to `m1kxbu/fantasy-app` on GitHub.
- Next.js 16 + Tailwind v4 + TS scaffold, security-vetted deps,
  `npm audit` clean.
- Postgres schema (4 tables) + raw SQL migrations + ~140-line
  hand-rolled migrator.
- FFC PPR ingest route (`/api/cron/ingest-ffc`).
- FantasyPros Best Ball scraper (`/api/cron/ingest-fp-bb`). Verified
  on live HTML: 453 rows parsed (32 DST, 68 QB, 114 RB, 72 TE, 167
  WR) with slugs, byes, teams extracted correctly.
- Read API (`/api/players?format=…`) with honest-null deltas and
  503 graceful failure when DATABASE_URL is missing.
- Delta math module with 17 vitest cases (all green). Window age
  buckets are non-overlapping so a single snapshot can't lie about
  multiple timeframes.
- Frontend port: Dashboard, Bubbles (d3-force), Heatmap (d3-hierarchy
  treemap), Legend, Drawer, VizBoundary. CSS migrated from the
  prototype's inline string into `globals.css`. Saira / Saira
  Condensed / JetBrains Mono via `next/font`.
- `vercel.json` schedules both cron jobs (FFC 13:00 UTC, FP 13:10
  UTC). Cron auth accepts both `?secret=` (manual curl) and
  `Authorization: Bearer` (Vercel Cron) with constant-time compare.
- `DEPLOY.md` / `ARCHITECTURE.md` / `DATA_MODEL.md` / `DECISIONS.md`
  written. Owner is handling the Vercel + Neon provisioning step.

### Still owed (post-session)
- Owner deploys to Vercel; provisions Neon via marketplace; sets
  `CRON_SECRET`; runs `npm run migrate`; manually triggers both
  ingest jobs to land day-1 snapshots.
- Once history accumulates, the dashboard's deltas stop being `—`
  and start coloring the bubbles / heatmap / movers ticker.

### Decisions logged
See `DECISIONS.md`. Highlights:
- Hybrid FFC (PPR) + FP (BB), Sleeper deferred until owner sees v1
  live.
- Drop TanStack Query and drizzle-kit (CVE / transitive-CVE risk).
- Hand-scaffold Next.js, force postcss >= 8.5.15 via `overrides` to
  resolve the moderate CVE bundled in Next 16.2.6.
- `.npmrc ignore-scripts=true` to block postinstall malware
  channels.
- Delta windows use non-overlapping age buckets, not nearest-
  at-or-before.

### Known limitations / explicit deferrals
- **Rookie detection** is currently always `false` on FantasyPros
  rows because the BB overall page doesn't carry that flag. Fix:
  scrape `/nfl/adp/rookies.php` and cross-reference fp_slug. Tagged
  for v1.1.
- **PPR data comes from FFC's mock-draft pool**, not FantasyPros'
  multi-site composite. The numbers will diverge from
  fantasypros.com PPR. Owner will decide whether to add FP-PPR as a
  second source after v1 ships.
- **Sleeper** entirely deferred.
- **Volatility halo** from FFC's `stdev` is captured in the schema
  (`adp_stdev`) but not yet visualized.
- **Playwright E2E** skipped; manual browser smoke test is the v1
  acceptance bar.

### CI / quality gates
- `npm run lint` → `tsc --noEmit`, clean.
- `npm run test` → vitest, 17/17 green.
- `npm audit` → 0 vulnerabilities.
- `npm run build` → production build clean, 5 routes total
  (1 static page, 3 dynamic API routes, 1 `_not-found`).

### Next session candidates
1. Watch first prod cron actually fire; verify rows land in Neon.
2. Add `/nfl/adp/rookies.php` ingest + cross-reference for `is_rookie`.
3. Decide whether to add FP-PPR + Sleeper based on real usage.
4. Wire Sentry once errors stop being grep-able from Vercel logs.
