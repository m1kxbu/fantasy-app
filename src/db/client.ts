import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Cache connections across requests in dev to avoid hot-reload pool churn.
neonConfig.fetchConnectionCache = true;

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Provision Neon via Vercel marketplace, " +
        "or copy a connection string into .env.local.",
    );
  }
  return url;
}

// Lazy singleton so importing the schema module without env vars is safe.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  if (_db) return _db;
  const sql = neon(getConnectionString());
  _db = drizzle(sql, { schema });
  return _db;
}

export { schema };
