import type { ReactNode } from "react";
import Link from "next/link";

/** Tab dashboard Kab (gaya lama): Ringkasan / Padi / Jagung / Ubi Kayu — masing-masing URL sendiri. */
const TAB = [
  { href: "/kab", label: "Ringkasan" },
  { href: "/kab/rekap/padi", label: "Padi" },
  { href: "/kab/rekap/jagung", label: "Jagung" },
  { href: "/kab/rekap/ubi-kayu", label: "Ubi Kayu" },
];

export function TabDashboardKab({ aktif, kanan }: { aktif: string; kanan?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-3 border-b border-gray-200 pb-3 sm:flex-row sm:items-center">
      <nav className="flex w-full items-center gap-2 overflow-x-auto pb-1" aria-label="Tab dashboard">
        {TAB.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={aktif === t.href ? "page" : undefined}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
              aktif === t.href ? "bg-green-600 text-white" : "text-gray-500 hover:text-green-600"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {kanan}
    </div>
  );
}
