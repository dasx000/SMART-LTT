"use client";

import { useState, type ReactNode } from "react";
import { Download, LoaderCircle } from "lucide-react";
import type { SpesifikasiExcel } from "@/lib/excel-spec";

/**
 * Tombol unduh Excel: ambil data (JSON) dari /api/unduh/..., lalu file .xlsx dibuat di BROWSER.
 * Pustaka Excel baru dimuat saat tombol diklik, jadi tidak memberatkan pembukaan halaman.
 */
export function TombolUnduh({
  href,
  label = "Unduh Excel",
  className = "inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95",
  ikon,
}: {
  href: string;
  label?: ReactNode;
  className?: string;
  ikon?: ReactNode;
}) {
  const [proses, setProses] = useState(false);

  const klik = async () => {
    if (proses) return;
    setProses(true);
    try {
      const [res, mod] = await Promise.all([fetch(href, { cache: "no-store" }), import("@/lib/excel")]);
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const spec = (await res.json()) as SpesifikasiExcel;
      await mod.unduhExcel(spec);
    } catch (e) {
      const { gagal } = await import("@/lib/swal");
      gagal("Gagal mengunduh", e instanceof Error ? e.message : "Coba lagi.");
    } finally {
      setProses(false);
    }
  };

  return (
    <button type="button" onClick={klik} disabled={proses} aria-busy={proses} className={`disabled:cursor-wait disabled:opacity-80 ${className}`}>
      {proses ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : (ikon ?? <Download size={14} aria-hidden />)}
      {proses ? "Menyiapkan…" : label}
    </button>
  );
}
