import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Role } from "@/lib/auth";

/**
 * Data pengguna SMART LTT (gabungan core.profiles + core.memberships 'ltt' + ltt.anggota + ltt.anggota_desa).
 * Memakai service role karena RLS anggota/anggota_desa hanya "diri sendiri".
 * PEMANGGIL WAJIB sudah memeriksa role & cakupan wilayah (BPP = kecamatannya).
 */

export type Anggota = {
  id: string;
  nama: string;
  nip: string;
  email: string | null;
  role: Role;
  kecamatanId: number | null;
  aktif: boolean;
  whatsapp: string | null;
  wajibGanti: boolean;
  desaIds: number[];
};

export async function daftarAnggota(f: { kecamatanId?: number | null; role?: Role[] } = {}): Promise<Anggota[]> {
  const a = supabaseAdmin();
  let q = a.from("anggota").select("user_id, kecamatan_id, aktif, whatsapp, wajib_ganti_password").limit(2000);
  if (f.kecamatanId) q = q.eq("kecamatan_id", f.kecamatanId);
  const { data: ang, error } = await q;
  if (error) throw new Error(error.message);
  const ids = (ang ?? []).map((x) => x.user_id);
  if (ids.length === 0) return [];

  const potong = <T,>(arr: T[], n = 150) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
  const prof: { id: string; nama: string | null; nip: string | null; email: string | null }[] = [];
  const mem: { user_id: string; role: string }[] = [];
  const binaan: { user_id: string; desa_id: number }[] = [];
  for (const bagian of potong(ids)) {
    const [p, m, d] = await Promise.all([
      a.schema("core").from("profiles").select("id, nama, nip, email").in("id", bagian),
      a.schema("core").from("memberships").select("user_id, role").eq("app_slug", "ltt").in("user_id", bagian),
      a.from("anggota_desa").select("user_id, desa_id").in("user_id", bagian).limit(5000),
    ]);
    if (p.error || m.error || d.error) throw new Error((p.error ?? m.error ?? d.error)!.message);
    prof.push(...(p.data ?? []));
    mem.push(...(m.data ?? []));
    binaan.push(...(d.data ?? []));
  }

  const peta = new Map(prof.map((x) => [x.id, x]));
  const roleMap = new Map(mem.map((x) => [x.user_id, x.role as Role]));
  return (ang ?? [])
    .filter((x) => roleMap.has(x.user_id))
    .map((x) => ({
      id: x.user_id,
      nama: peta.get(x.user_id)?.nama ?? "-",
      nip: peta.get(x.user_id)?.nip ?? "",
      email: peta.get(x.user_id)?.email ?? null,
      role: roleMap.get(x.user_id)!,
      kecamatanId: x.kecamatan_id,
      aktif: x.aktif,
      whatsapp: x.whatsapp,
      wajibGanti: x.wajib_ganti_password,
      desaIds: binaan.filter((b) => b.user_id === x.user_id).map((b) => b.desa_id),
    }))
    .filter((x) => !f.role || f.role.includes(x.role))
    .sort((p, q2) => p.nama.localeCompare(q2.nama, "id"));
}
