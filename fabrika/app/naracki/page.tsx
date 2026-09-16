"use client";

import { useMemo, useState } from "react";
import {
  Button, Card, EmptyState, ErrorState, Field, inputCls, Modal, PageTitle,
  Skeleton, StatusBadge, Td, Th,
} from "@/components/ui";
import { apiCall, useData } from "@/lib/client";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { t } from "@/lib/strings";
import { Customer, OrderRow, Product } from "@/lib/types";

export default function OrdersPage() {
  const { data: orders, error, loading, reload } = useData<OrderRow[]>("/api/orders");
  const { data: customers } = useData<Customer[]>("/api/customers");
  const { data: products } = useData<Product[]>("/api/products");

  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState({ customer_id: "", product_id: "", quantity: "10" });
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = useMemo(
    () => (orders ?? []).filter((o) => !statusFilter || o.status === statusFilter),
    [orders, statusFilter]
  );

  async function createOrder() {
    if (!form.customer_id || !form.product_id || Number(form.quantity) <= 0) {
      setFormError(t.common.required);
      return;
    }
    setBusy(true);
    const res = await apiCall("/api/orders", "POST", {
      customer_id: Number(form.customer_id),
      product_id: Number(form.product_id),
      quantity: Number(form.quantity),
    });
    setBusy(false);
    if (res.ok) {
      setModalOpen(false);
      setForm({ customer_id: "", product_id: "", quantity: "10" });
      setFormError(null);
      await reload();
    } else {
      setFormError(res.error ?? t.common.error);
    }
  }

  async function orderAction(orderId: number, action: "start" | "deliver") {
    setBusy(true);
    setActionError(null);
    const res = await apiCall("/api/orders", "POST", { action, order_id: orderId });
    setBusy(false);
    if (!res.ok) {
      setActionError(
        res.error?.startsWith("MISSING_MATERIALS:")
          ? `${t.orders.materialMissing} ${res.error.slice("MISSING_MATERIALS:".length)}`
          : res.error ?? t.common.error
      );
    }
    await reload();
  }

  return (
    <div className="space-y-5">
      <PageTitle
        title={t.orders.title}
        subtitle={t.orders.subtitle}
        action={<Button onClick={() => setModalOpen(true)}>+ {t.orders.addTitle}</Button>}
      />

      <div className="flex gap-2 flex-wrap">
        {["", "NEW", "IN_PRODUCTION", "QC", "READY", "DELIVERED"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === s
                ? "bg-emerald-700 text-white border-emerald-700"
                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
            }`}
          >
            {s === "" ? t.common.all : t.status[s]}
          </button>
        ))}
      </div>

      {error && <ErrorState message={t.common.error} onRetry={reload} />}
      {actionError && <ErrorState message={actionError} />}
      {loading && <Skeleton className="h-64 w-full" />}

      {orders && (
        <Card>
          <div className="p-4 overflow-x-auto">
            {filtered.length === 0 ? (
              <EmptyState />
            ) : (
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <Th>{t.orders.number}</Th>
                    <Th>{t.orders.customer}</Th>
                    <Th>{t.orders.product}</Th>
                    <Th right>{t.common.quantity}</Th>
                    <Th right>{t.orders.valueTotal}</Th>
                    <Th>{t.orders.created}</Th>
                    <Th>{t.common.status}</Th>
                    <Th right>{t.common.actions}</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => {
                    const missing = (o.material_check ?? []).filter((m) => m.missing > 0);
                    return [
                      <tr key={o.order_id} className="border-b border-slate-100 last:border-0">
                        <Td className="tabular-nums text-slate-500">
                          #{String(o.order_id).padStart(5, "0")}
                        </Td>
                        <Td className="font-medium">{o.customer_name}</Td>
                        <Td>
                          {o.product_name}{" "}
                          <span className="text-slate-400 text-xs">({o.product_code})</span>
                        </Td>
                        <Td right>{o.quantity}</Td>
                        <Td right>{formatMoney(o.quantity * o.product_price)}</Td>
                        <Td>{formatDate(o.created_at)}</Td>
                        <Td>
                          <StatusBadge status={o.status} labels={t.status} />
                        </Td>
                        <Td right>
                          {o.status === "NEW" && (
                            <span className="inline-flex gap-1.5 items-center">
                              <button
                                onClick={() =>
                                  setExpanded(expanded === o.order_id ? null : o.order_id)
                                }
                                className="text-xs text-slate-500 underline decoration-dotted"
                              >
                                {t.orders.materialCheck}
                              </button>
                              <Button
                                small
                                disabled={busy || missing.length > 0}
                                onClick={() => void orderAction(o.order_id, "start")}
                              >
                                {t.orders.startProduction}
                              </Button>
                            </span>
                          )}
                          {o.status === "READY" && (
                            <Button
                              small
                              disabled={busy || (o.finished_stock ?? 0) <= 0}
                              onClick={() => void orderAction(o.order_id, "deliver")}
                            >
                              {t.orders.deliver}
                            </Button>
                          )}
                        </Td>
                      </tr>,
                      o.status === "NEW" && expanded === o.order_id && (
                        <tr key={`${o.order_id}-check`} className="bg-slate-50">
                          <td colSpan={8} className="px-4 py-3">
                            <p className="text-xs font-medium text-slate-600 mb-2">
                              {t.orders.materialCheck} — {o.product_name} × {o.quantity}
                            </p>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                              {(o.material_check ?? []).map((m) => (
                                <div
                                  key={m.materialId}
                                  className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                                    m.missing > 0
                                      ? "border-amber-300 bg-amber-50 text-amber-800"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  }`}
                                >
                                  {m.name}: {formatQty(m.required)} {m.unit}{" "}
                                  <span className="opacity-70">
                                    (расп. {formatQty(m.available)})
                                  </span>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs mt-2 text-slate-600">
                              {missing.length === 0 ? t.orders.materialOk : t.orders.startBlocked}
                            </p>
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}

      <Modal title={t.orders.addTitle} open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="space-y-4">
          <Field label={t.orders.customer}>
            <select
              className={inputCls}
              value={form.customer_id}
              onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
            >
              <option value="">—</option>
              {(customers ?? []).map((c) => (
                <option key={c.customer_id} value={c.customer_id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.orders.product}>
            <select
              className={inputCls}
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            >
              <option value="">—</option>
              {(products ?? []).map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.common.quantity}>
            <input
              type="number"
              min={1}
              className={inputCls}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </Field>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={() => void createOrder()} disabled={busy}>
              {t.common.save}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
