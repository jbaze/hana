import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { apiError } from "@/lib/api";
import { Customer } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.*, COUNT(o.order_id) AS orders_count
       FROM customers c
       LEFT JOIN orders o ON o.customer_id = c.customer_id
       GROUP BY c.customer_id
       ORDER BY c.name`
    )
    .all() as Customer[];
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
    const res = getDb()
      .prepare(
        `INSERT INTO customers (name, contact_person, phone, email, city)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(b.name.trim(), b.contact_person ?? null, b.phone ?? null, b.email ?? null, b.city ?? null);
    return NextResponse.json({ customer_id: Number(res.lastInsertRowid) });
  } catch (err) {
    return apiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b.customer_id || !b.name?.trim())
      return NextResponse.json({ error: "customer_id and name required" }, { status: 400 });
    getDb()
      .prepare(
        `UPDATE customers SET name = ?, contact_person = ?, phone = ?, email = ?, city = ?
         WHERE customer_id = ?`
      )
      .run(b.name.trim(), b.contact_person ?? null, b.phone ?? null, b.email ?? null, b.city ?? null, b.customer_id);
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
      .prepare(`SELECT COUNT(*) AS c FROM orders WHERE customer_id = ?`)
      .get(id) as { c: number };
    if (used.c > 0)
      return NextResponse.json({ error: "HAS_ORDERS" }, { status: 409 });
    db.prepare(`DELETE FROM customers WHERE customer_id = ?`).run(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
