import { t } from "@/lib/strings";

/** Number/money/time formatting helpers (Macedonian locale). */

export function formatNumber(n: number): string {
  return n.toLocaleString("mk-MK");
}

export function formatMoney(n: number): string {
  return `${Math.round(n).toLocaleString("mk-MK")} ${t.common.currency}`;
}

export function formatMs(n: number): string {
  return n >= 100 ? `${Math.round(n)} ms` : `${n.toFixed(1)} ms`;
}
