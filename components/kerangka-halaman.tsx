import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import type { Role } from "@/lib/auth";
import { wajibRole } from "@/lib/auth";
import { KerangkaAdmin } from "./kerangka-admin";

/**
 * Kerangka halaman — tampilan disamakan dengan aplikasi lama (_gas_lama):
 *  - "ppl": bingkai aplikasi HP (File_HTML_PPL.html). Sub-halaman tampil sebagai panel
 *    dengan tombol kembali (`panel`), beranda mengatur header hijau sendiri.
 *  - "bpp" / "kab": sidebar hijau tua + header hijau (File_HTML_BPP.html / File_HTML_Admin.html).
 * Isi halaman dirender setelah role terbukti, di dalam Suspense (Next 16).
 */
export function KerangkaHalaman({
  judul,
  role,
  gaya = "ppl",
  panel,
  children,
}: {
  judul: string;
  role: Role[];
  gaya?: "ppl" | "bpp" | "kab";
  /** Hanya gaya "ppl": tampilkan kepala panel (tombol kembali + judul) */
  panel?: { judul: string; sub?: string; kembali?: string; warna?: string };
  children: ReactNode;
}) {
  if (gaya !== "ppl") {
    return (
      <Suspense fallback={<KerangkaMemuatAdmin gaya={gaya} />}>
        <PenjagaAdmin role={role} gaya={gaya} judul={judul}>
          {children}
        </PenjagaAdmin>
      </Suspense>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-100 font-sans text-gray-800 md:p-4">
      <div className="relative flex min-h-screen w-full max-w-md flex-col overflow-hidden border border-gray-200 bg-white md:h-[92vh] md:min-h-0 md:max-w-3xl md:rounded-3xl md:shadow-2xl lg:max-w-5xl">
        <div className="flex-1 overflow-y-auto">
          {panel ? (
            <div className="px-5 pt-6 pb-20">
              <KepalaPanel {...panel} />
              <Suspense fallback={<KerangkaMemuat />}>
                <Penjaga role={role}>{children}</Penjaga>
              </Suspense>
            </div>
          ) : (
            <Suspense fallback={<KerangkaMemuatPpl />}>
              <Penjaga role={role}>{children}</Penjaga>
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}

/** Kepala panel PPL (tombol kembali + judul) — juga dipakai halaman yang judulnya bergantung URL. */
export function KepalaPanel({ judul, sub, kembali = "/ppl", warna = "text-green-700" }: { judul: string; sub?: string; kembali?: string; warna?: string }) {
  return (
    <div className="mb-6 flex items-center border-b border-gray-200 pb-3">
      <Link
        href={kembali}
        aria-label="Kembali"
        className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 active:scale-95"
      >
        <ArrowLeft size={16} />
      </Link>
      <div className="min-w-0">
        <h2 className={`text-base font-bold uppercase ${warna}`}>{judul}</h2>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </div>
    </div>
  );
}

async function Penjaga({ role, children }: { role: Role[]; children: ReactNode }) {
  await wajibRole(...role);
  // Isi halaman memakai waktu sekarang (bulan/hari WIB) → dirender per request,
  // bukan saat prerender (Next 16: blocking-prerender-current-time).
  await connection();
  return <>{children}</>;
}

async function PenjagaAdmin({ role, gaya, judul, children }: { role: Role[]; gaya: "bpp" | "kab"; judul: string; children: ReactNode }) {
  const p = await wajibRole(...role);
  await connection();
  return (
    <KerangkaAdmin gaya={gaya} judul={judul} nama={p.nama} role={p.role}>
      {/* Batas terpisah: sidebar & header tampil begitu login dicek; hanya area isi yang menunggu data. */}
      <Suspense fallback={<KerangkaMemuatIsi />}>{children}</Suspense>
    </KerangkaAdmin>
  );
}

/** Skeleton umum saat isi halaman dimuat. */
export function KerangkaMemuat() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Memuat">
      <div className="h-24 animate-pulse rounded-2xl bg-gray-200/70" />
      <div className="h-16 animate-pulse rounded-2xl bg-gray-200/70" />
      <div className="h-16 animate-pulse rounded-2xl bg-gray-200/70" />
    </div>
  );
}

function KerangkaMemuatPpl() {
  return (
    <div aria-busy="true" aria-label="Memuat">
      <div className="h-36 rounded-b-[2rem] bg-green-600 shadow-md" />
      <div className="mt-6 grid grid-cols-4 gap-3 px-5">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="mx-auto h-16 w-16 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

/** Skeleton area isi halaman admin (tab, kartu ringkasan, tabel) — dipakai saat data halaman dimuat. */
export function KerangkaMemuatIsi() {
  const kedip = "animate-pulse rounded-lg bg-gray-200/80";
  return (
    <div aria-busy="true" aria-label="Memuat data" className="space-y-6">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div className="flex gap-2">
          {[24, 16, 20, 20].map((w, i) => (
            <div key={i} className={`h-9 ${kedip}`} style={{ width: `${w * 4}px` }} />
          ))}
        </div>
        <div className={`hidden h-9 w-40 sm:block ${kedip}`} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className={`h-10 w-10 shrink-0 ${kedip}`} />
            <div className="flex-1 space-y-2">
              <div className={`h-2.5 w-2/3 ${kedip}`} />
              <div className={`h-4 w-1/2 ${kedip}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div className="space-y-2">
            <div className={`h-3.5 w-48 ${kedip}`} />
            <div className={`h-2.5 w-32 ${kedip}`} />
          </div>
          <div className={`h-8 w-28 ${kedip}`} />
        </div>
        <div className="space-y-2.5">
          <div className={`h-8 w-full ${kedip}`} />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <div className={`h-5 w-1/4 ${kedip}`} />
              <div className={`h-5 flex-1 ${kedip}`} />
              <div className={`h-5 w-1/6 ${kedip}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton seluruh bingkai admin (sidebar + header + isi) — tampil sebentar saat login dicek. */
function KerangkaMemuatAdmin({ gaya }: { gaya: "bpp" | "kab" }) {
  const isKab = gaya === "kab";
  const garis = "animate-pulse rounded-lg bg-green-700/60";
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-100" aria-busy="true" aria-label="Memuat">
      <aside className="hidden w-64 shrink-0 flex-col bg-green-800 md:flex">
        <div className={`flex items-center gap-3 border-b border-green-700 px-4 ${isKab ? "h-20" : "h-16"}`}>
          <div className={`h-9 w-9 ${garis}`} />
          <div className="flex-1 space-y-2">
            <div className={`h-3.5 w-28 ${garis}`} />
            {isKab && <div className={`h-2 w-36 ${garis}`} />}
          </div>
        </div>
        <div className={`flex-1 space-y-2 ${isKab ? "px-4 py-6" : "px-2 py-4"}`}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <div className={`h-5 w-5 shrink-0 ${garis}`} />
              <div className={`h-3 ${garis}`} style={{ width: `${55 + ((i * 17) % 35)}%` }} />
            </div>
          ))}
        </div>
        <div className="border-t border-green-700 p-4">
          <div className={`h-9 w-full ${garis}`} />
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        {isKab ? (
          <div className="flex h-14 shrink-0 items-center justify-end gap-3 bg-white px-4 shadow-sm sm:h-20 sm:px-8">
            <div className="space-y-1.5">
              <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />
              <div className="ml-auto h-2 w-16 animate-pulse rounded bg-gray-200" />
            </div>
            <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200 sm:h-10 sm:w-10" />
          </div>
        ) : (
          <div className="flex h-16 shrink-0 items-center justify-between bg-green-700 px-4 shadow-md sm:px-6 lg:px-8">
            <div className="h-4 w-40 animate-pulse rounded bg-green-600" />
            <div className="h-9 w-9 animate-pulse rounded-full bg-green-600" />
          </div>
        )}
        <div className={isKab ? "flex-1 p-4 sm:p-6 lg:p-8" : "mx-auto w-full max-w-7xl flex-1 px-4 pt-6 sm:px-6 lg:px-8"}>
          <KerangkaMemuatIsi />
        </div>
      </div>
    </div>
  );
}
