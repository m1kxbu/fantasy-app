# Data model

Source of truth: `migrations/0001_init.sql`. Drizzle mirror:
`src/db/schema.ts`.

## Tables

### `players`
One row per real-world athlete, with optional alias columns per data
source. Identity key is `(canonical_name, position)`.

| col            | type        | notes                                |
| -------------- | ----------- | ------------------------------------ |
| id             | SERIAL PK   | internal                              |
| canonical_name | TEXT NOT NULL | normalized (NFKD + lower + suffix-strip) |
| display_name   | TEXT NOT NULL | pretty name as shown                |
| position       | TEXT NOT NULL CHECK in (QB,RB,WR,TE,K,DST) | |
| team           | TEXT NULL   | NULL for free agents                 |
| bye_week       | SMALLINT NULL | 1–18                               |
| is_rookie      | BOOLEAN NOT NULL DEFAULT false | populated from rookies feed (v1.1) |
| fp_slug        | TEXT NULL   | e.g. `bijan-robinson`                |
| ffc_id         | TEXT NULL   | FFC numeric player_id (as string)    |
| created_at     | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |
| updated_at     | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

UNIQUE `(canonical_name, position)`. Indexed on `fp_slug`, `ffc_id`,
`position`, `team`.

**Identity resolution.** When a row arrives from any source:

1. compute `canonical_name` from `canonicalizeName(displayName)`
2. `INSERT … ON CONFLICT (canonical_name, position) DO UPDATE` with
   `COALESCE(EXCLUDED.team, players.team)` etc., so a known field
   isn't overwritten by NULL when the second source's row is sparser.
3. set `fp_slug` / `ffc_id` only if NULL (a source binds its own
   alias the first time it sees the player).

Collisions to watch (handle with a manual override table later if it
ever bites): two real players with same name + position (rare — e.g.
"Mike Williams" WR vs WR; current rosters don't have collisions in
2026).

---

### `scrape_runs`
One row per ingest attempt.

| col          | type        | notes                                |
| ------------ | ----------- | ------------------------------------ |
| id           | SERIAL PK   |                                      |
| source       | TEXT in (ffc, fantasypros) | |
| format       | TEXT in (ppr, best_ball) | |
| source_url   | TEXT        | the full URL fetched                 |
| status       | TEXT in (pending, success, parse_error, fetch_error) | |
| started_at   | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |
| finished_at  | TIMESTAMPTZ NULL | set when status transitions to terminal |
| row_count    | INT NULL    | number of `adp_snapshots` rows written |
| error        | TEXT NULL   | error message on failure             |

---

### `raw_payloads`
Source-of-truth bytes per scrape, so we can re-parse history if HTML
or JSON shapes change.

| col           | type        | notes                                |
| ------------- | ----------- | ------------------------------------ |
| id            | SERIAL PK   |                                      |
| scrape_run_id | INT NOT NULL FK scrape_runs(id) ON DELETE CASCADE | |
| source_url    | TEXT NOT NULL |                                    |
| content_type  | TEXT NOT NULL | text/html or application/json      |
| payload       | BYTEA NOT NULL | exact response bytes              |
| captured_at   | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

For tonight we store uncompressed bytes. If the table grows beyond
~500 MB, swap to gzip in the writer and a `payload_encoding` column.

---

### `adp_snapshots`
The time series. One row per `(player, source, format, captured_at)`.

| col            | type           | notes                              |
| -------------- | -------------- | ---------------------------------- |
| id             | BIGSERIAL PK   |                                    |
| player_id      | INT NOT NULL FK players(id) ON DELETE CASCADE | |
| source         | TEXT in (ffc, fantasypros) | |
| format         | TEXT in (ppr, best_ball) | |
| adp            | NUMERIC(6,2) NOT NULL | the consensus ADP value     |
| overall_rank   | INT NULL       | derived if source doesn't supply   |
| pos_rank       | INT NULL       | derived if source doesn't supply   |
| times_drafted  | INT NULL       | FFC only                          |
| adp_high       | NUMERIC(6,2) NULL | FFC only                       |
| adp_low        | NUMERIC(6,2) NULL | FFC only                       |
| adp_stdev      | NUMERIC(6,2) NULL | FFC only                       |
| captured_at    | TIMESTAMPTZ NOT NULL DEFAULT NOW() | normalized to UTC midnight at ingest |
| scrape_run_id  | INT NULL FK scrape_runs(id) ON DELETE SET NULL | |

UNIQUE `(player_id, source, format, captured_at)`. Indexed on
`(player_id, format, captured_at DESC)` for delta lookups and on
`captured_at DESC` for housekeeping.

---

### `_migrations`
Bookkeeping for the `npm run migrate` script.

---

## Why this schema works for multi-source from day 1

Every snapshot is tagged with `source` and `format`. To add Sleeper
(v1.2) or FantasyPros-PPR (v1.1):

- write a new parser in `src/lib/sources/`
- write a new route in `src/app/api/cron/`
- call `ingest({ source: 'sleeper', format: 'ppr', ... })`

No schema change. Read API can either pick the newest snapshot per
player+format (current behavior) or filter by source via a new query
param (`?source=ffc|fantasypros|sleeper`).

## Delta semantics

See `src/lib/deltas.ts` for the implementation. Each window has a
continuous non-overlapping age band so a single snapshot only
qualifies for one window — preventing a week-old snapshot from
filling in a "1D" delta and lying about the timeframe.

| age (days)   | window |
| ------------ | ------ |
| (0, 4]       | 1D     |
| (4, 10.5]    | 7D     |
| (10.5, 22]   | 14D    |
| (22, 60]     | 30D    |

Within its band, the window picks the snapshot whose age is closest
to ideal. Returns `null` if no qualifying snapshot exists.
