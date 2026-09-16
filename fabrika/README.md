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
npm install        # инсталација на зависностите
npm run seed       # креира data/mebelis.db со демо податоци (~14 месеци историја)
npm run dev        # стартување: http://localhost:3020
```

Production build: `npm run build && npm start` (also port 3020).

The database is a **single local SQLite file** (`data/mebelis.db`) — no server,
no accounts, no network. `npm run seed` recreates it from scratch at any time.

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

If anything goes wrong during a live demo, `npm run seed` restores a clean,
fully populated database in a few seconds.
