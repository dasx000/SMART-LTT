"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { urlDengan } from "@/lib/param";

export const PER_HAL = 20;

/**
 * Salin filter browser ke URL (replaceState, tanpa memanggil server) agar tetap ada
 * saat buka/tutup form atau muat ulang. Diulang setelah navigasi lain mengubah URL.
 */
export function useFilterDiUrl(param: Record<string, string | number | null>) {
  const urlSekarang = useSearchParams().toString();
  const kunci = JSON.stringify(param);
  useEffect(() => {
    const url = new URL(window.location.href);
    const baru = urlDengan(url.pathname, Object.fromEntries(url.searchParams.entries()), JSON.parse(kunci));
    if (baru !== url.pathname + url.search) window.history.replaceState(null, "", baru);
  }, [kunci, urlSekarang]);
}

/** Nomor halaman yang ditampilkan: awal, akhir, dan ±1 di sekitar halaman aktif ("…" untuk celah). */
function nomorHalaman(hal: number, jml: number): (number | "…")[] {
  const set = [...new Set([1, hal - 1, hal, hal + 1, jml])].filter((n) => n >= 1 && n <= jml).sort((a, b) => a - b);
  const hasil: (number | "…")[] = [];
  set.forEach((n, i) => {
    if (i > 0 && n - set[i - 1] > 1) hasil.push("…");
    hasil.push(n);
  });
  return hasil;
}

/** Tombol halaman ‹ 1 … 4 5 6 … 12 › untuk tabel yang dipaginasi di browser. */
export function Paginasi({ hal, jmlHal, onPilih }: { hal: number; jmlHal: number; onPilih: (hal: number) => void }) {
  if (jmlHal <= 1) return null;
  const panah = "rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:border-gray-100 disabled:text-gray-300 disabled:hover:bg-transparent";
  return (
    <nav className="flex items-center gap-1" aria-label="Halaman">
      <button type="button" disabled={hal <= 1} onClick={() => onPilih(hal - 1)} aria-label="Sebelumnya" className={panah}>
        <ChevronLeft size={14} />
      </button>
      {nomorHalaman(hal, jmlHal).map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} className="px-1 text-gray-400">…</span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onPilih(n)}
            aria-current={n === hal ? "page" : undefined}
            className={`min-w-7 rounded-lg border px-2 py-1 text-center font-bold ${n === hal ? "border-green-600 bg-green-600 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            {n}
          </button>
        ),
      )}
      <button type="button" disabled={hal >= jmlHal} onClick={() => onPilih(hal + 1)} aria-label="Berikutnya" className={panah}>
        <ChevronRight size={14} />
      </button>
    </nav>
  );
}
