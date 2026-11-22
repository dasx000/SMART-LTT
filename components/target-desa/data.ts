import "server-only";
import { ambilTargetDesa, type DesaRef, type Kec, type Komoditas, type Supa } from "@/lib/data";
import { daftarAnggota } from "@/lib/pengguna";
import type { BarisTargetDesa } from "./jenis";

const LABEL_ROLE: Record<string, string> = { penyuluh: "PPL", admin_bpp: "Admin BPP", admin_kab: "Admin Kab", viewer: "Viewer" };

/**
 * Baris daftar Target Desa (menu Admin Kab & BPP) untuk satu (tahun, bulan, komoditas):
 * semua desa yang diberikan — yang belum punya target tetap ikut (status "Belum diisi").
 * PEMANGGIL WAJIB sudah memeriksa role & cakupan wilayah (daftarAnggota memakai service role).
 */
export async function barisTargetDesa(
  s: Supa,
  f: { tahun: number; bulan: number; kom: Komoditas; desa: DesaRef[]; kecs: Kec[] },
): Promise<BarisTargetDesa[]> {
  const ids = f.desa.map((d) => d.id);
  const [target, { data: pembuat, error }, anggota] = await Promise.all([
    ambilTargetDesa(s, ids, { tahun: f.tahun, bulan: f.bulan, komoditas: f.kom }),
    s.from("target_desa").select("desa_id, pembuat_id").eq("tahun", f.tahun).eq("bulan", f.bulan).eq("komoditas", f.kom).limit(5000),
    daftarAnggota(),
  ]);
  if (error) throw new Error(error.message);

  const namaKec = new Map(f.kecs.map((k) => [k.id, k.nama]));
  const orang = new Map(anggota.map((a) => [a.id, a]));
  const pembuatDesa = new Map((pembuat ?? []).map((r) => [r.desa_id as number, r.pembuat_id as string | null]));
  const tDesa = new Map(target.map((t) => [t.desaId, t]));

  return f.desa.map((d) => {
    const t = tDesa.get(d.id);
    const pid = pembuatDesa.get(d.id) ?? null;
    const u = pid ? orang.get(pid) : undefined;
    const ppl = anggota.filter((a) => a.aktif && (a.role === "penyuluh" || a.role === "admin_bpp") && a.desaIds.includes(d.id)).map((a) => a.nama);
    return {
      id: d.id,
      nama: d.nama,
      kecamatanId: d.kecamatan_id,
      kecamatan: namaKec.get(d.kecamatan_id) ?? "-",
      ppl,
      target: t ? { tanam: t.tanam, panen: t.panen, luasBaku: t.luasBaku, rincian: t.rincian } : null,
      pembuat: t ? { id: pid, nama: u?.nama ?? (pid ? "Pengguna lain" : "Impor / sistem"), peran: u ? LABEL_ROLE[u.role] ?? u.role : "" } : null,
    };
  });
}
