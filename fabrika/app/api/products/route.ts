import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/api";
import { BomLine, Product } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const products = db
    .prepare(`SELECT * FROM products ORDER BY code`)
    .all() as Omit<Product, "bom" | "material_cost">[];
  const bomAll = db
    .prepare(
      `SELECT pm.product_id, pm.material_id, m.name, m.unit, m.unit_price, pm.quantity
       FROM product_materials pm
       JOIN materials m ON m.material_id = pm.material_id
       ORDER BY m.name`
    )
    .all() as (BomLine & { product_id: number })[];
  const full: Product[] = products.map((p) => {
    const bom = bomAll.filter((b) => b.product_id === p.product_id);
    return {
      ...p,
      bom,
      material_cost:
        Math.round(bom.reduce((s, b) => s + b.unit_price * b.quantity, 0) * 100) / 100,
    };
  });
  return NextResponse.json(full);
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b.code?.trim() || !b.name?.trim())
      return NextResponse.json({ error: "code and name required" }, { status: 400 });
    const db = getDb();
    const id = db.transaction(() => {
      const res = db
        .prepare(
          `INSERT INTO products (code, name, category, price, stock) VALUES (?, ?, ?, ?, 0)`
        )
        .run(b.code.trim(), b.name.trim(), b.category ?? "", Number(b.price) || 0);
      const pid = Number(res.lastInsertRowid);
      const ins = db.prepare(
        `INSERT INTO product_materials (product_id, material_id, quantity) VALUES (?, ?, ?)`
      );
      for (const line of b.bom ?? []) {
        if (line.material_id && Number(line.quantity) > 0)
          ins.run(pid, line.material_id, Number(line.quantity));
      }
      return pid;
    })();
    return NextResponse.json({ product_id: id });
  } catch (err) {
    return apiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const b = await req.json();
    const db = getDb();
    db.transaction(() => {
      db.prepare(
        `UPDATE products SET code = ?, name = ?, category = ?, price = ? WHERE product_id = ?`
      ).run(b.code.trim(), b.name.trim(), b.category ?? "", Number(b.price) || 0, b.product_id);
      // Replace the BOM wholesale - simplest correct semantics for the form.
      db.prepare(`DELETE FROM product_materials WHERE product_id = ?`).run(b.product_id);
      const ins = db.prepare(
        `INSERT INTO product_materials (product_id, material_id, quantity) VALUES (?, ?, ?)`
      );
      for (const line of b.bom ?? []) {
        if (line.material_id && Number(line.quantity) > 0)
          ins.run(b.product_id, line.material_id, Number(line.quantity));
      }
    })();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    const db = getDb();
    const used = db
      .prepare(`SELECT COUNT(*) AS c FROM orders WHERE product_id = ?`)
      .get(id) as { c: number };
    if (used.c > 0)
      return NextResponse.json({ error: "HAS_ORDERS" }, { status: 409 });
    db.transaction(() => {
      db.prepare(`DELETE FROM product_materials WHERE product_id = ?`).run(id);
      db.prepare(`DELETE FROM products WHERE product_id = ?`).run(id);
    })();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
