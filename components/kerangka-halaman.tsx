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
      <Suspense fallback={<KerangkaMemuatAdmin />}>
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
      {children}
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

function KerangkaMemuatAdmin() {
  return (
    <div className="flex h-screen w-full bg-gray-100" aria-busy="true" aria-label="Memuat">
      <div className="hidden w-64 bg-green-800 md:block" />
      <div className="flex-1">
        <div className="h-16 bg-green-700" />
        <div className="mx-auto max-w-7xl px-4 pt-6">
          <KerangkaMemuat />
        </div>
      </div>
    </div>
  );
}
