# МебелИС — Информациски систем за производствено претпријатие

Practical part of the diploma thesis **"Примена на информациски системи во
производните претпријатија"** — a working prototype of an integrated
information system for a fictional furniture manufacturer („Мебел ДОО" —
Битола). It implements the full production flow from the thesis:

**Клиент → Нарачка → проверка на материјали (норматив) → Производствен налог →
Производство → Контрола на квалитет → Магацин → Испорака**

The entire UI is in Macedonian; code, schema and comments are in English.

## Брзо стартување (quick start)

```bash
npm ci             # инсталација точно според package-lock.json
npm run dev        # стартување: http://localhost:3020
```

Production build: `npm run build && npm start` (also port 3020).

The database is a **single local SQLite file**. A pre-seeded copy
(`data/mebelis.seed.db`, ~190 KB, committed to the repository) is used to
self-initialize on first start — **no seed script needs to be run**. To reset
to the clean demo state, delete `data/mebelis.db` and restart, or run
`npm run seed` to regenerate everything from scratch (deterministic, same
dataset every time).

> Security note: `npm ci` installs the exact dependency versions pinned in
> the committed `package-lock.json` (6 runtime dependencies). Nothing else is
> downloaded or executed.

## Deployment (Vercel)

The app deploys to Vercel as-is:

1. In Vercel: **Add New → Project** → import this repository.
2. Set **Root Directory** to `fabrika` (Framework: Next.js is auto-detected).
3. Deploy — no environment variables are needed.

On Vercel the deployment filesystem is read-only, so at runtime the bundled
seed database is copied to `/tmp` (see `lib/db.ts`). Reading works exactly
like locally; **writes work but are ephemeral** — they survive within a warm
serverless instance and reset when it recycles. That makes the Vercel
deployment ideal for showing the system and even walking an order through the
flow, while the authoritative demo for the defense is the local run, where
the database is a real persistent file.

## Screens (сите на македонски)

| Route | Екран | Содржина |
| --- | --- | --- |
| `/` | Контролна табла | KPI показатели, нарачки по месец, критични залихи, последни нарачки |
| `/naracki` | Нарачки | Креирање нарачка, проверка на материјали, старт на производство, испорака |
| `/proizvodstvo` | Производство | Производствени налози, завршување кон контрола |
| `/kvalitet` | Квалитет | Внес исправни/неисправни, историја на контроли |
| `/magacin` | Магацин | Залихи на материјали и готови производи, набавка, движења |
| `/proizvodi` | Производи | Каталог со норматив на материјали (BOM) и цена на чинење |
| `/klienti` | Клиенти | Целосен CRUD на клиенти |
| `/izvestai` | Извештаи | Производство по месец, вредност на испораки, шкарт по производ |

## How it works

- **`lib/db.ts`** — SQLite schema (8 tables), created automatically on first access.
- **`lib/flow.ts`** — the business-flow engine. Every state change (start
  production, finish, quality check, delivery, purchase) is a transactional
  function: materials are consumed against the bill of materials, finished
  goods enter stock only after quality control, and every stock change is
  logged in `stock_movements`. The UI never manipulates data directly — it
  only calls these functions through the API routes.
- **`scripts/seed.ts`** — inserts master data, then *replays* ~135 orders over
  14 months **through the same flow functions**, so the demo data is exactly
  what the system would contain after a year of real use. Deterministic
  (seeded PRNG): reseeding always produces the same dataset.
- **`app/api/*`** — REST-style routes (Node runtime) used by the React pages.

## Thesis artifacts

`docs/diagrams/` contains the four diagrams for the written thesis, as SVG and
print-ready PNG (2× resolution):

- `er` — ЕР модел на базата
- `use-case` — дијаграм на случаи на употреба
- `architecture` — архитектура на системот
- `process` — тек на производствениот процес

Regenerate after any schema/flow change with `node scripts/diagrams.mjs`
(SVG only; the PNGs are exported from the SVGs).

## Demo walkthrough for the defense

1. Отвори **Контролна табла** — покажи ги показателите и критичните залихи.
2. **Клиенти** → додади нов клиент.
3. **Нарачки** → нова нарачка (клиент, производ, количина) → „Проверка на
   материјали" ја покажува пресметката норматив × количина.
4. Ако недостигаат материјали → **Магацин** → „Набавка".
5. **Нарачки** → „Започни производство" (материјалите се трошат автоматски).
6. **Производство** → „Заврши производство" → налогот оди во контрола.
7. **Квалитет** → внеси исправни/неисправни → готовите влегуваат во магацин.
8. **Нарачки** → „Испорачај" → статус „Испорачана".
9. **Магацин** → покажи ги движењата на залихата (секој чекор е евидентиран).
10. **Извештаи** → месечно производство, вредност на испораки, шкарт стапка.

If anything goes wrong during a live demo, delete `data/mebelis.db` and
restart the app — it re-initializes from the committed seed copy in seconds.
