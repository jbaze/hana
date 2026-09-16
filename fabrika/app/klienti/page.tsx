"use client";

import { useState } from "react";
import {
  Button, Card, EmptyState, ErrorState, Field, inputCls, Modal, PageTitle,
  Skeleton, Td, Th,
} from "@/components/ui";
import { apiCall, useData } from "@/lib/client";
import { t } from "@/lib/strings";
import { Customer } from "@/lib/types";

const emptyForm = {
  customer_id: 0,
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  city: "",
};

export default function CustomersPage() {
  const { data, error, loading, reload } = useData<Customer[]>("/api/customers");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = (data ?? []).filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.city ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function save() {
    if (!form.name.trim()) {
      setFormError(t.common.required);
      return;
    }
    setBusy(true);
    const res = await apiCall("/api/customers", form.customer_id ? "PUT" : "POST", form);
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      await reload();
    } else setFormError(res.error ?? t.common.error);
  }

  async function remove(c: Customer) {
    if (!confirm(t.common.confirmDelete)) return;
    const res = await apiCall(`/api/customers?id=${c.customer_id}`, "DELETE");
    if (!res.ok && res.error === "HAS_ORDERS") alert(t.customers.deleteBlocked);
    await reload();
  }

  return (
    <div className="space-y-5">
      <PageTitle
        title={t.customers.title}
        subtitle={t.customers.subtitle}
        action={
          <Button
            onClick={() => {
              setForm(emptyForm);
              setFormError(null);
              setOpen(true);
            }}
          >
            + {t.customers.addTitle}
          </Button>
        }
      />

      <input
        type="search"
        placeholder={t.common.search}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`${inputCls} max-w-sm`}
      />

      {error && <ErrorState message={t.common.error} onRetry={reload} />}
      {loading && <Skeleton className="h-64 w-full" />}

      {data && (
        <Card>
          <div className="p-4 overflow-x-auto">
            {filtered.length === 0 ? (
              <EmptyState />
            ) : (
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-200">
                    <Th>{t.customers.name}</Th>
                    <Th>{t.customers.contact}</Th>
                    <Th>{t.customers.phone}</Th>
                    <Th>{t.customers.email}</Th>
                    <Th>{t.customers.city}</Th>
                    <Th right>{t.customers.ordersCount}</Th>
                    <Th right>{t.common.actions}</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.customer_id} className="border-b border-slate-100 last:border-0">
                      <Td className="font-medium">{c.name}</Td>
                      <Td>{c.contact_person ?? "—"}</Td>
                      <Td className="tabular-nums">{c.phone ?? "—"}</Td>
                      <Td className="text-slate-500">{c.email ?? "—"}</Td>
                      <Td>{c.city ?? "—"}</Td>
                      <Td right>{c.orders_count}</Td>
                      <Td right>
                        <span className="inline-flex gap-1.5">
                          <Button
                            small
                            variant="secondary"
                            onClick={() => {
                              setForm({
                                customer_id: c.customer_id,
                                name: c.name,
                                contact_person: c.contact_person ?? "",
                                phone: c.phone ?? "",
                                email: c.email ?? "",
                                city: c.city ?? "",
                              });
                              setFormError(null);
                              setOpen(true);
                            }}
                          >
                            {t.common.edit}
                          </Button>
                          <Button small variant="danger" onClick={() => void remove(c)}>
                            {t.common.delete}
                          </Button>
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}

      <Modal
        title={form.customer_id ? t.customers.editTitle : t.customers.addTitle}
        open={open}
        onClose={() => setOpen(false)}
      >
        <div className="space-y-4">
          <Field label={t.customers.name}>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.customers.contact}>
              <input
                className={inputCls}
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
              />
            </Field>
            <Field label={t.customers.phone}>
              <input
                className={inputCls}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label={t.customers.email}>
              <input
                type="email"
                className={inputCls}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label={t.customers.city}>
              <input
                className={inputCls}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </Field>
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
