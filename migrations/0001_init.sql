-- Gridiron Exchange — initial schema
-- Multi-source-aware: a `players` row is the canonical identity for a real-world
-- athlete; ADP snapshots are stamped with which source they came from
-- ('ffc' | 'fantasypros') and which scoring format ('ppr' | 'best_ball').

CREATE TABLE IF NOT EXISTS players (
  id              SERIAL PRIMARY KEY,
  canonical_name  TEXT        NOT NULL,
  display_name    TEXT        NOT NULL,
  position        TEXT        NOT NULL CHECK (position IN ('QB','RB','WR','TE','K','DST')),
  team            TEXT,
  bye_week        SMALLINT,
  is_rookie       BOOLEAN     NOT NULL DEFAULT FALSE,
  fp_slug         TEXT,
  ffc_id          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (canonical_name, position)
);
CREATE INDEX IF NOT EXISTS idx_players_fp_slug  ON players (fp_slug)  WHERE fp_slug  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_ffc_id   ON players (ffc_id)   WHERE ffc_id   IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_position ON players (position);
CREATE INDEX IF NOT EXISTS idx_players_team     ON players (team);

CREATE TABLE IF NOT EXISTS scrape_runs (
  id           SERIAL PRIMARY KEY,
  source       TEXT        NOT NULL CHECK (source IN ('ffc','fantasypros')),
  format       TEXT        NOT NULL CHECK (format IN ('ppr','best_ball')),
  source_url   TEXT        NOT NULL,
  status       TEXT        NOT NULL CHECK (status IN ('pending','success','parse_error','fetch_error')),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ,
  row_count    INT,
  error        TEXT
);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_started ON scrape_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS raw_payloads (
  id              SERIAL PRIMARY KEY,
  scrape_run_id   INT         NOT NULL REFERENCES scrape_runs(id) ON DELETE CASCADE,
  source_url      TEXT        NOT NULL,
  content_type    TEXT        NOT NULL,
  payload         BYTEA       NOT NULL,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_raw_payloads_scrape_run ON raw_payloads (scrape_run_id);

CREATE TABLE IF NOT EXISTS adp_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  player_id       INT          NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  source          TEXT         NOT NULL CHECK (source IN ('ffc','fantasypros')),
  format          TEXT         NOT NULL CHECK (format IN ('ppr','best_ball')),
  adp             NUMERIC(6,2) NOT NULL,
  overall_rank    INT,
  pos_rank        INT,
  times_drafted   INT,           -- FFC only; NULL for FP
  adp_high        NUMERIC(6,2),  -- FFC only
  adp_low         NUMERIC(6,2),  -- FFC only
  adp_stdev       NUMERIC(6,2),  -- FFC only
  captured_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  scrape_run_id   INT          REFERENCES scrape_runs(id) ON DELETE SET NULL,
  UNIQUE (player_id, source, format, captured_at)
);
CREATE INDEX IF NOT EXISTS idx_adp_snapshots_player_captured
  ON adp_snapshots (player_id, format, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_adp_snapshots_captured
  ON adp_snapshots (captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_adp_snapshots_format_source
  ON adp_snapshots (format, source, captured_at DESC);

-- Bookkeeping: which migrations have been applied
CREATE TABLE IF NOT EXISTS _migrations (
  id          SERIAL PRIMARY KEY,
  filename    TEXT        NOT NULL UNIQUE,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
