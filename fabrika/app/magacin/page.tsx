"use client";

import { useState } from "react";
import {
  Button, Card, CardHeader, EmptyState, ErrorState, Field, inputCls, Modal,
  PageTitle, Skeleton, Td, Th,
} from "@/components/ui";
import { apiCall, useData } from "@/lib/client";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { t } from "@/lib/strings";
import { Material, MovementRow, Product } from "@/lib/types";

interface WarehouseData {
  materials: Material[];
  movements: MovementRow[];
}

const emptyForm = { material_id: 0, name: "", unit: "", unit_price: "", min_stock: "" };

export default function WarehousePage() {
  const { data, error, loading, reload } = useData<WarehouseData>("/api/materials");
  const { data: products, reload: reloadProducts } = useData<Product[]>("/api/products");

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [restockFor, setRestockFor] = useState<Material | null>(null);
  const [restockQty, setRestockQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function saveMaterial() {
    if (!form.name.trim() || !form.unit.trim()) {
      setFormError(t.common.required);
      return;
    }
    setBusy(true);
    const payload = {
      material_id: form.material_id,
      name: form.name,
      unit: form.unit,
      unit_price: Number(form.unit_price) || 0,
      min_stock: Number(form.min_stock) || 0,
    };
    const res = await apiCall("/api/materials", form.material_id ? "PUT" : "POST", payload);
    setBusy(false);
    if (res.ok) {
      setEditOpen(false);
      setFormError(null);
      await reload();
    } else setFormError(res.error ?? t.common.error);
  }

  async function purchase() {
    if (!restockFor || Number(restockQty) <= 0) return;
    setBusy(true);
    const res = await apiCall("/api/materials", "POST", {
      action: "purchase",
      material_id: restockFor.material_id,
      quantity: Number(restockQty),
    });
    setBusy(false);
    if (res.ok) {
      setRestockFor(null);
      setRestockQty("");
      await Promise.all([reload(), reloadProducts()]);
    }
  }

  const materialsValue = (data?.materials ?? []).reduce((s, m) => s + m.stock * m.unit_price, 0);
  const productsValue = (products ?? []).reduce((s, p) => s + p.stock * p.price, 0);

  return (
    <div className="space-y-5">
      <PageTitle
        title={t.warehouse.title}
        subtitle={t.warehouse.subtitle}
        action={
          <Button
            onClick={() => {
              setForm(emptyForm);
              setEditOpen(true);
            }}
          >
            + {t.warehouse.addTitle}
          </Button>
        }
      />
      {error && <ErrorState message={t.common.error} onRetry={reload} />}
      {loading && <Skeleton className="h-64 w-full" />}

      {data && (
        <div className="grid xl:grid-cols-3 gap-4 items-start">
          <Card className="xl:col-span-2">
            <CardHeader
              title={t.warehouse.materials}
              subtitle={`${t.warehouse.stockValue}: ${formatMoney(materialsValue)}`}
            />
            <div className="p-4 overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <Th>{t.warehouse.material}</Th>
                    <Th>{t.warehouse.unit}</Th>
                    <Th right>{t.warehouse.unitPrice}</Th>
                    <Th right>{t.warehouse.stock}</Th>
                    <Th right>{t.warehouse.minStock}</Th>
                    <Th right>{t.common.actions}</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.materials.map((m) => {
                    const low = m.stock < m.min_stock;
                    return (
                      <tr key={m.material_id} className="border-b border-slate-100 last:border-0">
                        <Td className="font-medium">
                          {m.name}
                          {low && (
                            <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              {t.warehouse.lowStockBadge}
                            </span>
                          )}
                        </Td>
                        <Td>{m.unit}</Td>
                        <Td right>{formatMoney(m.unit_price)}</Td>
                        <Td right className={low ? "text-amber-700 font-semibold" : ""}>
                          {formatQty(m.stock)}
                        </Td>
                        <Td right>{formatQty(m.min_stock)}</Td>
                        <Td right>
                          <span className="inline-flex gap-1.5">
                            <Button small variant="secondary" onClick={() => setRestockFor(m)}>
                              {t.warehouse.restock}
                            </Button>
                            <Button
                              small
                              variant="secondary"
                              onClick={() => {
                                setForm({
                                  material_id: m.material_id,
                                  name: m.name,
                                  unit: m.unit,
                                  unit_price: String(m.unit_price),
                                  min_stock: String(m.min_stock),
                                });
                                setEditOpen(true);
                              }}
                            >
                              {t.common.edit}
                            </Button>
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader
                title={t.warehouse.products}
                subtitle={`${t.warehouse.stockValue}: ${formatMoney(productsValue)}`}
              />
              <div className="p-4">
                {(products ?? []).length === 0 ? (
                  <EmptyState />
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <Th>{t.products.name}</Th>
                        <Th right>{t.warehouse.stock}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {(products ?? []).map((p) => (
                        <tr key={p.product_id} className="border-b border-slate-100 last:border-0">
                          <Td>
                            {p.name}{" "}
                            <span className="text-slate-400 text-xs">({p.code})</span>
                          </Td>
                          <Td right className="font-medium">{p.stock}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title={t.warehouse.movements} />
              <div className="p-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <Th>{t.warehouse.movementItem}</Th>
                      <Th right>{t.warehouse.movementChange}</Th>
                      <Th>{t.warehouse.movementReason}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.movements.map((mv) => (
                      <tr key={mv.movement_id} className="border-b border-slate-100 last:border-0">
                        <Td className="text-xs">{mv.item_name}</Td>
                        <Td
                          right
                          className={`text-xs font-medium ${mv.change > 0 ? "text-emerald-700" : "text-slate-600"}`}
                        >
                          {mv.change > 0 ? "+" : ""}
                          {formatQty(mv.change)} {mv.unit}
                        </Td>
                        <Td className="text-xs text-slate-500">
                          {t.warehouse.reasons[mv.reason] ?? mv.reason} ·{" "}
                          {formatDate(mv.created_at)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      <Modal
        title={form.material_id ? t.warehouse.editTitle : t.warehouse.addTitle}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      >
        <div className="space-y-4">
          <Field label={t.warehouse.material}>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t.warehouse.unit}>
              <input
                className={inputCls}
                value={form.unit}
                placeholder="m2 / kg / пар."
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </Field>
            <Field label={t.warehouse.unitPrice}>
              <input
                type="number"
                className={inputCls}
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              />
            </Field>
            <Field label={t.warehouse.minStock}>
              <input
                type="number"
                className={inputCls}
                value={form.min_stock}
                onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
              />
            </Field>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={() => void saveMaterial()} disabled={busy}>
              {t.common.save}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title={`${t.warehouse.restockTitle}: ${restockFor?.name ?? ""}`}
        open={restockFor !== null}
        onClose={() => setRestockFor(null)}
      >
        <div className="space-y-4">
          <Field label={`${t.warehouse.restockQty} (${restockFor?.unit ?? ""})`}>
            <input
              type="number"
              min={1}
              className={inputCls}
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRestockFor(null)}>
              {t.common.cancel}
            </Button>
            <Button onClick={() => void purchase()} disabled={busy || Number(restockQty) <= 0}>
              {t.common.save}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
