import { t } from "@/lib/strings";

export function formatNumber(n: number): string {
  return n.toLocaleString("mk-MK");
}

export function formatMoney(n: number): string {
  return `${Math.round(n).toLocaleString("mk-MK")} ${t.common.denars}`;
}

export function formatQty(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString("mk-MK");
}

/** "2026-09-14 10:23:00" -> "14.09.2026" */
export function formatDate(s: string): string {
  const d = s.slice(0, 10).split("-");
  return `${d[2]}.${d[1]}.${d[0]}`;
}
