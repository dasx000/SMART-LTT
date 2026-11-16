import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NAMA_BULAN, bulanTahunWIB } from "@/lib/format";
import { kirimKePengguna } from "@/lib/push";

type Kurang = { userId: string; belum: string[]; total: number };

/**
 * Pengingat push: PPL (penyuluh / admin_bpp, akun aktif) yang masih punya desa binaan
 * tanpa target PADI untuk bulan berjalan (WIB). Hanya user yang sudah berlangganan notifikasi.
 */
export async function kirimPengingatTargetPadi(kini = new Date()) {
  const { tahun, bulan } = bulanTahunWIB(kini);
  const a = supabaseAdmin();

  // 1. Mulai dari user yang punya langganan (biasanya jauh lebih sedikit dari semua PPL)
  const { data: lgn, error: eL } = await a.from("push_langganan").select("user_id");
  if (eL) throw new Error(eL.message);
  const pelanggan = [...new Set((lgn ?? []).map((r) => r.user_id as string))];
  if (pelanggan.length === 0) return { tahun, bulan, ppl: 0, terkirim: 0, gagal: 0, dihapus: 0 };

  // 2. Saring: role PPL di app 'ltt' + akun aktif
  const [{ data: mem, error: eM }, { data: ang, error: eA }] = await Promise.all([
    a.schema("core").from("memberships").select("user_id, role").eq("app_slug", "ltt").in("user_id", pelanggan),
    a.from("anggota").select("user_id, aktif").in("user_id", pelanggan),
  ]);
  if (eM) throw new Error(eM.message);
  if (eA) throw new Error(eA.message);
  const aktif = new Set((ang ?? []).filter((r) => r.aktif).map((r) => r.user_id as string));
  const ppl = (mem ?? [])
    .filter((m) => (m.role === "penyuluh" || m.role === "admin_bpp") && aktif.has(m.user_id as string))
    .map((m) => m.user_id as string);
  if (ppl.length === 0) return { tahun, bulan, ppl: 0, terkirim: 0, gagal: 0, dihapus: 0 };

  // 3. Desa binaan masing-masing + target Padi bulan ini
  const { data: bin, error: eB } = await a.from("anggota_desa").select("user_id, desa:desa_id(id, nama)").in("user_id", ppl);
  if (eB) throw new Error(eB.message);
  const binaan = (bin ?? []) as unknown as { user_id: string; desa: { id: number; nama: string } | null }[];
  const idDesa = [...new Set(binaan.map((b) => b.desa?.id).filter((x): x is number => typeof x === "number"))];
  const terisi = new Set<number>();
  for (let i = 0; i < idDesa.length; i += 300) {
    const { data, error } = await a
      .from("target_desa")
      .select("desa_id")
      .eq("tahun", tahun)
      .eq("bulan", bulan)
      .eq("komoditas", "Padi")
      .in("desa_id", idDesa.slice(i, i + 300));
    if (error) throw new Error(error.message);
    for (const r of data ?? []) terisi.add(r.desa_id as number);
  }

  const perUser = new Map<string, Kurang>();
  for (const b of binaan) {
    if (!b.desa) continue;
    const k = perUser.get(b.user_id) ?? { userId: b.user_id, belum: [], total: 0 };
    k.total++;
    if (!terisi.has(b.desa.id)) k.belum.push(b.desa.nama);
    perUser.set(b.user_id, k);
  }
  const kurang = new Map([...perUser].filter(([, k]) => k.belum.length > 0));
  if (kurang.size === 0) return { tahun, bulan, ppl: 0, terkirim: 0, gagal: 0, dihapus: 0 };

  const periode = `${NAMA_BULAN[bulan - 1]} ${tahun}`;
  const url = `/ppl/target?tahun=${tahun}&bulan=${bulan}&komoditas=Padi`;
  const hasil = await kirimKePengguna([...kurang.keys()], (userId) => {
    const k = kurang.get(userId)!;
    const daftar = k.belum.sort((x, y) => x.localeCompare(y, "id"));
    const nama = daftar.length > 3 ? `${daftar.slice(0, 3).join(", ")}, +${daftar.length - 3} lainnya` : daftar.join(", ");
    return {
      title: `Target Padi ${periode} belum diisi`,
      body: `${k.belum.length} dari ${k.total} desa binaan: ${nama}. Ketuk untuk mengisi.`,
      url,
      tag: `target-padi-${tahun}-${bulan}`,
    };
  });
  return { tahun, bulan, ppl: kurang.size, ...hasil };
}
