# Build Spec & Handoff — "Gridiron Exchange" (Fantasy Football ADP, traded like stock)

> Paste this whole file to Claude Code as the kickoff prompt. A working **v1 prototype** is attached
> (`gridiron-exchange.jsx`) — treat it as the source of truth for UX, layout, and behavior. Your job is
> to turn it into a real, production application with **live, continuously-tracked ADP movement**.

---

## 0. How to work (read first)

Use the following skills/tools and announce when you invoke them:

- **`frontend-design` skill** — use for ALL UI work. Match the prototype's "dark trading-terminal" aesthetic
  (Saira Condensed / Saira / JetBrains Mono, neon green/red on near-black, ticker tape, glow bubbles,
  TradingView-style treemap). Do not regress to generic AI styling.
- **`context7` (MCP)** — before writing code against any library, pull its **current** docs through context7
  (React, Next.js, Tailwind, Drizzle/Prisma, d3 / d3-force / d3-hierarchy, TanStack Query, Playwright/Cheerio,
  node-cron, Recharts). My training data may be stale; verify APIs via context7 rather than guessing.
- **`superpowers` skills** — use these explicitly:
  - *brainstorming / requirements* skill to pressure-test scope before coding,
  - *writing-plans* to produce `PLAN.md` and get my sign-off before building,
  - *test-driven-development* for the data pipeline + ADP-diff logic (this is the riskiest part — test it),
  - *systematic-debugging* if anything misbehaves (root-cause, don't patch symptoms),
  - *git worktrees / using-git-worktrees* if you parallelize frontend vs backend.
- **Markdown / doc-management** — maintain living docs in the repo and keep them updated as you go:
  `PLAN.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `PROGRESS.md`, `DECISIONS.md`. Update PROGRESS at the end
  of every work session.
- Work in **small, tested increments**. Commit often with clear messages. Don't bundle unrelated changes.

**Before any code:** produce `PLAN.md` (milestones + task list + open questions) and stop for my review.

---

## 1. The concept

A dashboard that visualizes fantasy football players **like stocks / crypto tokens**, where the "price" is
their **ADP (Average Draft Position)** and the headline signal is **how their draft stock is moving over time**.
Think *cryptobubbles.net* + *TradingView crypto heatmap*, but for NFL fantasy players, sourced from FantasyPros.

The whole point of the product is the **movement**: which players are rising or falling in ADP over 1 day,
7 days, 14 days, and 30 days. The prototype currently *simulates* movement because a one-time scrape can't
produce historical deltas. **Your #1 job is to make movement real** by snapshotting ADP on a schedule and
computing true deltas. Everything else in the prototype is already correct behavior.

### Reference material
- v1 prototype (attached): `gridiron-exchange.jsx` — React single-file artifact. Mirror its features/UX.
- Visual references: `cryptobubbles.net` (bubbles view) and TradingView crypto heatmap
  (`tradingview.com/heatmap/crypto/` with `blockSize=market_cap`, `blockColor=24h change`, `grouping=no_group`).
- Data source: FantasyPros ADP (see §4).

---

## 2. Conventions & semantics (lock these in)

- **ADP**: lower number = drafted earlier = more valuable. So a player's ADP *decreasing* over time = their
  **stock is rising**.
- **Color**: **green = rising stock (ADP got earlier/lower)**, **red = falling stock (ADP got later/higher)**,
  gray ≈ flat. (This matches the prototype. Confirm with me before flipping.)
- **Delta units**: the prototype shows movement as **draft spots moved** (e.g. `▲ 4.2` = moved up 4.2 spots).
  **OPEN QUESTION for the owner:** keep "spots moved", or switch to "% change in ADP"? Build it so the unit is
  a single config flag and easy to swap. (Owner leaning undecided — ask.)
- **Timeframes**: `1D`, `7D`, `14D`, `30D`. These drive BOTH the color in the visualizations AND the "movers"
  sort in the table.
- **Best Ball is a top-level scoring mode**, NOT a position filter. The user must be able to switch the whole
  app between **PPR** and **Best Ball** ADP and still filter by position within either. (This is deliberate and
  important — see §5.)
- **Kickers & DST are out of scope for v1** (revisit in v3). Only ever include a kicker/DST if it is actually
  being drafted inside the top ~300 overall picks; for now, exclude them.

---

## 3. Recommended tech stack

Pick equivalents if you have strong reasons, but default to:

- **Next.js (App Router) + TypeScript** — one repo for the web app, the read API, and the cron/scrape job.
- **Tailwind CSS** for styling (the prototype's look is achievable; load the same Google Fonts).
- **d3-force + d3-hierarchy** for the bubbles (force layout) and heatmap (treemap) math, rendered as SVG/React.
- **TanStack Query** for client data fetching/caching.
- **Postgres** (Supabase or Neon) with **Drizzle ORM** (or Prisma) for ADP snapshots + computed deltas.
- **Cheerio** (HTML parsing) for scraping FantasyPros; **node-cron** or the host's scheduler (Vercel Cron /
  GitHub Actions) for the daily snapshot.
- **Playwright** for E2E tests of the dashboard; **Vitest** for unit tests of the diff logic.

> The browser **cannot** fetch FantasyPros directly (CORS + it's HTML, not an API). All scraping happens
> server-side; the client only talks to *our* API. This server layer is also what makes movement real.

---

## 4. Data source & ingestion

FantasyPros publishes consensus ADP as server-rendered HTML tables (updated daily). Endpoints used to build
the prototype's real dataset:

- PPR overall: `https://www.fantasypros.com/nfl/adp/ppr-overall.php`
- Best Ball overall: `https://www.fantasypros.com/nfl/adp/best-ball-overall.php`
- Rookies: `https://www.fantasypros.com/nfl/adp/rookies.php`
- Position pages exist too (e.g. `/qb.php`, `/ppr-rb.php`, `/best-ball-wr.php`) but **overall pages already
  carry the POS column** (e.g. `RB1`, `WR12`), so you can derive position + position-rank from the overall
  tables without scraping every position page.

Each overall row gives: `Rank`, `Player`, `Team`, `Bye`, `POS` (position + position-rank), `AVG` (the ADP),
and a link to the player's FantasyPros page (`/nfl/players/<slug>.php`) — **capture that slug**; it's needed
for v2 deep-links and player matching.

### Ingestion job (the core of the build)
1. **Daily** (and ideally a couple times/day during draft season), fetch PPR-overall + Best-Ball-overall +
   rookies.
2. Parse rows → normalize into players (dedupe by FantasyPros slug as the stable key; name is not unique enough).
3. Write one **snapshot row per player per scoring-format per run** with the captured ADP and a `captured_at`.
4. Be polite: realistic User-Agent, request throttling, retries w/ backoff, and **store the raw HTML per run**
   so you can re-parse historically if the markup changes.
5. Respect FantasyPros' ToS/robots; cache aggressively; never hammer. If they offer an API/partner feed, prefer it.

### Movement = computed from snapshots
Deltas are **derived**, never stored as ground truth from the source:
- `delta(window) = adp_at(now - window) - adp_current` (positive = rose = stock up).
- Compute for 1D/7D/14D/30D using the nearest snapshot at/just-before each cutoff (tolerate gaps; if no
  snapshot old enough exists yet, return `null`/"insufficient history", don't fake it).
- Also expose the **last-30-days ADP series** per player for the detail-panel sparkline.

> Until you have 30 days of real snapshots, the longer windows will legitimately be empty. Surface that
> honestly in the UI ("not enough history yet") rather than simulating. Backfill is impossible (FantasyPros
> doesn't expose historical daily ADP cleanly), so movement starts accumulating from day 1 of ingestion.

---

## 5. Feature spec — v1 (match the prototype)

### Global controls (shared by the visualization AND the list — one source of truth)
- **Scoring mode toggle:** `PPR` | `Best Ball`. Switches which ADP dataset powers everything. In Best Ball
  mode, only include players that actually have a Best Ball ADP.
- **Position tabs:** `Overall` | `QB` | `RB` | `WR` | `TE` | `Rookies`. (No K/DST in v1.) `Rookies` filters to
  rookies across all positions.
- **Timeframe:** `1D` | `7D` | `14D` | `30D` — controls coloring + movers sort everywhere.
- **Multi-filters:** Team (multi-select), and these compose with the position/rookie filters.
- **Search** by player name.
- **Size-by** (affects the visuals): `ADP value` (studs biggest) | `Movement` (biggest movers biggest) |
  `Uniform`. Mirrors TradingView's "size by market cap / mono size."

### Upper container — two views, toggleable
1. **Bubbles** — loose, floating, force-directed circles (NOT tight circle-packing). Size by the size-by
   setting; fill/glow color by the selected-timeframe delta (green up / red down / gray flat); label = last
   name + delta on larger bubbles. Gentle continuous float animation. Hover tooltip, click opens detail.
   *(The refined prototype already does this via d3-force with `forceCollide` gaps + ~40% area fill + a CSS
   "bobble" animation — reuse that approach.)*
2. **Heat Map** — flat treemap (TradingView style), `grouping=no_group`. Tile size by size-by setting; tile
   color by delta; team-color spine on each tile; a gradient **legend** (falling → rising) below it. Hover
   tooltip, click opens detail.

A **ticker tape** of the biggest movers (selected timeframe) scrolls across the top.

### Lower container — FantasyPros-style list
- Columns: `Rank` · `Player (Team, Bye)` · `POS` (with position-rank, color-coded) · `ADP (AVG)` · `Δ (window)`.
- Respects every global filter/scoring/timeframe selection.
- Sortable by **ADP** (default) and by **Movers** (selected timeframe). Rookie tag on rookies.
- Clicking a row opens the player detail panel.

### Player detail panel (v1 = the bridge to v2)
Slide-in drawer showing: PPR ADP, Best Ball ADP, overall rank, the four movement windows, a **30-day ADP
sparkline** (from real snapshots), and a link to the player's FantasyPros page. Include a clearly-labeled
"Coming in v2" stats placeholder.

### Robustness (don't regress this)
- A bad filter/timeframe/size combination must never crash the view — wrap the visualizations in an error
  boundary that recovers when controls change (the prototype does this).
- Empty states for "no players match" and "not enough history yet."

---

## 6. v2 — player detail / stats (design for it now, build after v1 ships)
On clicking a player name, populate the detail panel with:
- Multi-season stats (e.g., receiving/rushing lines for a WR/RB), pulled from a stats source.
- Injury history.
- Prior-season ADP comparison (you'll have this for free once snapshots accumulate across seasons; for past
  seasons, FantasyPros exposes year-tabbed ADP pages, e.g. `?...` with a year selector — evaluate scraping
  historical-season overall ADP once).
- Any other player-relevant context.
Pick a stats provider during v2 planning (options to evaluate: nflverse/nfl-data-py datasets, ESPN/Sleeper
public endpoints, Pro-Football-Reference w/ caching). Document the choice in `DECISIONS.md`.

## 7. v3 — maybe (parking lot)
Kickers & DST, league-format presets, user accounts/watchlists, alerts on big movers, half-PPR/Standard modes.

---

## 8. Data model (starting point — refine in `DATA_MODEL.md`)

```
players            (id, fp_slug UNIQUE, name, position, team, bye, is_rookie, created_at, updated_at)
adp_snapshots      (id, player_id FK, format ENUM['ppr','best_ball'], adp NUMERIC,
                    pos_rank INT, overall_rank INT, captured_at TIMESTAMPTZ,
                    UNIQUE(player_id, format, captured_at))
-- deltas are computed on read (or materialized in a view / nightly job) from adp_snapshots
scrape_runs        (id, source_url, format, status, raw_html_ref, started_at, finished_at, row_count, error)
```

Read API (server → client) should return, per player for the current format: current ADP, overall/pos rank,
team, bye, rookie flag, fp_slug, and `{ "1D":Δ|null, "7D":Δ|null, "14D":Δ|null, "30D":Δ|null }`, plus the
30-day series for detail views.

---

## 9. Definition of done (v1)
- [ ] Daily server-side ingestion of PPR + Best Ball + rookies into Postgres, with raw-HTML retention and
      monitoring/logging of each run.
- [ ] Real deltas computed from snapshots for all four windows (with honest "insufficient history" handling).
- [ ] Web app reproduces the prototype: scoring toggle, position tabs, timeframe, team multi-filter, search,
      size-by, Bubbles (loose force layout) + Heat Map (treemap+legend) with shared state, ticker tape,
      FantasyPros-style sortable list, detail drawer with real sparkline.
- [ ] Color/units semantics per §2; Best Ball behaves as a scoring mode per §5.
- [ ] No view can hard-crash (error boundary + empty states).
- [ ] Unit tests for the diff logic; E2E smoke test for the dashboard; CI green.
- [ ] `PLAN.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `PROGRESS.md`, `DECISIONS.md` present and current.
- [ ] Deploy target wired (Vercel + Neon/Supabase or equivalent) with the cron schedule configured.

## 10. Open questions to ask the owner before/while building
1. Movement unit: **spots moved** vs **% change in ADP**? (build it switchable either way)
2. Confirm color direction: **green = ADP getting earlier (stock up)** — keep as-is?
3. Snapshot cadence: once daily, or 2–3×/day during peak draft season?
4. Should "Best Ball" reuse the same movement history, or track its own BB snapshots for deltas?
   (Recommended: track BB separately so BB movers are real BB movement.)
5. Hosting preference (Vercel? other?) and any budget constraints on the DB.

---

### Attachments referenced
- `gridiron-exchange.jsx` — the working v1 prototype (UX/behavior source of truth; movement is simulated there).
