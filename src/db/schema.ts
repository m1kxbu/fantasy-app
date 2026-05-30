import {
  pgTable,
  serial,
  bigserial,
  integer,
  smallint,
  text,
  boolean,
  timestamp,
  numeric,
  customType,
  unique,
  index,
} from "drizzle-orm/pg-core";

// Drizzle doesn't ship a built-in bytea helper; tiny custom type covers it.
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver(value) {
    return Buffer.from(value);
  },
  fromDriver(value) {
    return value instanceof Uint8Array ? value : new Uint8Array(value);
  },
});

export const players = pgTable(
  "players",
  {
    id: serial("id").primaryKey(),
    canonicalName: text("canonical_name").notNull(),
    displayName: text("display_name").notNull(),
    position: text("position").notNull(),
    team: text("team"),
    byeWeek: smallint("bye_week"),
    isRookie: boolean("is_rookie").notNull().default(false),
    fpSlug: text("fp_slug"),
    ffcId: text("ffc_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    canonicalUnique: unique("players_canonical_name_position_key").on(
      t.canonicalName,
      t.position,
    ),
    fpSlugIdx: index("idx_players_fp_slug").on(t.fpSlug),
    ffcIdIdx: index("idx_players_ffc_id").on(t.ffcId),
    positionIdx: index("idx_players_position").on(t.position),
    teamIdx: index("idx_players_team").on(t.team),
  }),
);

export const scrapeRuns = pgTable(
  "scrape_runs",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    format: text("format").notNull(),
    sourceUrl: text("source_url").notNull(),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    rowCount: integer("row_count"),
    error: text("error"),
  },
  (t) => ({
    startedIdx: index("idx_scrape_runs_started").on(t.startedAt),
  }),
);

export const rawPayloads = pgTable(
  "raw_payloads",
  {
    id: serial("id").primaryKey(),
    scrapeRunId: integer("scrape_run_id")
      .notNull()
      .references(() => scrapeRuns.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    contentType: text("content_type").notNull(),
    payload: bytea("payload").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    scrapeRunIdx: index("idx_raw_payloads_scrape_run").on(t.scrapeRunId),
  }),
);

export const adpSnapshots = pgTable(
  "adp_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    format: text("format").notNull(),
    adp: numeric("adp", { precision: 6, scale: 2 }).notNull(),
    overallRank: integer("overall_rank"),
    posRank: integer("pos_rank"),
    timesDrafted: integer("times_drafted"),
    adpHigh: numeric("adp_high", { precision: 6, scale: 2 }),
    adpLow: numeric("adp_low", { precision: 6, scale: 2 }),
    adpStdev: numeric("adp_stdev", { precision: 6, scale: 2 }),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    scrapeRunId: integer("scrape_run_id").references(() => scrapeRuns.id, {
      onDelete: "set null",
    }),
  },
  (t) => ({
    playerSourceFormatTimeUnique: unique("adp_snapshots_dedupe_key").on(
      t.playerId,
      t.source,
      t.format,
      t.capturedAt,
    ),
    playerCapturedIdx: index("idx_adp_snapshots_player_captured").on(
      t.playerId,
      t.format,
      t.capturedAt,
    ),
    capturedIdx: index("idx_adp_snapshots_captured").on(t.capturedAt),
    formatSourceIdx: index("idx_adp_snapshots_format_source").on(
      t.format,
      t.source,
      t.capturedAt,
    ),
  }),
);

export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type AdpSnapshot = typeof adpSnapshots.$inferSelect;
export type NewAdpSnapshot = typeof adpSnapshots.$inferInsert;
export type ScrapeRun = typeof scrapeRuns.$inferSelect;
export type NewScrapeRun = typeof scrapeRuns.$inferInsert;

export const ADP_SOURCES = ["ffc", "fantasypros"] as const;
export type AdpSource = (typeof ADP_SOURCES)[number];

export const SCORING_FORMATS = ["ppr", "best_ball"] as const;
export type ScoringFormat = (typeof SCORING_FORMATS)[number];

export const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"] as const;
export type Position = (typeof POSITIONS)[number];
