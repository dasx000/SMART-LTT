"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/auth";

type Item = { href: string; label: string };

const MENU_PPL: Item[] = [
  { href: "/ppl", label: "Lapor" },
  { href: "/ppl/target", label: "Target" },
  { href: "/ppl/rekap", label: "Rekap" },
  { href: "/ppl/produktivitas", label: "Produktivitas" },
];

/** Menu per role. viewer tidak punya menu: hanya Dashboard + PM AAS (keputusan §25 no. 13). */
const MENU: Record<Role, Item[]> = {
  penyuluh: MENU_PPL,
  admin_bpp: [
    { href: "/bpp", label: "Dashboard BPP" },
    { href: "/bpp/target", label: "Target" },
    { href: "/bpp/produktivitas", label: "Produktivitas" },
    { href: "/bpp/pengguna", label: "Kelola PPL" },
    { href: "/ppl", label: "Lapor (PPL)" },
    { href: "/ppl/rekap", label: "Rekap" },
    { href: "/ppl/produktivitas", label: "Isi Produktivitas" },
  ],
  admin_kab: [
    { href: "/kab", label: "Dashboard" },
    { href: "/kab/rekap", label: "Rekap" },
    { href: "/kab/target", label: "Target" },
    { href: "/kab/produktivitas", label: "Produktivitas" },
    { href: "/kab/pengguna", label: "Pengguna" },
    { href: "/kab/logs", label: "Log Sinkron" },
  ],
  viewer: [],
};

/** Baris menu yang bisa digeser di HP. Ringan: hanya Link + usePathname. */
export function MenuPeran({ role }: { role: Role }) {
  const path = usePathname();
  const item = MENU[role];
  if (item.length === 0) return null;

  return (
    <nav aria-label="Menu" className="-mx-4 mb-4 overflow-x-auto px-4">
      <ul className="flex w-max gap-2">
        {item.map((m) => {
          const aktif = path === m.href;
          return (
            <li key={m.href}>
              <Link
                href={m.href}
                aria-current={aktif ? "page" : undefined}
                className={`block rounded-full border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                  aktif
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface text-foreground hover:border-primary/50"
                }`}
              >
                {m.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
