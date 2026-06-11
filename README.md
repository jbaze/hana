# Книжарница HANA — SAP HANA vs PostgreSQL Benchmark Demo

Full-stack web application for a Bachelor thesis that demonstrates the
performance characteristics of **SAP HANA** (in-memory, column-store) versus
**PostgreSQL** (disk-based row-store) on analytical workloads, using an online
bookstore as the case study.

The app runs the *same* analytical queries against *both* databases on
*identical* datasets, measures real execution time, and visualizes the
comparison. **No number shown in the UI is ever fabricated** — everything comes
from real query executions performed at click time.

All user-facing UI text is in Macedonian (Cyrillic); code, schema, SQL and
comments are in English.

## Pages

| Route | Page | Content |
| --- | --- | --- |
| `/` | Дома | Live KPIs from HANA, top-genres chart, revenue trend, recent orders |
| `/knigi` | Книги | Searchable, paginated catalog with genre filter |
| `/sporedba` | Споредба | The core benchmark page: per-query and run-all comparisons |
| `/za-proektot` | За проектот | Architecture, methodology, limitations, tech stack |

## Prerequisites

1. **SAP HANA Cloud** free tier instance ([sign up](https://www.sap.com/products/technology-platform/hana/cloud.html)).
   - In *Connections*, set **Allowed connections** to *Allow all IP addresses* (trial).
   - Note: the free tier **auto-stops** (daily). Start it from SAP BTP Cockpit before use.
2. **PostgreSQL** — a [Neon](https://neon.tech) or [Supabase](https://supabase.com)
   free-tier instance, ideally in the same cloud region as HANA for a fair
   comparison. Any plain connection string works (local/VPS Postgres too).
3. Node.js 20+.

## Setup

```bash
npm install
cp .env.example .env   # fill in HANA_* and POSTGRES_URL
```

`.env` variables:

| Variable | Meaning |
| --- | --- |
| `HANA_HOST` / `HANA_PORT` | HANA Cloud SQL endpoint (port is usually 443) |
| `HANA_USER` / `HANA_PASSWORD` | Database user (e.g. `DBADMIN` on a trial) |
| `HANA_ENCRYPT` / `HANA_SSL_VALIDATE_CERT` | TLS settings, defaults are fine |
| `POSTGRES_URL` | Standard Postgres connection string |
| `SEED_SCALE` | `demo` (default, fits free tiers) or `large` (~5×, local only) |
| `BENCHMARK_RUNS` | Default measured runs per benchmark (UI can override) |

## Seeding

Run **locally** (never as a serverless route):

```bash
npm run seed                    # both databases
npm run seed -- --only=postgres # one database at a time, if needed
npm run seed -- --only=hana
```

The script is idempotent (drop + recreate), generates a deterministic dataset
(seeded faker, both databases receive identical data), bulk-loads via
multi-row INSERTs (Postgres) and prepared-statement batch execution (HANA),
and prints final row counts and approximate table sizes.

`demo` scale: 2 000 authors, 30 000 books, 50 000 customers, 300 000 orders,
~750 000 order items (1–5 per order), 150 000 reviews — sized to fit a 0.5 GB
free tier. Loading takes a few minutes depending on network distance.

## Running

```bash
npm run dev                    # development
npm run build && npm start     # production build (local / VPS fallback)
```

## Benchmark methodology

- Each measurement: **1 warm-up run (discarded) + N measured runs** per database.
- Timing wraps **only the driver call** on the server — no JSON serialization
  to the browser, no rendering.
- Median is the primary metric (robust to outliers); mean/min/max and all raw
  runs are also shown.
- Where available, **engine-reported time** is shown alongside the server
  round-trip: PostgreSQL via `EXPLAIN (ANALYZE, FORMAT JSON)` Execution Time,
  HANA via `M_SQL_PLAN_CACHE` counter deltas over the measured runs (requires
  monitoring-view privilege; shown as `—` otherwise).
- The query set deliberately includes a **transactional point lookup** where
  HANA's column-store advantage disappears — the comparison is honest, not
  cherry-picked. Limitations are stated openly on the "За проектот" page.

## Deployment

### Vercel (primary)

`@sap/hana-client` is a **native module**. The repo is preconfigured:

- `next.config.ts` sets `serverExternalPackages: ['@sap/hana-client']` and
  `outputFileTracingIncludes` so the native binaries are traced into the
  serverless bundle.
- All DB routes force `export const runtime = 'nodejs'` — never edge.

Steps: import the repo in Vercel → set the env vars from `.env` → deploy →
in HANA Cloud, make sure allowed connections include the app (allow-all on a
trial).

If the native client cannot be bundled reliably on Vercel for your
account/region, use the fallback below — do not fake it.

### Fallback: local or VPS

```bash
npm run build && npm start     # or:
docker build -t knizarnica-hana .
docker run --env-file .env -p 3000:3000 knizarnica-hana
```

Put it behind a subdomain with any reverse proxy if presenting from a VPS.

## Presentation-day checklist

1. **Start the HANA Cloud instance** from SAP BTP Cockpit (the free tier
   auto-stops). Wait until status is *Running* (~5 min).
2. Confirm allowed connections include the app host (allow-all on trial).
3. Open the app: the **Дома** dashboard loading proves HANA is reachable.
4. Open **Споредба** and run one warm-up benchmark end-to-end (both engines
   answer, chart renders). First runs after instance start are slower — that's
   the point of warm-ups.
5. Verify PostgreSQL is awake (Neon/Supabase free tiers can cold-start: the
   first query may take a few seconds, after that it's warm).
6. Have the **fallback ready**: a local `npm run build && npm start` with the
   same `.env`, tested the night before.
7. If a database is unreachable during the demo, the UI shows a clear
   Macedonian error message instead of fake numbers — recover by starting the
   instance and re-running.

## Project structure

```
app/                  # Next.js App Router pages + API routes
  api/benchmark/      # POST: runs a benchmark (Node runtime)
  api/dashboard/      # GET: live KPIs from HANA
  api/books/          # GET: catalog search/pagination from HANA
  sporedba/           # core comparison page
components/           # Nav, charts (recharts), UI primitives
lib/
  db/hana.ts          # promisified @sap/hana-client + tiny pool
  db/postgres.ts      # postgres.js singleton
  queries.ts          # the curated benchmark query set (both dialects)
  benchmark.ts        # warm-up + N runs, medians, engine-reported timings
  strings.ts          # ALL Macedonian UI strings, centralized
scripts/seed.ts       # local seeding for both databases
sql/                  # DDL: hana-schema.sql, postgres-schema.sql
```
