# Deploy — manual click-through guide

You're deploying this yourself on Vercel + Neon. Here's the exact path
that gets a public URL with daily cron and accumulating history.

## 1. Create the Vercel project

```bash
npx vercel login         # opens browser
npx vercel link          # in this directory; pick or create "fantasy-app"
```

Or use the Vercel dashboard → Import GitHub Repo →
`m1kxbu/fantasy-app`. Framework auto-detected as Next.js.

## 2. Provision Neon (Postgres) via the Vercel Marketplace

Dashboard → your project → **Storage** tab → **Create Database** →
**Neon (Postgres)**. Accept the free tier (or whatever plan you
prefer). Vercel will:

- create a Neon project linked to this Vercel project
- auto-inject `DATABASE_URL` as an env var (Production + Preview +
  Development)
- enable connection pooling

No `.env.local` needed locally if you run `npx vercel env pull` after.

## 3. Set the cron secret

```bash
# generate a strong secret
openssl rand -hex 32
# copy the output
npx vercel env add CRON_SECRET production
# paste when prompted; choose "production" scope at minimum
```

Optional: also add it to `preview` if you want to manually trigger
ingest on preview deploys.

Optional polite-scraper UA (already has a sensible default):

```bash
npx vercel env add SCRAPER_USER_AGENT production
# paste:  GridironExchange/0.1 (+https://github.com/m1kxbu/fantasy-app)
```

## 4. Pull env down + run migrations

```bash
npx vercel env pull .env.local      # writes DATABASE_URL + CRON_SECRET
npm run migrate                     # applies migrations/0001_init.sql
```

Re-running `npm run migrate` is safe (idempotent — tracked in
`_migrations`).

## 5. First deploy

```bash
npx vercel deploy --prod
```

The cron is already declared in `vercel.json`:

| Job                | Schedule (UTC) | Path                       |
| ------------------ | -------------- | -------------------------- |
| FFC PPR ingest     | 13:00 daily    | `/api/cron/ingest-ffc`     |
| FantasyPros BB     | 13:10 daily    | `/api/cron/ingest-fp-bb`   |

Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.

## 6. Smoke-test in prod

After the deploy succeeds, trigger both ingest jobs manually so day-1
snapshots exist immediately (otherwise you wait until 13:00 UTC):

```bash
SECRET="<the value you generated>"
URL="https://your-deploy.vercel.app"

curl -s "$URL/api/cron/ingest-ffc?secret=$SECRET" | jq .
curl -s "$URL/api/cron/ingest-fp-bb?secret=$SECRET" | jq .
curl -s "$URL/api/players?format=ppr"      | jq '.players | length'
curl -s "$URL/api/players?format=best_ball" | jq '.players | length'
```

You should see ~150 PPR rows and ~420 BB rows. Visit the deploy URL
and you'll see all the dashboard chrome with the bubbles and table
populated. All delta columns will show "—" (no history yet); they
start populating tomorrow when the cron runs again.

## 7. What "honest empty" looks like on day 1

- Ticker reads `No movement yet — snapshots accumulating`.
- All `Δ 1D/7D/14D/30D` cells render as `—`.
- Bubble & treemap fill colors are all gray (`#2a2f3a`).
- Player drawer sparklines show `Not enough history yet`.

This is correct. The dashboard becomes "alive" on day 2 once a
24-hour-old snapshot exists for the 1D window; the 7/14/30D windows
fill in over the following days.

## 8. Failure modes & where to look

- **`DATABASE_URL is not set`** in `/api/players` response → env var
  not pulled / not assigned to the right Vercel environment.
- **`unauthorized`** from a cron route → `CRON_SECRET` mismatched or
  unset for the environment serving the request.
- **`FantasyPros fetch failed: HTTP 403`** → they rate-limited the UA;
  set a less generic `SCRAPER_USER_AGENT` and back off the cron to
  once daily.
- **`adp_snapshots` UNIQUE violation** → two cron runs landed in the
  same UTC second. The route uses `ON CONFLICT DO UPDATE`, so this
  should be impossible in practice; if you see it, file a bug.
- The `scrape_runs` table has one row per attempt with status +
  error; query it for forensics:

  ```sql
  SELECT id, source, format, status, row_count, error, started_at
  FROM scrape_runs
  ORDER BY started_at DESC
  LIMIT 20;
  ```

- `raw_payloads` keeps the byte-perfect source response per run, so
  if a future FP HTML change breaks the parser you can re-derive
  history from disk.
