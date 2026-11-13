import "server-only";
import { redirect } from "next/navigation";
import { cacheLife } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseSiap } from "@/lib/env";

export type Role = "Penyuluh" | "Admin_BPP" | "Admin_Kab" | "Dinas";

export type Pengguna = {
  id: string;
  nip: string;
  nama: string;
  role: Role;
  kecamatanId: number | null;
  wajibGantiPassword: boolean;
};

/** Halaman awal tiap role. */
export const BERANDA_ROLE: Record<Role, string> = {
  Penyuluh: "/ppl",
  Admin_BPP: "/bpp",
  Admin_Kab: "/kab",
  Dinas: "/kab",
};

/**
 * Data Access Layer: satu-satunya tempat membaca sesi + profil.
 * Dengan cacheComponents, pemanggilnya harus berada di dalam <Suspense>.
 * `use cache: private` = hasil disimpan per-browser saja, tidak di server.
 * Mengembalikan null bila belum login / akun nonaktif.
 */
export async function getPenggunaOpsional(): Promise<Pengguna | null> {
  "use cache: private";
  // Disimpan di memori browser maks. 60 detik (pindah halaman instan).
  // Server Action tetap memeriksa ulang sesi sendiri, jadi aman.
  cacheLife({ stale: 60 });

  if (!supabaseSiap()) return null; // belum dikonfigurasi → perlakukan sebagai belum login

  const supabase = await supabaseServer();
  const { data: klaim } = await supabase.auth.getClaims();
  const userId = klaim?.claims?.sub;
  if (!userId) return null;

  // Satu RPC menggabungkan core.profiles (nama, nip), core.memberships (role di app 'ltt')
  // dan ltt.anggota (kecamatan, aktif, wajib ganti password) untuk auth.uid().
  // Didefinisikan di supabase/migrations (Fase 2).
  const { data, error } = await supabase.rpc("pengguna_saya");
  const p = Array.isArray(data) ? data[0] : data;
  if (error || !p || !p.aktif) return null; // tidak punya akses SMART LTT / nonaktif

  return {
    id: p.id,
    nip: p.nip,
    nama: p.nama,
    role: p.role as Role,
    kecamatanId: p.kecamatan_id,
    wajibGantiPassword: p.wajib_ganti_password,
  };
}

/** Wajib login; jika tidak → /login. */
export async function getPengguna(): Promise<Pengguna> {
  const u = await getPenggunaOpsional();
  if (!u) redirect("/login");
  return u;
}

/** Wajib login DAN role termasuk `boleh`; jika role lain → beranda role-nya. */
export async function wajibRole(...boleh: Role[]): Promise<Pengguna> {
  const u = await getPengguna();
  if (!boleh.includes(u.role)) redirect(BERANDA_ROLE[u.role]);
  return u;
}
