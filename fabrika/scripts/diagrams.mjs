/**
 * Generates the thesis diagrams (SVG) into docs/diagrams/:
 *   - er.svg            ER model of the database
 *   - use-case.svg      Use-case diagram
 *   - architecture.svg  System architecture
 *   - process.svg       Production process flow through the system
 *
 *   node scripts/diagrams.mjs
 *
 * All labels are in Macedonian because the diagrams go directly into the
 * thesis document.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "docs", "diagrams");
mkdirSync(OUT, { recursive: true });

const FONT = `font-family="Arial, 'Segoe UI', sans-serif"`;

/* ------------------------------ SVG helpers ------------------------------ */

function svgDoc(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="white"/>
${body}
</svg>`;
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Entity box for the ER diagram. */
function entity(x, y, title, rows, w = 230) {
  const rowH = 19;
  const headH = 28;
  const h = headH + rows.length * rowH + 8;
  let out = `<g>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="white" stroke="#334155" stroke-width="1.5"/>
<path d="M ${x} ${y + headH} H ${x + w}" stroke="#334155" stroke-width="1.2"/>
<rect x="${x}" y="${y}" width="${w}" height="${headH}" rx="8" fill="#047857" opacity="0.12"/>
<text x="${x + w / 2}" y="${y + 19}" ${FONT} font-size="14" font-weight="bold" fill="#065f46" text-anchor="middle">${esc(title)}</text>`;
  rows.forEach((r, i) => {
    const [name, mark] = Array.isArray(r) ? r : [r, ""];
    const yy = y + headH + 15 + i * rowH;
    out += `\n<text x="${x + 12}" y="${yy}" ${FONT} font-size="12" fill="#0f172a">${
      mark ? `<tspan font-weight="bold">${esc(name)}</tspan>` : esc(name)
    }</text>`;
    if (mark)
      out += `\n<text x="${x + w - 12}" y="${yy}" ${FONT} font-size="10" fill="#64748b" text-anchor="end">${mark}</text>`;
  });
  return { svg: out + "\n</g>", h, w };
}

/** Orthogonal connector with cardinality labels at the two ends. */
function link(points, fromLabel, toLabel, dashed = false) {
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
  const [x1, y1] = points[0];
  const [x2, y2] = points[points.length - 1];
  const lbl = (x, y, t, dx, dy) =>
    t
      ? `<text x="${x + dx}" y="${y + dy}" ${FONT} font-size="11" font-weight="bold" fill="#047857">${t}</text>`
      : "";
  return `<path d="${d}" fill="none" stroke="#475569" stroke-width="1.4"${dashed ? ' stroke-dasharray="5 4"' : ""}/>
${lbl(x1, y1, fromLabel, 6, -5)}${lbl(x2, y2, toLabel, -14, -5)}`;
}

/* -------------------------------- 1) ER ---------------------------------- */
{
  const parts = [];
  const E = {};
  function put(key, x, y, title, rows, w) {
    const e = entity(x, y, title, rows, w);
    E[key] = { x, y, h: e.h, w: e.w };
    parts.push(e.svg);
  }

  put("customers", 40, 90, "customers (клиенти)", [
    ["customer_id", "PK"], "name", "contact_person", "phone", "email", "city", "created_at",
  ]);
  put("orders", 440, 70, "orders (нарачки)", [
    ["order_id", "PK"], ["customer_id", "FK"], ["product_id", "FK"],
    "quantity", "status", "created_at", "updated_at",
  ]);
  put("products", 860, 70, "products (производи)", [
    ["product_id", "PK"], "code", "name", "category", "price", "stock",
  ]);
  put("pm", 860, 330, "product_materials (норматив)", [
    ["product_id", "FK"], ["material_id", "FK"], "quantity",
  ], 250);
  put("materials", 860, 490, "materials (материјали)", [
    ["material_id", "PK"], "name", "unit", "unit_price", "stock", "min_stock",
  ]);
  put("po", 440, 330, "production_orders (налози)", [
    ["po_id", "PK"], ["order_id", "FK"], ["product_id", "FK"],
    "quantity", "status", "started_at", "completed_at",
  ]);
  put("qc", 440, 600, "quality_checks (контроли)", [
    ["qc_id", "PK"], ["po_id", "FK"], "checked_qty", "good_qty", "defect_qty", "note", "checked_at",
  ]);
  put("sm", 40, 490, "stock_movements (движења)", [
    ["movement_id", "PK"], "item_type", "item_id", "change", "reason", "ref", "created_at",
  ]);

  const links = [
    // customers 1-N orders
    link([[270, 160], [440, 160]], "1", "N"),
    // products 1-N orders
    link([[860, 150], [670, 150]], "1", "N"),
    // products 1-N product_materials
    link([[975, 232], [975, 330]], "1", "N"),
    // materials 1-N product_materials
    link([[975, 490], [975, 420]], "1", "N"),
    // orders 1-N production_orders
    link([[555, 220], [555, 330]], "1", "N"),
    // production_orders 1-1 quality_checks
    link([[555, 500], [555, 600]], "1", "1"),
    // materials / products -> stock_movements (audit, dashed)
    link([[860, 560], [270, 560]], "", "N", true),
    link([[440, 700], [155, 700], [155, 660]], "", "N", true),
  ];

  const legend = `<text x="40" y="40" ${FONT} font-size="18" font-weight="bold" fill="#0f172a">ЕР модел на базата на податоци — МебелИС</text>
<text x="40" y="60" ${FONT} font-size="12" fill="#64748b">PK — примарен клуч · FK — надворешен клуч · испрекината линија — евиденција на движења на залихата</text>`;

  writeFileSync(join(OUT, "er.svg"), svgDoc(1180, 800, legend + parts.join("\n") + links.join("\n")));
}

/* ------------------------------ 2) Use case ------------------------------ */
{
  const actor = (x, y, label) => `
<g stroke="#0f172a" stroke-width="1.6" fill="none">
<circle cx="${x}" cy="${y}" r="13"/>
<path d="M ${x} ${y + 13} V ${y + 50} M ${x - 20} ${y + 27} H ${x + 20} M ${x} ${y + 50} L ${x - 16} ${y + 75} M ${x} ${y + 50} L ${x + 16} ${y + 75}"/>
</g>
<text x="${x}" y="${y + 95}" ${FONT} font-size="13" font-weight="bold" fill="#0f172a" text-anchor="middle">${esc(label)}</text>`;

  const usecase = (cx, cy, label, w = 210) => `
<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="26" fill="#ecfdf5" stroke="#047857" stroke-width="1.4"/>
<text x="${cx}" y="${cy + 4}" ${FONT} font-size="12.5" fill="#065f46" text-anchor="middle">${esc(label)}</text>`;

  const line = (x1, y1, x2, y2) =>
    `<path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="#475569" stroke-width="1.2"/>`;

  const cases = [
    [385, 90, "Евиденција на клиенти", 210],
    [385, 155, "Дефинирање производи и норматив", 280],
    [385, 220, "Креирање нарачка", 190],
    [385, 285, "Проверка на расположливи материјали", 300],
    [385, 350, "Набавка на материјали", 210],
    [385, 415, "Управување со производствен налог", 290],
    [385, 480, "Контрола на квалитет", 210],
    [385, 545, "Испорака на нарачка", 200],
    [660, 300, "Преглед на контролна табла", 240],
    [660, 380, "Аналитички извештаи", 210],
  ];

  let body = `<text x="40" y="40" ${FONT} font-size="18" font-weight="bold" fill="#0f172a">Дијаграм на случаи на употреба — МебелИС</text>
<rect x="225" y="55" width="610" height="530" rx="14" fill="none" stroke="#334155" stroke-width="1.6"/>
<text x="530" y="78" ${FONT} font-size="14" font-weight="bold" fill="#334155" text-anchor="middle">МебелИС</text>`;
  body += actor(110, 240, "Оператор");
  body += actor(110, 500, "Раководител");
  for (const [cx, cy, label, w] of cases) body += usecase(cx, cy, label, w);
  // operator lines to first 8 cases
  for (const [cx, cy, , w] of cases.slice(0, 8)) body += line(130, 290, cx - w / 2, cy);
  // manager lines to dashboard + reports + qc review
  body += line(130, 550, 660 - 120, 300);
  body += line(130, 550, 660 - 105, 380);
  writeFileSync(join(OUT, "use-case.svg"), svgDoc(880, 640, body));
}

/* ---------------------------- 3) Architecture ---------------------------- */
{
  const box = (x, y, w, h, title, lines, accent = "#047857") => {
    let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="white" stroke="${accent}" stroke-width="1.8"/>
<text x="${x + w / 2}" y="${y + 26}" ${FONT} font-size="15" font-weight="bold" fill="${accent}" text-anchor="middle">${esc(title)}</text>`;
    lines.forEach((l, i) => {
      out += `\n<text x="${x + w / 2}" y="${y + 48 + i * 18}" ${FONT} font-size="12.5" fill="#334155" text-anchor="middle">${esc(l)}</text>`;
    });
    return out;
  };
  const arrow = (x, y1, y2, label) => `
<defs><marker id="ah${y1}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#475569"/></marker></defs>
<path d="M ${x} ${y1} V ${y2 - 6}" stroke="#475569" stroke-width="1.6" marker-end="url(#ah${y1})"/>
<path d="M ${x + 26} ${y2 - 6} V ${y1}" stroke="#475569" stroke-width="1.6" marker-end="url(#ah${y1})" transform="rotate(180 ${x + 26} ${(y1 + y2 - 6) / 2})"/>
<text x="${x + 44}" y="${(y1 + y2) / 2 + 4}" ${FONT} font-size="11.5" fill="#64748b">${esc(label)}</text>`;

  let body = `<text x="40" y="40" ${FONT} font-size="18" font-weight="bold" fill="#0f172a">Архитектура на системот МебелИС</text>`;
  body += box(210, 65, 420, 105, "Кориснички интерфејс (прелистувач)", [
    "React компоненти · 8 екрани на македонски јазик",
    "Контролна табла · Нарачки · Производство · Квалитет",
    "Магацин · Производи · Клиенти · Извештаи",
  ]);
  body += arrow(400, 170, 235, "HTTP / JSON (REST API)");
  body += box(210, 235, 420, 122, "Апликациски сервер (Next.js)", [
    "API рути (app/api/*)",
    "Деловна логика — тек на производство (lib/flow.ts)",
    "Валидации, трансакции, пресметки",
    "Норматив (BOM) · статуси · движења на залиха",
  ]);
  body += arrow(400, 357, 422, "SQL (better-sqlite3)");
  body += box(210, 422, 420, 100, "База на податоци (SQLite)", [
    "Една локална датотека: data/mebelis.db",
    "8 поврзани табели · трансакциска конзистентност",
    "customers · products · materials · orders · …",
  ], "#334155");
  writeFileSync(join(OUT, "architecture.svg"), svgDoc(860, 570, body));
}

/* ---------------------------- 4) Process flow ---------------------------- */
{
  const step = (x, y, w, title, sub, accent = "#047857") => `
<rect x="${x}" y="${y}" width="${w}" height="66" rx="10" fill="#ecfdf5" stroke="${accent}" stroke-width="1.6"/>
<text x="${x + w / 2}" y="${y + 27}" ${FONT} font-size="13" font-weight="bold" fill="#065f46" text-anchor="middle">${esc(title)}</text>
<text x="${x + w / 2}" y="${y + 46}" ${FONT} font-size="11" fill="#334155" text-anchor="middle">${esc(sub)}</text>`;

  const plain = (x, y, w, title) => `
<rect x="${x}" y="${y}" width="${w}" height="50" rx="24" fill="white" stroke="#334155" stroke-width="1.6"/>
<text x="${x + w / 2}" y="${y + 30}" ${FONT} font-size="13" font-weight="bold" fill="#0f172a" text-anchor="middle">${esc(title)}</text>`;

  const arrowH = (x1, x2, y, label = "") => `
<defs><marker id="pa${x1}${y}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#475569"/></marker></defs>
<path d="M ${x1} ${y} H ${x2 - 7}" stroke="#475569" stroke-width="1.6" marker-end="url(#pa${x1}${y})"/>
${label ? `<text x="${(x1 + x2) / 2}" y="${y - 8}" ${FONT} font-size="10.5" fill="#64748b" text-anchor="middle">${esc(label)}</text>` : ""}`;

  const arrowV = (x, y1, y2, label = "", dx = 8) => `
<defs><marker id="pv${x}${y1}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#475569"/></marker></defs>
<path d="M ${x} ${y1} V ${y2 - 7}" stroke="#475569" stroke-width="1.6" marker-end="url(#pv${x}${y1})"/>
${label ? `<text x="${x + dx}" y="${(y1 + y2) / 2 + 4}" ${FONT} font-size="10.5" fill="#64748b">${esc(label)}</text>` : ""}`;

  let body = `<text x="40" y="40" ${FONT} font-size="18" font-weight="bold" fill="#0f172a">Тек на производствениот процес низ системот МебелИС</text>`;
  // Row 1
  body += plain(40, 90, 130, "Клиент");
  body += arrowH(170, 210, 115, "барање");
  body += step(210, 82, 190, "Нарачка", "статус: Нова");
  body += arrowH(400, 440, 115);
  // decision diamond
  body += `<path d="M 520 82 L 600 115 L 520 148 L 440 115 Z" fill="#fefce8" stroke="#b45309" stroke-width="1.6"/>
<text x="520" y="110" ${FONT} font-size="11.5" font-weight="bold" fill="#92400e" text-anchor="middle">Има доволно</text>
<text x="520" y="124" ${FONT} font-size="11.5" font-weight="bold" fill="#92400e" text-anchor="middle">материјали?</text>`;
  body += arrowH(600, 660, 115, "да");
  body += step(660, 82, 210, "Производствен налог", "статус: Во производство");
  // shortage loop
  body += arrowV(520, 148, 210, "не", 10);
  body += step(430, 210, 180, "Набавка", "влез на материјали");
  body += `<path d="M 430 243 H 395 V 130 H 434" fill="none" stroke="#475569" stroke-width="1.6" stroke-dasharray="5 4"/>`;
  // materials consumed note
  body += arrowV(765, 148, 210);
  body += step(660, 210, 210, "Производство", "изработка на единиците");
  body += arrowV(765, 276, 330);
  body += step(660, 330, 210, "Контрола на квалитет", "исправни / неисправни");
  // good units to warehouse
  body += `<defs><marker id="wh" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#475569"/></marker></defs>
<path d="M 660 363 H 407" stroke="#475569" stroke-width="1.6" marker-end="url(#wh)"/>
<text x="533" y="355" ${FONT} font-size="10.5" fill="#64748b" text-anchor="middle">исправни единици</text>`;
  body += step(210, 330, 190, "Магацин", "статус: Во магацин");
  body += arrowV(305, 396, 450, "испорака и раздолжување на залихата", 12);
  body += step(210, 450, 190, "Испорака", "статус: Испорачана");
  body += `<defs><marker id="cl2" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#475569"/></marker></defs>
<path d="M 210 483 H 105 V 147" fill="none" stroke="#475569" stroke-width="1.6" marker-end="url(#cl2)"/>
<text x="118" y="300" ${FONT} font-size="10.5" fill="#64748b">до клиентот</text>`;
  // side note
  body += `<rect x="900" y="82" width="240" height="180" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>
<text x="1020" y="106" ${FONT} font-size="12" font-weight="bold" fill="#334155" text-anchor="middle">Евиденција во системот</text>`;
  ["Секоја промена на залихата се", "запишува во stock_movements.", "", "Статусите на нарачката и налогот", "се менуваат автоматски преку", "деловната логика (lib/flow.ts)."].forEach((l, i) => {
    body += `<text x="915" y="${128 + i * 17}" ${FONT} font-size="11" fill="#475569">${esc(l)}</text>`;
  });
  writeFileSync(join(OUT, "process.svg"), svgDoc(1180, 560, body));
}

console.log("Diagrams written to docs/diagrams/: er.svg, use-case.svg, architecture.svg, process.svg");
