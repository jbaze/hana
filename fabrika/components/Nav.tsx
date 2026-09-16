"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/lib/strings";

const links = [
  { href: "/", label: t.nav.dashboard },
  { href: "/naracki", label: t.nav.orders },
  { href: "/proizvodstvo", label: t.nav.production },
  { href: "/kvalitet", label: t.nav.quality },
  { href: "/magacin", label: t.nav.warehouse },
  { href: "/proizvodi", label: t.nav.products },
  { href: "/klienti", label: t.nav.customers },
  { href: "/izvestai", label: t.nav.reports },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-white font-bold">
            М
          </span>
          <span className="font-semibold tracking-tight text-slate-900 hidden md:block">
            {t.appName}
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 overflow-x-auto">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-emerald-50 text-emerald-800"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
