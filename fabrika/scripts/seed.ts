/**
 * Seed script: creates the demo dataset for МебелИС.
 *
 *   npm run seed
 *
 * Master data (customers, materials, products, BOMs) is inserted directly;
 * the ~14 months of order history is then REPLAYED through the same
 * business-flow functions the application uses (lib/flow.ts), so every
 * stock level, movement log entry, production order and quality check is
 * internally consistent - exactly as if the company had used the system.
 */

import { resetDb } from "../lib/db";
import {
  createOrder,
  startProduction,
  finishProduction,
  recordQualityCheck,
  deliverOrder,
  purchaseMaterial,
  materialRequirements,
  FlowError,
} from "../lib/flow";

/* Deterministic PRNG so every reseed produces the same dataset. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026);
const randInt = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[randInt(0, arr.length - 1)];

const db = resetDb();
console.log("Schema recreated. Inserting master data…");

/* ------------------------------- Customers ------------------------------- */

const customers: [string, string, string, string, string][] = [
  ["Салон Идеал ДООЕЛ", "Марко Стојановски", "070 234 561", "kontakt@ideal.mk", "Скопје"],
  ["Мебел Хаус ДОО", "Елена Петровска", "071 445 782", "info@mebelhaus.mk", "Битола"],
  ["Дом Дизајн ДООЕЛ", "Игор Наумовски", "072 318 904", "igor@domdizajn.mk", "Прилеп"],
  ["Ентериер Плус ДОО", "Билјана Ристеска", "070 556 231", "biljana@enterierplus.mk", "Охрид"],
  ["Хотел Панорама АД", "Дарко Илиевски", "047 203 118", "nabavki@panorama.mk", "Крушево"],
  ["Универзитет Св. Климент", "Служба за набавки", "047 223 788", "nabavki@uklo.edu.mk", "Битола"],
  ["Кафе бар Централ", "Ана Тодоровска", "075 612 349", "central@gmail.com", "Битола"],
  ["Гордана ДОО", "Гордана Илијевска", "070 118 265", "gordana@gordana.mk", "Ресен"],
  ["Студио Комфорт ДООЕЛ", "Никола Ангелевски", "078 445 120", "nikola@komfort.mk", "Струга"],
  ["Опрема Про ДОО", "Весна Јованова", "071 998 340", "vesna@opremapro.mk", "Велес"],
  ["Ресторан Езеро", "Зоран Крстевски", "046 261 553", "ezero@t.mk", "Охрид"],
  ["Градинка Сонце", "Марија Спасовска", "047 231 662", "soncebt@schools.mk", "Битола"],
];
const insCustomer = db.prepare(
  `INSERT INTO customers (name, contact_person, phone, email, city, created_at)
   VALUES (?, ?, ?, ?, ?, ?)`
);
customers.forEach((c, i) =>
  insCustomer.run(...c, `2025-0${(i % 6) + 1}-1${i % 9} 09:00:00`)
);

/* ------------------------------- Materials ------------------------------- */
// name, unit, unit_price (den), min_stock
const materials: [string, string, number, number][] = [
  ["Иверица 18mm", "m2", 520, 80],
  ["Даска од бука", "m2", 950, 50],
  ["МДФ плоча", "m2", 610, 40],
  ["Платно за тапацир", "m2", 430, 60],
  ["Сунѓер Т25", "kg", 380, 40],
  ["Завртки и оков (сет)", "сет", 95, 200],
  ["Шарки", "пар.", 45, 300],
  ["Лизгачи за фиоки", "пар.", 120, 100],
  ["Лак за дрво", "l", 540, 30],
  ["Лепак за дрво", "kg", 310, 25],
  ["Стакло 4mm", "m2", 780, 20],
  ["Метални ногарки (сет)", "сет", 260, 80],
];
const insMaterial = db.prepare(
  `INSERT INTO materials (name, unit, unit_price, stock, min_stock) VALUES (?, ?, ?, 0, ?)`
);
materials.forEach((m) => insMaterial.run(m[0], m[1], m[2], m[3]));

/* ------------------------------- Products -------------------------------- */
// code, name, category, price, BOM: [material_id, qty per unit]
interface ProductSpec {
  code: string;
  name: string;
  category: string;
  price: number;
  bom: [number, number][];
}
const products: ProductSpec[] = [
  { code: "С01", name: "Столица Класик", category: "Столици", price: 2450,
    bom: [[2, 0.8], [4, 0.5], [5, 0.4], [6, 1], [9, 0.1], [10, 0.05]] },
  { code: "С02", name: "Столица Модерна", category: "Столици", price: 3150,
    bom: [[3, 0.6], [4, 0.7], [5, 0.5], [6, 1], [12, 1]] },
  { code: "М01", name: "Маса Фамилија", category: "Маси", price: 11800,
    bom: [[2, 2.5], [6, 2], [9, 0.4], [10, 0.2]] },
  { code: "М02", name: "Клуб маса Сити", category: "Маси", price: 5900,
    bom: [[3, 1.2], [11, 0.5], [12, 1], [6, 1]] },
  { code: "П01", name: "Плакар двокрилен", category: "Плакари", price: 14500,
    bom: [[1, 6.5], [7, 4], [6, 3], [10, 0.3]] },
  { code: "П02", name: "Плакар трокрилен", category: "Плакари", price: 19900,
    bom: [[1, 9.0], [7, 6], [8, 2], [6, 4], [10, 0.4]] },
  { code: "К01", name: "Кревет Комфорт", category: "Кревети", price: 16700,
    bom: [[2, 4.0], [1, 2.0], [6, 3], [9, 0.5], [10, 0.3]] },
  { code: "Р01", name: "Полица Студио", category: "Полици", price: 4300,
    bom: [[1, 2.2], [6, 1], [10, 0.1]] },
];
const insProduct = db.prepare(
  `INSERT INTO products (code, name, category, price, stock) VALUES (?, ?, ?, ?, 0)`
);
const insBom = db.prepare(
  `INSERT INTO product_materials (product_id, material_id, quantity) VALUES (?, ?, ?)`
);
products.forEach((p, i) => {
  insProduct.run(p.code, p.name, p.category, p.price);
  p.bom.forEach(([mid, qty]) => insBom.run(i + 1, mid, qty));
});

console.log(
  `Inserted ${customers.length} customers, ${materials.length} materials, ${products.length} products with BOMs.`
);

/* --------------------------- Replayed history ---------------------------- */

// Initial stock purchase (July 2025) so production can start.
const initialPurchases: [number, number][] = [
  [1, 400], [2, 250], [3, 180], [4, 250], [5, 160], [6, 1200],
  [7, 900], [8, 350], [9, 120], [10, 90], [11, 80], [12, 300],
];
for (const [mid, qty] of initialPurchases)
  purchaseMaterial(mid, qty, "2025-07-01 08:00:00");

function ts(year: number, month: number, day: number, hour: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${year}-${p(month)}-${p(day)} ${p(hour)}:${p(randInt(0, 59))}:00`;
}

/**
 * Replay one order through its full life cycle. `stopAt` controls how far the
 * order progresses, so the current state has orders in every status.
 */
function replayOrder(
  year: number,
  month: number,
  stopAt: "NEW" | "IN_PRODUCTION" | "QC" | "READY" | "DELIVERED",
  maxDay = 28
) {
  const day = randInt(1, maxDay);
  const customerId = randInt(1, customers.length);
  const productIdx = randInt(0, products.length - 1);
  const productId = productIdx + 1;
  // Chairs are ordered in larger batches than wardrobes/beds.
  const qty =
    products[productIdx].category === "Столици"
      ? randInt(6, 60)
      : products[productIdx].category === "Маси"
        ? randInt(2, 15)
        : randInt(1, 8);

  const orderId = createOrder(customerId, productId, qty, ts(year, month, day, 9));
  if (stopAt === "NEW") return;

  // Procurement: if materials are short, purchase what is missing (plus a
  // buffer) one day before production starts - a realistic supply step.
  const reqs = materialRequirements(productId, qty);
  for (const r of reqs) {
    if (r.missing > 0) {
      purchaseMaterial(
        r.materialId,
        Math.ceil(r.missing * randInt(15, 30) / 10),
        ts(year, month, day, 11)
      );
    }
  }

  const poId = startProduction(orderId, ts(year, month, Math.min(day + 1, 28), 8));
  if (stopAt === "IN_PRODUCTION") return;

  finishProduction(poId, ts(year, month, Math.min(day + 3, 28), 14));
  if (stopAt === "QC") return;

  // 0-6% defects, skewed toward 0; always at least one good unit per batch.
  const defect =
    rand() < 0.55
      ? 0
      : Math.min(qty - 1, randInt(1, Math.max(1, Math.round(qty * 0.06))));
  recordQualityCheck(
    poId,
    qty - defect,
    Math.max(0, defect),
    defect > 0 ? "Оштетувања при монтажа" : null,
    ts(year, month, Math.min(day + 3, 28), 16)
  );
  if (stopAt === "READY") return;

  deliverOrder(orderId, ts(year, month, Math.min(day + 5, 28), 10));
}

// 14 months of history: Jul 2025 - Aug 2026 fully delivered...
const monthsBack: [number, number][] = [
  [2025, 7], [2025, 8], [2025, 9], [2025, 10], [2025, 11], [2025, 12],
  [2026, 1], [2026, 2], [2026, 3], [2026, 4], [2026, 5], [2026, 6],
  [2026, 7], [2026, 8],
];
let total = 0;
for (const [y, m] of monthsBack) {
  const n = randInt(7, 12);
  for (let i = 0; i < n; i++) {
    try {
      replayOrder(y, m, "DELIVERED");
      total++;
    } catch (e) {
      if (!(e instanceof FlowError)) throw e;
    }
  }
}
// ...September 2026: work in progress across all stages.
const currentMix: ("DELIVERED" | "READY" | "QC" | "IN_PRODUCTION" | "NEW")[] = [
  "DELIVERED", "DELIVERED", "DELIVERED", "READY", "READY",
  "QC", "IN_PRODUCTION", "IN_PRODUCTION", "NEW", "NEW", "NEW",
];
for (const stage of currentMix) {
  try {
    replayOrder(2026, 9, stage, 10); // stay in the past relative to demo day
    total++;
  } catch (e) {
    if (!(e instanceof FlowError)) throw e;
  }
}

/* -------------------------------- Summary -------------------------------- */

// September replenishment: restock materials that history ran down, but leave
// two deliberately low so the dashboard's low-stock alert has something real
// to show (Платно за тапацир and Лак за дрво).
const LEAVE_LOW = new Set([4, 9]);
const lowRows = db
  .prepare(`SELECT material_id, stock, min_stock FROM materials WHERE stock < min_stock`)
  .all() as { material_id: number; stock: number; min_stock: number }[];
for (const r of lowRows) {
  if (LEAVE_LOW.has(r.material_id)) continue;
  const target = r.min_stock * (1.5 + rand());
  purchaseMaterial(
    r.material_id,
    Math.ceil(target - r.stock),
    "2026-09-10 08:30:00"
  );
}

const count = (sql: string) =>
  (db.prepare(sql).get() as { c: number }).c;
console.log(`\nReplayed ${total} orders through the flow engine. Final state:`);
console.log(`  customers          ${count("SELECT COUNT(*) c FROM customers")}`);
console.log(`  materials          ${count("SELECT COUNT(*) c FROM materials")}`);
console.log(`  products           ${count("SELECT COUNT(*) c FROM products")}`);
console.log(`  orders             ${count("SELECT COUNT(*) c FROM orders")}`);
console.log(`  production_orders  ${count("SELECT COUNT(*) c FROM production_orders")}`);
console.log(`  quality_checks     ${count("SELECT COUNT(*) c FROM quality_checks")}`);
console.log(`  stock_movements    ${count("SELECT COUNT(*) c FROM stock_movements")}`);
const statuses = db
  .prepare(`SELECT status, COUNT(*) c FROM orders GROUP BY status ORDER BY c DESC`)
  .all() as { status: string; c: number }[];
console.log("  orders by status: " + statuses.map((s) => `${s.status}=${s.c}`).join(", "));
const qc = db
  .prepare(`SELECT SUM(good_qty) g, SUM(defect_qty) d FROM quality_checks`)
  .get() as { g: number; d: number };
console.log(
  `  produced units: ${qc.g + qc.d} (good ${qc.g}, defect ${qc.d}, ` +
    `${((qc.d / (qc.g + qc.d)) * 100).toFixed(1)}% defect rate)`
);
console.log("\nDone. Database: data/mebelis.db");
