import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import type { Role } from "@/lib/auth";
import { wajibRole } from "@/lib/auth";
import { KepalaAplikasi } from "./kepala-aplikasi";
import { MenuPeran } from "./menu-peran";

/**
 * Kerangka halaman yang wajib login + role tertentu.
 * Isi halaman dirender hanya setelah role terbukti (di dalam Suspense, sesuai Next 16).
 */
export function KerangkaHalaman({
  judul,
  role,
  children,
}: {
  judul: string;
  role: Role[];
  children: ReactNode;
}) {
  return (
    <>
      <KepalaAplikasi judul={judul} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        <Suspense fallback={<KerangkaMemuat />}>
          <Penjaga role={role}>{children}</Penjaga>
        </Suspense>
      </main>
    </>
  );
}

async function Penjaga({ role, children }: { role: Role[]; children: ReactNode }) {
  const pengguna = await wajibRole(...role);
  // Isi halaman memakai waktu sekarang (bulan/hari WIB) → harus dirender per request,
  // bukan saat prerender (Next 16: blocking-prerender-current-time).
  await connection();
  return (
    <>
      <MenuPeran role={pengguna.role} />
      {children}
    </>
  );
}

/** Skeleton umum saat isi halaman dimuat. */
export function KerangkaMemuat() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Memuat">
      <div className="h-24 animate-pulse rounded-2xl bg-border/70" />
      <div className="h-16 animate-pulse rounded-2xl bg-border/70" />
      <div className="h-16 animate-pulse rounded-2xl bg-border/70" />
    </div>
  );
}
