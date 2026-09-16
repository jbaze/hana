import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/api";
import { purchaseMaterial } from "@/lib/flow";
import { Material, MovementRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const materials = db
    .prepare(`SELECT * FROM materials ORDER BY name`)
    .all() as Material[];
  const movements = db
    .prepare(
      `SELECT sm.movement_id, sm.item_type,
              CASE sm.item_type WHEN 'material' THEN m.name ELSE p.name END AS item_name,
              sm.change,
              CASE sm.item_type WHEN 'material' THEN m.unit ELSE 'пар.' END AS unit,
              sm.reason, sm.created_at
       FROM stock_movements sm
       LEFT JOIN materials m ON sm.item_type = 'material' AND m.material_id = sm.item_id
       LEFT JOIN products  p ON sm.item_type = 'product'  AND p.product_id  = sm.item_id
       ORDER BY sm.movement_id DESC
       LIMIT 15`
    )
    .all() as MovementRow[];
  return NextResponse.json({ materials, movements });
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    // Purchase action: add stock through the flow engine (logged movement).
    if (b.action === "purchase") {
      purchaseMaterial(Number(b.material_id), Number(b.quantity));
      return NextResponse.json({ ok: true });
    }
    if (!b.name?.trim() || !b.unit?.trim())
      return NextResponse.json({ error: "name and unit required" }, { status: 400 });
    const res = getDb()
      .prepare(
        `INSERT INTO materials (name, unit, unit_price, stock, min_stock)
         VALUES (?, ?, ?, 0, ?)`
      )
      .run(b.name.trim(), b.unit.trim(), Number(b.unit_price) || 0, Number(b.min_stock) || 0);
    return NextResponse.json({ material_id: Number(res.lastInsertRowid) });
  } catch (err) {
    return apiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const b = await req.json();
    getDb()
      .prepare(
        `UPDATE materials SET name = ?, unit = ?, unit_price = ?, min_stock = ?
         WHERE material_id = ?`
      )
      .run(b.name.trim(), b.unit.trim(), Number(b.unit_price) || 0, Number(b.min_stock) || 0, b.material_id);
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
      .prepare(`SELECT COUNT(*) AS c FROM product_materials WHERE material_id = ?`)
      .get(id) as { c: number };
    if (used.c > 0)
      return NextResponse.json({ error: "IN_BOM" }, { status: 409 });
    db.prepare(`DELETE FROM materials WHERE material_id = ?`).run(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
