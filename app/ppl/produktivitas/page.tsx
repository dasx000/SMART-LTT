import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { bulanTahunWIB } from "@/lib/format";
import { ambilSemua } from "@/lib/supabase/ambil-semua";
import { ambilSarana, desaBinaanSaya, type Komoditas } from "@/lib/data";
import { JudulHalaman, Kosong, TombolUnduh } from "@/components/ui";
import { FormProduktivitas, type ProdData } from "./form-produktivitas";

export const metadata: Metadata = { title: "Produktivitas — SMART LTT" };

export default function HalamanProduktivitasPpl() {
  return (
    <KerangkaHalaman judul="SMART LTT · Produktivitas" role={["penyuluh", "admin_bpp"]}>
      <Isi />
    </KerangkaHalaman>
  );
}

async function Isi() {
  const p = await wajibRole("penyuluh", "admin_bpp");
  const s = await supabaseServer();
  const desa = await desaBinaanSaya(s, p.id);
  const ids = desa.map((d) => d.id);
  const tahunIni = bulanTahunWIB().tahun;

  type R = { tahun: number; desa_id: number; komoditas: Komoditas; bulan: number; nilai: number };
  const [rows, sarana] = await Promise.all([
    ids.length
      ? ambilSemua<R>((a, b) =>
          s
            .from("produktivitas_desa")
            .select("tahun, desa_id, komoditas, bulan, nilai")
            .in("desa_id", ids)
            .order("tahun")
            .order("desa_id")
            .order("komoditas")
            .order("bulan")
            .range(a, b) as unknown as PromiseLike<{ data: R[] | null; error: { message: string } | null }>,
        )
      : Promise.resolve([] as R[]),
    ambilSarana(s, ids),
  ]);

  const peta = new Map<string, ProdData>();
  for (const r of rows) {
    const k = `${r.tahun}|${r.desa_id}|${r.komoditas}`;
    const d = peta.get(k) ?? { tahun: r.tahun, desaId: r.desa_id, komoditas: r.komoditas, nilai: new Array(12).fill(0) };
    d.nilai[r.bulan - 1] = Number(r.nilai) || 0;
    peta.set(k, d);
  }
  const tahunPilihan = [...new Set([tahunIni, tahunIni - 1, ...rows.map((r) => r.tahun)])].sort((a, b) => b - a);

  return (
    <>
      <JudulHalaman
        judul="Produktivitas & Sarana"
        sub="Desa binaan Anda."
        aksi={<TombolUnduh href={`/api/unduh/produktivitas?tahunDari=${tahunIni - 1}&tahunSampai=${tahunIni}`} />}
      />
      {desa.length === 0 ? (
        <Kosong teks="Belum ada desa binaan. Hubungi Admin BPP." />
      ) : (
        <FormProduktivitas
          desa={desa.map((d) => ({ id: d.id, nama: d.nama }))}
          data={[...peta.values()]}
          sarana={[...sarana].map(([desaId, x]) => ({
            desaId,
            gudang_gabah: x.gudang_gabah,
            embung: x.embung,
            lantai_jemur: x.lantai_jemur,
            mesin_pengering: x.mesin_pengering,
          }))}
          tahunPilihan={tahunPilihan}
        />
      )}
    </>
  );
}
