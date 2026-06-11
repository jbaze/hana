# Claude Code build prompt: SAP HANA vs PostgreSQL demo (online bookstore)

Paste everything below into Claude Code as the initial task. It is written so Claude Code can scaffold the whole project, the seed pipeline, the benchmark engine, and the UI in one coherent pass.

---

## Context and goal

Build a full-stack web application for a Bachelor thesis that demonstrates the performance advantage of **SAP HANA** (in-memory, column-store, multi-model) over **PostgreSQL** (classic disk-based row-store) on analytical workloads. The case study is an **online bookstore**.

The app runs the *same* analytical queries against *both* databases on *identical* datasets, measures real execution time, and visualizes the comparison. It also ships a small but real-looking bookstore dashboard and catalog so the demo reads as a product, not just a benchmark script.

Audience: a thesis committee. Two hard requirements:
1. It must be reliable on presentation day.
2. All user-facing UI text must be in **Macedonian (Cyrillic)**. Code identifiers, the database schema, SQL, and code comments stay in English for maintainability.

Honesty matters academically. Never fabricate timings or data. Every number shown in the UI must come from a real query execution. Surface the methodology and the limitations openly inside the app.

## Tech stack

- Next.js (App Router, latest stable) with TypeScript, strict mode
- Tailwind CSS for styling
- recharts for charts
- `@sap/hana-client` for HANA connectivity
- `postgres` (postgres.js) for PostgreSQL
- `@faker-js/faker` for data generation
- Deployment target: Vercel as primary. The app must also run with `npm run dev` and as a production build (`npm run build && npm start`) for a local or VPS-hosted fallback.

## Databases

1. **SAP HANA Cloud** free tier, reached over env vars.
2. **PostgreSQL**, ideally a cloud instance (Neon or Supabase free tier) in the same cloud region as HANA so the comparison is as fair as possible. Also support a plain connection string so a local or VPS Postgres can be swapped in.

Provide a `.env.example` with:
```
HANA_HOST=
HANA_PORT=443
HANA_USER=
HANA_PASSWORD=
HANA_ENCRYPT=true
HANA_SSL_VALIDATE_CERT=false

POSTGRES_URL=

SEED_SCALE=demo   # demo | large
BENCHMARK_RUNS=5
```

## Data model

English schema, Macedonian only in the UI layer. Six tables:

- `authors` (author_id, name, nationality, birth_year)
- `books` (book_id, title, author_id FK, genre, price, stock, published_year)
- `customers` (customer_id, name, email, city, registered_at)
- `orders` (order_id, customer_id FK, ordered_at)
- `order_items` (order_item_id, order_id FK, book_id FK, quantity, unit_price)
- `reviews` (review_id, book_id FK, customer_id FK, rating 1-5, created_at, comment)

Deliverables for the schema:
- HANA DDL where the large/analytical tables are explicitly **COLUMN** tables.
- PostgreSQL DDL with sensible indexes (primary keys, foreign-key indexes, and indexes on `ordered_at` and `genre`). Do not cripple Postgres by omitting reasonable indexes; the comparison must be defensible.
- Keep column types equivalent across both engines so the SQL stays logically identical.

## Seeding

A standalone script `scripts/seed.ts` that is run **locally**, never as a serverless route. It must:
- Be idempotent (truncate or drop/recreate before loading).
- Generate coherent fake data with `@faker-js/faker` (realistic genres, prices, dates spread across a few years, ratings, etc.).
- Load into **both** databases.
- Use bulk loading: `COPY` or batched multi-row inserts for Postgres, array binding / batch execute for HANA. Loading must complete in minutes, not hours.
- Print final row counts and approximate table sizes for both databases at the end (useful for the thesis and for the "За проектот" page).

Scale presets:
- `demo` (default, fits free tiers): authors 2000, books 30000, customers 50000, orders 300000, order_items ~750000, reviews 150000.
- `large` (for local runs with more storage): roughly 5x demo.

Note: Neon and Supabase free tiers are around 0.5 GB. The demo preset must fit inside that. If it does not, scale the order_items count down and document the actual counts. Print a warning if the connection looks like a constrained free tier.

## Benchmark engine

A curated query set in `lib/queries.ts`. Each entry has: `id`, Macedonian `title`, English `description`, `category` (`analytical` or `transactional`), `sqlHana`, and `sqlPostgres` (logically identical, dialect-adjusted only where needed).

Endpoint `/api/benchmark` (Node.js runtime, not edge):
- Accepts a query id and a runs count.
- For each database: 1 warm-up run (discarded) plus N measured runs (default from `BENCHMARK_RUNS`).
- Measures server-side time around the actual driver call only. Do not include JSON serialization to the browser.
- Where available, also capture engine-reported timing (Postgres `EXPLAIN (ANALYZE, FORMAT JSON)` total time; HANA statement timing). Report both "server round-trip" and "engine reported" when present so the committee sees the methodology is rigorous.
- Returns per-database arrays of timings plus median, mean, and the result row count.
- Never returns fabricated values. If a database is unreachable, return a clear error and let the UI show a Macedonian message.

Required queries (at minimum):
1. Топ 10 најпродавани книги (sum quantity, join, group, order, limit)
2. Приход по жанр по месец (group by genre and month)
3. Просечна оценка по жанр (join reviews, group)
4. Вредност на залиха по жанр (aggregation over books)
5. Купувачи со повеќе од N нарачки без ниту една рецензија (anti-join)
6. Месечен тренд на приход (time series over orders)
7. Детали за една нарачка по ID (point lookup, category `transactional`)

Include query 7 deliberately. It is a transactional point lookup where HANA's column-store advantage mostly disappears and Postgres may match or win. Showing this proves the analysis is honest rather than cherry-picked, which strengthens the thesis.

## UI and pages (all Macedonian)

Top navigation: **Дома**, **Книги**, **Споредба**, **За проектот**. App title something like "Книжарница HANA". Include loading skeletons, empty states, and error states everywhere, all in Macedonian.

- `/` **Дома (Dashboard):** live KPIs queried from HANA (вкупно книги, вкупно нарачки, вкупен приход, број на купувачи), a top-genres bar chart, a revenue-trend line chart, and a recent-orders table.
- `/knigi` **Книги:** searchable, paginated catalog from HANA with genre filters and cover placeholders. Makes the app feel real and gives clean screenshots.
- `/sporedba` **Споредба (core page):** a dropdown of queries by Macedonian title, a runs input, and an "Изврши споредба" button. On run, show a grouped bar chart (HANA vs PostgreSQL median ms), a results table, the SQL in a collapsible code block, the row count, and a short Macedonian sentence explaining why the result looks the way it does. Add an "Изврши ги сите" button that runs the full battery and renders a summary chart across all queries.
- `/za-proektot` **За проектот:** architecture diagram, the benchmark methodology in plain Macedonian, an honest "Ограничувања" section (free tier, cloud region, network, dataset size, that results vary by run), and the tech stack.

Design direction: clean, modern, restrained palette, strong visual hierarchy, generous whitespace, a typeface that renders Macedonian Cyrillic cleanly (Inter or Manrope). Responsive. It should look like a polished product, not a default template.

## Macedonian string handling

Centralize every UI string in one module (`lib/strings.ts`) so they are consistent and easy to proofread. No hardcoded Macedonian scattered through components. Example entries:
```
export const t = {
  nav: { home: "Дома", books: "Книги", compare: "Споредба", about: "За проектот" },
  dashboard: { totalBooks: "Вкупно книги", totalOrders: "Вкупно нарачки", revenue: "Вкупен приход" },
  compare: { run: "Изврши споредба", runAll: "Изврши ги сите", runs: "Број на повторувања" },
  // ...
};
```

## Deployment

- **Vercel (primary):** `@sap/hana-client` is a native module. In `next.config`, set `serverExternalPackages: ['@sap/hana-client']` (or `experimental.serverComponentsExternalPackages` depending on the Next version) and configure `outputFileTracingIncludes` for the routes that use it so the native binary is bundled. Force `export const runtime = 'nodejs'` on those routes; never edge.
- **Fallback:** if the HANA native client cannot be bundled reliably on Vercel, document it clearly and ship a fallback path: run the production build locally or on a VPS under a subdomain. Provide a minimal `Dockerfile` for the VPS option.
- **HANA Cloud free tier auto-stops.** Document that the instance must be started before the presentation, and that allowed connections must include the app host (set to allow all for the trial).
- **README** with step-by-step setup, env config, seeding, running, deploying, and a clear "Presentation-day checklist" (start HANA, confirm both DBs reachable, run a warm-up benchmark, have the fallback ready).

## Non-functional requirements

- TypeScript strict, clean module boundaries, no secrets committed.
- Graceful Macedonian error messages if a database is unreachable.
- Loading states on every async view.
- Absolutely no fabricated data or timings anywhere in the codebase.

## Suggested build order

1. Scaffold Next.js + Tailwind + TypeScript, nav, strings module, layout.
2. DB connection helpers for HANA and Postgres, DDL for both.
3. Seed script with the demo preset, verify row counts in both DBs.
4. Query library and the `/api/benchmark` engine.
5. Споредба page (the core), then Дома, then Книги, then За проектот.
6. Vercel config and the native-module handling, README, presentation checklist.
