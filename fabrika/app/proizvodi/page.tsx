"use client";

import { useState } from "react";
import {
  Button, Card, EmptyState, ErrorState, Field, inputCls, Modal, PageTitle,
  Skeleton, Td, Th,
} from "@/components/ui";
import { apiCall, useData } from "@/lib/client";
import { formatMoney, formatQty } from "@/lib/format";
import { t } from "@/lib/strings";
import { Material, Product } from "@/lib/types";

interface BomFormLine {
  material_id: number;
  quantity: string;
}

const emptyForm = {
  product_id: 0,
  code: "",
  name: "",
  category: t.products.categories[0] as string,
  price: "",
  bom: [] as BomFormLine[],
};

export default function ProductsPage() {
  const { data: products, error, loading, reload } = useData<Product[]>("/api/products");
  const { data: warehouse } = useData<{ materials: Material[] }>("/api/materials");
  const materials = warehouse?.materials ?? [];

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  function openNew() {
    setForm(emptyForm);
    setFormError(null);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setForm({
      product_id: p.product_id,
      code: p.code,
      name: p.name,
      category: p.category,
      price: String(p.price),
      bom: p.bom.map((b) => ({ material_id: b.material_id, quantity: String(b.quantity) })),
    });
    setFormError(null);
    setOpen(true);
  }

  async function save() {
    if (!form.code.trim() || !form.name.trim()) {
      setFormError(t.common.required);
      return;
    }
    setBusy(true);
    const payload = {
      product_id: form.product_id,
      code: form.code,
      name: form.name,
      category: form.category,
      price: Number(form.price) || 0,
      bom: form.bom
        .filter((b) => b.material_id && Number(b.quantity) > 0)
        .map((b) => ({ material_id: b.material_id, quantity: Number(b.quantity) })),
    };
    const res = await apiCall("/api/products", form.product_id ? "PUT" : "POST", payload);
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      await reload();
    } else setFormError(res.error ?? t.common.error);
  }

  async function remove(p: Product) {
    if (!confirm(t.common.confirmDelete)) return;
    const res = await apiCall(`/api/products?id=${p.product_id}`, "DELETE");
    if (!res.ok && res.error === "HAS_ORDERS") alert(t.products.deleteBlocked);
    await reload();
  }

  return (
    <div className="space-y-5">
      <PageTitle
        title={t.products.title}
        subtitle={t.products.subtitle}
        action={<Button onClick={openNew}>+ {t.products.addTitle}</Button>}
      />
      {error && <ErrorState message={t.common.error} onRetry={reload} />}
      {loading && <Skeleton className="h-64 w-full" />}

      {products && (
        <Card>
          <div className="p-4 overflow-x-auto">
            {products.length === 0 ? (
              <EmptyState />
            ) : (
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <Th>{t.products.code}</Th>
                    <Th>{t.products.name}</Th>
                    <Th>{t.products.category}</Th>
                    <Th right>{t.products.price}</Th>
                    <Th right>{t.products.materialCost}</Th>
                    <Th right>{t.products.stock}</Th>
                    <Th right>{t.products.bomShort}</Th>
                    <Th right>{t.common.actions}</Th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => [
                    <tr key={p.product_id} className="border-b border-slate-100 last:border-0">
                      <Td className="font-mono text-slate-500">{p.code}</Td>
                      <Td className="font-medium">{p.name}</Td>
                      <Td>{p.category}</Td>
                      <Td right>{formatMoney(p.price)}</Td>
                      <Td right className="text-slate-500">{formatMoney(p.material_cost)}</Td>
                      <Td right>{p.stock}</Td>
                      <Td right>
                        <button
                          onClick={() => setExpanded(expanded === p.product_id ? null : p.product_id)}
                          className="text-xs text-emerald-700 underline decoration-dotted"
                        >
                          {p.bom.length} {t.products.bomShort.toLowerCase()}
                        </button>
                      </Td>
                      <Td right>
                        <span className="inline-flex gap-1.5">
                          <Button small variant="secondary" onClick={() => openEdit(p)}>
                            {t.common.edit}
                          </Button>
                          <Button small variant="danger" onClick={() => void remove(p)}>
                            {t.common.delete}
                          </Button>
                        </span>
                      </Td>
                    </tr>,
                    expanded === p.product_id && (
                      <tr key={`${p.product_id}-bom`} className="bg-slate-50">
                        <td colSpan={8} className="px-4 py-3">
                          <p className="text-xs font-medium text-slate-600 mb-2">
                            {t.products.bomPerUnit} — {p.name}
                          </p>
                          {p.bom.length === 0 ? (
                            <p className="text-xs text-slate-500">{t.products.noBom}</p>
                          ) : (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                              {p.bom.map((b) => (
                                <div
                                  key={b.material_id}
                                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                                >
                                  {b.name}: <b>{formatQty(b.quantity)}</b> {b.unit}{" "}
                                  <span className="text-slate-400">
                                    ({formatMoney(b.quantity * b.unit_price)})
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ),
                  ])}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}

      <Modal
        title={form.product_id ? t.products.editTitle : t.products.addTitle}
        open={open}
        onClose={() => setOpen(false)}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label={t.products.code}>
              <input
                className={inputCls}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </Field>
            <Field label={t.products.category}>
              <select
                className={inputCls}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {t.products.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.products.price}>
              <input
                type="number"
                className={inputCls}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t.products.name}>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">{t.products.bomPerUnit}</span>
              <Button
                small
                variant="secondary"
                onClick={() =>
                  setForm({ ...form, bom: [...form.bom, { material_id: 0, quantity: "1" }] })
                }
              >
                + {t.products.addMaterial}
              </Button>
            </div>
            <div className="space-y-2">
              {form.bom.map((line, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    className={`${inputCls} flex-1`}
                    value={line.material_id}
                    onChange={(e) => {
                      const bom = [...form.bom];
                      bom[i] = { ...line, material_id: Number(e.target.value) };
                      setForm({ ...form, bom });
                    }}
                  >
                    <option value={0}>—</option>
                    {materials.map((m) => (
                      <option key={m.material_id} value={m.material_id}>
                        {m.name} ({m.unit})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`${inputCls} w-24`}
                    value={line.quantity}
                    onChange={(e) => {
                      const bom = [...form.bom];
                      bom[i] = { ...line, quantity: e.target.value };
                      setForm({ ...form, bom });
                    }}
                  />
                  <Button
                    small
                    variant="danger"
                    onClick={() => setForm({ ...form, bom: form.bom.filter((_, j) => j !== i) })}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={() => void save()} disabled={busy}>
              {t.common.save}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
