# Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Vercel (Next.js 16 App Router, TypeScript)                  │
│                                                              │
│   ┌─────────────────────┐    ┌──────────────────────────┐   │
│   │   /  (RSC shell)    │ →  │   <Dashboard/>           │   │
│   │  src/app/page.tsx   │    │   "use client"           │   │
│   └─────────────────────┘    │   fetches both formats    │   │
│                              │   in parallel            │   │
│                              └────────────┬─────────────┘   │
│                                           │                 │
│        ┌──────────────────────────────────┴──────┐          │
│        │                                          │          │
│        ▼                                          ▼          │
│   /api/players?format=ppr|best_ball       /api/cron/...      │
│   reads adp_snapshots + players          fetch + parse +     │
│   computes deltas in src/lib/deltas.ts   ingest via          │
│   returns honest-null for missing        src/lib/ingest.ts   │
│   history                                                    │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP (Vercel Cron, daily)
                       │ Authorization: Bearer $CRON_SECRET
                       │
        ┌──────────────┴──────────────┐
        ▼                              ▼
   FFC JSON API                FantasyPros HTML
   (PPR only)                  (Best Ball only)
                                       │
                                       ▼
                                ┌────────────────┐
                                │  Neon Postgres │
                                │  • players     │
                                │  • adp_snaps   │
                                │  • scrape_runs │
                                │  • raw_payloads│
                                └────────────────┘
```

## Modules

- **`src/db/`** — Drizzle schema, Neon-HTTP client singleton, raw-SQL
  migrator. No drizzle-kit (vulnerable transitive deps).
- **`src/lib/sources/`** — one parser per source. Each returns
  `NormalizedRow[]` + raw bytes for archival.
  - `ffc.ts` — zod-validated JSON
  - `fantasypros.ts` — cheerio HTML
- **`src/lib/ingest.ts`** — source-agnostic writer. Opens
  `scrape_runs` row, archives raw bytes, batch-UPSERTs `players` and
  `adp_snapshots`, closes the run.
- **`src/lib/deltas.ts`** — pure delta math. Non-overlapping age
  buckets per window (1D/7D/14D/30D). Tested.
- **`src/app/api/`** — route handlers (Node runtime).
- **`src/components/`** — client-only dashboard UI. Bubbles +
  Heatmap + Drawer + Legend, error-boundary-wrapped.

## Data flow on a typical day

1. **13:00 UTC** — Vercel Cron pings `/api/cron/ingest-ffc`.
2. Route fetches `fantasyfootballcalculator.com/api/v1/adp/ppr` with
   the polite UA. Parses 150 players.
3. Opens a `scrape_runs` row, stores raw JSON in `raw_payloads`,
   batch-UPSERTs ~120 player rows (K/DST filtered) and matching
   `adp_snapshots` keyed on `UTC midnight`.
4. **13:10 UTC** — same for `/api/cron/ingest-fp-bb` against the
   FantasyPros Best Ball overall page (~420 rows after DST filter).
5. **Anytime** — a browser hits `/`. Dashboard fetches both
   `/api/players?format=ppr` and `?format=best_ball` in parallel.
6. Read API pulls last 31 days of snapshots per format, groups by
   player, joins to `players`, computes deltas + sparkline in JS,
   returns JSON. ~150 KB total over the wire.
7. Client renders bubbles + heatmap + table from the merged
   `DashboardPlayer[]`. Both formats hung off each player so the
   drawer can show PPR + BB ADP simultaneously.

## Security posture

- `.npmrc` enforces `ignore-scripts=true` so no postinstall code runs
  on dev or CI dep installs.
- All dependency versions pinned to known-patched releases (see
  `PLAN.md` § Security).
- `package.json` `overrides` pulls Next's bundled postcss up to
  `>=8.5.15` (CVE fix).
- Cron routes use constant-time secret comparison.
- No user-controlled SQL identifiers; all writes via Drizzle
  parameterized queries.
- Secret-scanning + push-protection are on at the GitHub repo level.
