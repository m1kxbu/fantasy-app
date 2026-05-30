import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "DATABASE_URL is not set. Migrations cannot run without a Neon target.",
    );
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  await sql.query(
    `CREATE TABLE IF NOT EXISTS _migrations (
       id          SERIAL PRIMARY KEY,
       filename    TEXT NOT NULL UNIQUE,
       applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  );

  const appliedRows = (await sql.query(
    `SELECT filename FROM _migrations`,
  )) as Array<{ filename: string }>;
  const applied = new Set(appliedRows.map((r) => r.filename));

  const migrationsDir = resolve(process.cwd(), "migrations");
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }

  let applyCount = 0;
  for (const filename of files) {
    if (applied.has(filename)) {
      console.log(`✓ ${filename} already applied`);
      continue;
    }
    const path = resolve(migrationsDir, filename);
    const body = await readFile(path, "utf8");
    console.log(`→ applying ${filename}`);
    const statements = splitTopLevelStatements(body);
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed.length === 0) continue;
      await sql.query(trimmed);
    }
    await sql.query(`INSERT INTO _migrations (filename) VALUES ($1)`, [
      filename,
    ]);
    applyCount += 1;
    console.log(`✓ ${filename} applied`);
  }

  console.log(`Done. ${applyCount} migration(s) applied.`);
}

function splitTopLevelStatements(sqlText: string): string[] {
  // Naive but sufficient for our hand-written migrations: split on `;` that
  // sits outside string literals and comments. Migrations should not embed
  // dollar-quoted strings; if that changes, switch to a proper SQL splitter.
  const out: string[] = [];
  let buf = "";
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sqlText.length; i++) {
    const c = sqlText[i];
    const n = sqlText[i + 1];

    if (inLineComment) {
      buf += c;
      if (c === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      buf += c;
      if (c === "*" && n === "/") {
        buf += n;
        i++;
        inBlockComment = false;
      }
      continue;
    }
    if (inSingle) {
      buf += c;
      if (c === "'" && sqlText[i - 1] !== "\\") inSingle = false;
      continue;
    }
    if (inDouble) {
      buf += c;
      if (c === '"' && sqlText[i - 1] !== "\\") inDouble = false;
      continue;
    }

    if (c === "-" && n === "-") {
      inLineComment = true;
      buf += c;
      continue;
    }
    if (c === "/" && n === "*") {
      inBlockComment = true;
      buf += c;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      buf += c;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      buf += c;
      continue;
    }

    if (c === ";") {
      out.push(buf);
      buf = "";
      continue;
    }

    buf += c;
  }
  if (buf.trim().length > 0) out.push(buf);
  return out;
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
