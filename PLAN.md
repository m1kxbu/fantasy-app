# PLAN — Gridiron Exchange v1

> Living planning doc per `HANDOFF_claude_code.md`. Updated as work proceeds.

## Scope (locked)

- ADP-as-stock-price dashboard. Real movement from daily snapshots, never simulated.
- **Sources (v1):** Fantasy Football Calculator JSON API for PPR + FantasyPros HTML scrape for Best Ball.
  Sleeper and FantasyPros-PPR deferred — decided after v1 ships and is viewable.
- **Movement unit:** spots moved. Config-flag swappable to `%` later.
- **Color semantics:** green = ADP getting earlier = stock up; red = falling; gray ≈ flat.
- **Timeframes:** 1D / 7D / 14D / 30D — drive viz coloring and "movers" sort.
- **Scoring modes:** PPR + Best Ball (top-level toggle). K / DST excluded.
- **Cadence:** once daily.
- **Viewport:** desktop-first (≥ 1280 px); mobile collapses bubbles/heatmap to scrollable list.
- **v1 done = production-deployed at a public Vercel URL with Neon Postgres and a working cron.**

## Open questions — resolved
| Question | Decision |
| --- | --- |
| Movement unit | spots moved (swappable) |
| Snapshot cadence | once daily |
| BB movement history | separate snapshot stream from PPR |
| Hosting | Vercel + Neon (user has Vercel Pro) |
| Build order | ingestion-first |
| Viewport | desktop-first w/ mobile list fallback |
| Launch target | production at public URL |
| Data source | hybrid FFC (PPR) + FP scrape (BB); Sleeper + FP PPR deferred |

## Open questions — remaining (decide as we get there)
- Watchlist / favorites in v1? — leaning no (v3).
- Detail-drawer outbound link target — FP slug, FFC player page, or both? — decide when drawer wires up.

## Security: vetted dependency list

Each pinned per CVE research done at brainstorming time. `npm install --ignore-scripts` is mandatory.

| Package | Min version | Reason |
| --- | --- | --- |
| `next` | ^15.5.18 or ^16.2.6 | May 2026 omnibus — fixes CVE-2025-55182 (RCE in RSC), CVE-2026-23864 (DoS), 11 others |
| `react`, `react-dom` | ^19.2.6 | React2Shell (CVSS 10.0) fix |
| `drizzle-orm` | ^0.45.2 | CVE-2026-39356 SQL injection fix |
| `@neondatabase/serverless` | latest | No known CVEs |
| `cheerio` | ^1.2.0 | Post-prototype-pollution fix |
| `d3-force`, `d3-hierarchy` | latest (verify Socket) | Post May 2026 supply-chain cleanup |
| `lucide-react` | latest (verify Socket) | Icons (prototype uses it) |
| `zod` | latest | Input validation at boundaries |
| `vitest` (dev) | latest | Delta-math unit tests |

Explicitly **not** installed:
- `@tanstack/react-query` — May 2026 Mini Shai-Hulud incident; we use native `fetch` + Server Components instead.
- `drizzle-kit` — abandoned `@esbuild-kit` transitive deps; we hand-write SQL migrations + a ~20-line migrator.
- `node-cron` — Vercel Cron HTTP triggers fill this role.
- `playwright` — deferred; manual browser smoke-test for v1.

## Milestones (tonight)

1. **M1 — Repo + scaffold.** `git init`, this file, `.gitignore`, Next.js + TS + Tailwind scaffold, fonts loaded (Saira Condensed / Saira / JetBrains Mono).
2. **M2 — Data layer.** Neon connection via Vercel marketplace integration. Hand-written SQL migrations + Drizzle schema: `players`, `adp_snapshots`, `scrape_runs`, `raw_payloads`.
3. **M3 — FFC ingest.** `/api/cron/ingest-ffc` parses FFC JSON, writes PPR snapshots.
4. **M4 — FantasyPros BB scrape.** `/api/cron/ingest-fp-bb` cheerio-parses BB overall HTML, writes BB snapshots.
5. **M5 — Read API.** `/api/players?format=ppr|best_ball&position=...` returns `{ player, adp, ranks, deltas:{1D,7D,14D,30D}, series30d }` with honest `null` for insufficient history.
6. **M6 — Delta math.** Pure function module + vitest unit tests for nearest-snapshot lookup and delta computation.
7. **M7 — Frontend port.** Move prototype's UX into App Router components. Preserve CSS, fonts, animations, error boundaries. Swap `RAW` with the read API.
8. **M8 — Detail drawer.** PPR ADP, BB ADP, four movement windows, 30-day sparkline (will be a single dot day 1), link to FP player page.
9. **M9 — Deploy.** Vercel project, Neon via marketplace, env vars, GitHub remote push, first prod deploy at `fantasy-app-<hash>.vercel.app`.
10. **M10 — Cron + smoke test.** Wire `vercel.json` cron entries for both ingest routes, manually trigger via `?secret=...`, verify rows land in Neon.
11. **M11 — PROGRESS.md + DECISIONS.md.** Wrap-up notes; session log.

## Honest-empty-on-day-1 surfaces

- All deltas (no prior snapshots) — UI shows "no history yet" with a small info icon.
- Sparkline — a single dot until day 2.
- Movers sort — same set as ADP sort until day 2.

## Deferred (post-tonight decision)

- Sleeper as third source.
- FantasyPros PPR (vs FFC PPR).
- Volatility halo from FFC's `stdev`.
- Multi-source divergence visualization.
- Playwright E2E.
- Sentry / analytics.
- Watchlists, alerts, user accounts (v3).

## Risks tracked

- FantasyPros markup change → re-parse from `raw_payloads` blob using a new selector.
- FFC API rate-limit or shape change → snapshot raw JSON the same way.
- Vercel cron not firing in early account state → manual trigger via secret URL as fallback.
- Player identity collisions between FFC numeric IDs and FP slugs — handled by a name+team+position resolver, with manual overrides table for edge cases (Tank Dell vs. Tank Bigsby etc.).
