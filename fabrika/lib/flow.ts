import { getDb } from "@/lib/db";

/**
 * The business-flow engine: implements the production process from the thesis
 * (Дијаграм 1): Клиент -> Нарачка -> проверка на материјали -> Производствен
 * налог -> Производство -> Контрола на квалитет -> Магацин -> Испорака.
 *
 * Every screen's numbers derive from these transactions - nothing is faked.
 * All multi-step changes run inside SQLite transactions so stock, orders and
 * the movement log always stay consistent.
 *
 * An optional `at` timestamp ("YYYY-MM-DD HH:MM:SS") lets the seed script
 * replay a year of history through the very same functions the UI uses.
 */

export class FlowError extends Error {}

export interface MaterialRequirement {
  materialId: number;
  name: string;
  unit: string;
  required: number;
  available: number;
  missing: number;
}

function now(at?: string): string {
  return at ?? new Date().toISOString().slice(0, 19).replace("T", " ");
}

/** Material needs for producing `quantity` units of a product (BOM x qty). */
export function materialRequirements(
  productId: number,
  quantity: number
): MaterialRequirement[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT m.material_id, m.name, m.unit, m.stock,
              pm.quantity * ? AS required
       FROM product_materials pm
       JOIN materials m ON m.material_id = pm.material_id
       WHERE pm.product_id = ?
       ORDER BY m.name`
    )
    .all(quantity, productId) as {
    material_id: number;
    name: string;
    unit: string;
    stock: number;
    required: number;
  }[];
  return rows.map((r) => ({
    materialId: r.material_id,
    name: r.name,
    unit: r.unit,
    required: Math.round(r.required * 100) / 100,
    available: r.stock,
    missing: Math.max(0, Math.round((r.required - r.stock) * 100) / 100),
  }));
}

export function createOrder(
  customerId: number,
  productId: number,
  quantity: number,
  at?: string
): number {
  const db = getDb();
  if (quantity <= 0) throw new FlowError("Quantity must be positive");
  const res = db
    .prepare(
      `INSERT INTO orders (customer_id, product_id, quantity, status, created_at, updated_at)
       VALUES (?, ?, ?, 'NEW', ?, ?)`
    )
    .run(customerId, productId, quantity, now(at), now(at));
  return Number(res.lastInsertRowid);
}

/**
 * Start production for an order: verify materials against the BOM, consume
 * them, open a production order. Fails with the missing-material list when
 * stock is insufficient.
 */
export function startProduction(orderId: number, at?: string): number {
  const db = getDb();
  return db.transaction(() => {
    const order = db
      .prepare(`SELECT * FROM orders WHERE order_id = ?`)
      .get(orderId) as
      | { order_id: number; product_id: number; quantity: number; status: string }
      | undefined;
    if (!order) throw new FlowError(`Order ${orderId} not found`);
    if (order.status !== "NEW")
      throw new FlowError(`Order ${orderId} is not in status NEW`);

    const reqs = materialRequirements(order.product_id, order.quantity);
    const missing = reqs.filter((r) => r.missing > 0);
    if (missing.length > 0) {
      throw new FlowError(
        "MISSING_MATERIALS:" +
          missing.map((m) => `${m.name} (${m.missing} ${m.unit})`).join(", ")
      );
    }

    // Consume materials and log each movement.
    const updateStock = db.prepare(
      `UPDATE materials SET stock = ROUND(stock - ?, 2) WHERE material_id = ?`
    );
    const logMove = db.prepare(
      `INSERT INTO stock_movements (item_type, item_id, change, reason, ref, created_at)
       VALUES ('material', ?, ?, 'production_use', ?, ?)`
    );
    for (const r of reqs) {
      updateStock.run(r.required, r.materialId);
      logMove.run(r.materialId, -r.required, `order:${orderId}`, now(at));
    }

    const po = db
      .prepare(
        `INSERT INTO production_orders (order_id, product_id, quantity, status, started_at)
         VALUES (?, ?, ?, 'OPEN', ?)`
      )
      .run(orderId, order.product_id, order.quantity, now(at));

    db.prepare(
      `UPDATE orders SET status = 'IN_PRODUCTION', updated_at = ? WHERE order_id = ?`
    ).run(now(at), orderId);

    return Number(po.lastInsertRowid);
  })();
}

/** Production finished on the shop floor -> hand over to quality control. */
export function finishProduction(poId: number, at?: string): void {
  const db = getDb();
  db.transaction(() => {
    const po = db
      .prepare(`SELECT * FROM production_orders WHERE po_id = ?`)
      .get(poId) as { po_id: number; order_id: number; status: string } | undefined;
    if (!po) throw new FlowError(`Production order ${poId} not found`);
    if (po.status !== "OPEN")
      throw new FlowError(`Production order ${poId} is not OPEN`);
    db.prepare(
      `UPDATE production_orders SET status = 'WAITING_QC' WHERE po_id = ?`
    ).run(poId);
    db.prepare(
      `UPDATE orders SET status = 'QC', updated_at = ? WHERE order_id = ?`
    ).run(now(at), po.order_id);
  })();
}

/**
 * Record the quality check: good units enter the finished-goods warehouse,
 * defective units are scrapped (kept in the record for the reports).
 */
export function recordQualityCheck(
  poId: number,
  goodQty: number,
  defectQty: number,
  note: string | null,
  at?: string
): void {
  const db = getDb();
  db.transaction(() => {
    const po = db
      .prepare(`SELECT * FROM production_orders WHERE po_id = ?`)
      .get(poId) as
      | { po_id: number; order_id: number; product_id: number; quantity: number; status: string }
      | undefined;
    if (!po) throw new FlowError(`Production order ${poId} not found`);
    if (po.status !== "WAITING_QC")
      throw new FlowError(`Production order ${poId} is not waiting for QC`);
    if (goodQty < 0 || defectQty < 0 || goodQty + defectQty !== po.quantity)
      throw new FlowError("INVALID_SPLIT");

    db.prepare(
      `INSERT INTO quality_checks (po_id, checked_qty, good_qty, defect_qty, note, checked_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(poId, po.quantity, goodQty, defectQty, note, now(at));

    db.prepare(
      `UPDATE production_orders SET status = 'COMPLETED', completed_at = ? WHERE po_id = ?`
    ).run(now(at), poId);

    if (goodQty > 0) {
      db.prepare(
        `UPDATE products SET stock = stock + ? WHERE product_id = ?`
      ).run(goodQty, po.product_id);
      db.prepare(
        `INSERT INTO stock_movements (item_type, item_id, change, reason, ref, created_at)
         VALUES ('product', ?, ?, 'production_in', ?, ?)`
      ).run(po.product_id, goodQty, `po:${poId}`, now(at));
    }

    db.prepare(
      `UPDATE orders SET status = 'READY', updated_at = ? WHERE order_id = ?`
    ).run(now(at), po.order_id);
  })();
}

/** Deliver a READY order: finished goods leave the warehouse. */
export function deliverOrder(orderId: number, at?: string): void {
  const db = getDb();
  db.transaction(() => {
    const order = db
      .prepare(`SELECT * FROM orders WHERE order_id = ?`)
      .get(orderId) as
      | { order_id: number; product_id: number; quantity: number; status: string }
      | undefined;
    if (!order) throw new FlowError(`Order ${orderId} not found`);
    if (order.status !== "READY")
      throw new FlowError(`Order ${orderId} is not READY`);

    const product = db
      .prepare(`SELECT stock FROM products WHERE product_id = ?`)
      .get(order.product_id) as { stock: number };
    // Deliver what quality control approved, up to the ordered quantity.
    const deliverQty = Math.min(order.quantity, product.stock);
    if (deliverQty <= 0) throw new FlowError("NO_FINISHED_STOCK");

    db.prepare(`UPDATE products SET stock = stock - ? WHERE product_id = ?`).run(
      deliverQty,
      order.product_id
    );
    db.prepare(
      `INSERT INTO stock_movements (item_type, item_id, change, reason, ref, created_at)
       VALUES ('product', ?, ?, 'delivery', ?, ?)`
    ).run(order.product_id, -deliverQty, `order:${orderId}`, now(at));

    db.prepare(
      `UPDATE orders SET status = 'DELIVERED', updated_at = ? WHERE order_id = ?`
    ).run(now(at), orderId);
  })();
}

/** Purchase materials into the warehouse. */
export function purchaseMaterial(
  materialId: number,
  quantity: number,
  at?: string
): void {
  const db = getDb();
  if (quantity <= 0) throw new FlowError("Quantity must be positive");
  db.transaction(() => {
    const res = db
      .prepare(
        `UPDATE materials SET stock = ROUND(stock + ?, 2) WHERE material_id = ?`
      )
      .run(quantity, materialId);
    if (res.changes === 0) throw new FlowError(`Material ${materialId} not found`);
    db.prepare(
      `INSERT INTO stock_movements (item_type, item_id, change, reason, created_at)
       VALUES ('material', ?, ?, 'purchase', ?)`
    ).run(materialId, quantity, now(at));
  })();
}
