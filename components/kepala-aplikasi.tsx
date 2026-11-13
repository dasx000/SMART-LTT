import { Suspense } from "react";
import { LogOut, Sprout } from "lucide-react";
import { getPengguna } from "@/lib/auth";
import { logout } from "@/app/(auth)/login/actions";

const LABEL_ROLE = {
  Penyuluh: "Penyuluh",
  Admin_BPP: "Koordinator BPP",
  Admin_Kab: "Admin Kabupaten",
  Dinas: "Dinas",
} as const;

/** Kepala halaman. Bagian statis tampil instan; nama user menyusul (Suspense). */
export function KepalaAplikasi({ judul }: { judul: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
          <Sprout size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black leading-tight">{judul}</p>
          <Suspense fallback={<p className="h-4 w-24 animate-pulse rounded bg-border" />}>
            <NamaPengguna />
          </Suspense>
        </div>
        <form action={logout}>
          <button
            type="submit"
            aria-label="Keluar"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-background"
          >
            <LogOut size={20} />
          </button>
        </form>
      </div>
    </header>
  );
}

async function NamaPengguna() {
  const u = await getPengguna();
  return (
    <p className="truncate text-xs text-muted">
      {u.nama} · {LABEL_ROLE[u.role]}
    </p>
  );
}
