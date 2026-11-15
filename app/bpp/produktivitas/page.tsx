import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { bulanTahunWIB } from "@/lib/format";
import { KOMODITAS, daftarDesa, daftarKecamatan, tahunProduktivitas, type Komoditas } from "@/lib/data";
import { RekapProduktivitas } from "@/components/rekap-produktivitas";
import { FormFilter, JudulHalaman, Kosong, Pilihan, TombolUnduh } from "@/components/ui";
import { angkaParam, teksParam, type CariParam } from "@/lib/param";

export const metadata: Metadata = { title: "Produktivitas BPP — SMART LTT" };

export default function HalamanProduktivitasBpp({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="BPP" role={["admin_bpp"]} gaya="bpp">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("admin_bpp");
  if (!p.kecamatanId) return <Kosong teks="Akun Anda belum terikat ke kecamatan. Hubungi Admin Kabupaten." />;
  const q = await searchParams;
  const s = await supabaseServer();
  const tahunIni = bulanTahunWIB().tahun;
  const [kecs, desa, daftarTahun] = await Promise.all([daftarKecamatan(s), daftarDesa(s, p.kecamatanId), tahunProduktivitas(s, tahunIni)]);
  const tahun = angkaParam(q, "tahun", 2000, 2100, tahunIni);
  const kom = ((KOMODITAS as string[]).includes(teksParam(q, "komoditas") ?? "") ? teksParam(q, "komoditas") : "Padi") as Komoditas;

  return (
    <>
      <JudulHalaman
        judul="Rekap Produktivitas Kecamatan"
        sub="Diisi PPL untuk desa binaannya (menu Isi Produktivitas)."
        aksi={<TombolUnduh href={`/api/unduh/produktivitas?tahunDari=${tahun}&tahunSampai=${tahun}`} />}
      />
      <FormFilter>
        <Pilihan label="Tahun" name="tahun" nilai={tahun} opsi={daftarTahun.map((t) => ({ v: t, t: String(t) }))} />
        <Pilihan label="Komoditas" name="komoditas" nilai={kom} opsi={KOMODITAS.map((k) => ({ v: k, t: k }))} />
      </FormFilter>
      <RekapProduktivitas s={s} kecs={kecs} desa={desa} tahun={tahun} kom={kom} perDesa />
    </>
  );
}
