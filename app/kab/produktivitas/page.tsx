import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { bulanTahunWIB } from "@/lib/format";
import { KOMODITAS, daftarDesa, daftarKecamatan, tahunProduktivitas, type Komoditas } from "@/lib/data";
import { RekapProduktivitas } from "@/components/rekap-produktivitas";
import { FormFilter, JudulHalaman, Pilihan, TombolUnduh } from "@/components/ui";
import { angkaParam, teksParam, type CariParam } from "@/lib/param";

export const metadata: Metadata = { title: "Produktivitas — SMART LTT" };

export default function HalamanProduktivitasKab({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="SMART LTT · Produktivitas" role={["admin_kab"]}>
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

async function Isi({ searchParams }: { searchParams: CariParam }) {
  await wajibRole("admin_kab");
  const q = await searchParams;
  const s = await supabaseServer();
  const tahunIni = bulanTahunWIB().tahun;
  const [kecs, daftarTahun] = await Promise.all([daftarKecamatan(s), tahunProduktivitas(s, tahunIni)]);
  const tahun = angkaParam(q, "tahun", 2000, 2100, tahunIni);
  const kom = ((KOMODITAS as string[]).includes(teksParam(q, "komoditas") ?? "") ? teksParam(q, "komoditas") : "Padi") as Komoditas;
  const kecId = angkaParam(q, "kecamatan", 1, 100000, 0);
  const kec = kecs.find((k) => k.id === kecId);
  const desa = await daftarDesa(s, kec?.id);

  const unduh = `/api/unduh/produktivitas?tahunDari=${tahun}&tahunSampai=${tahun}${kec ? `&kecamatan=${kec.id}` : ""}`;

  return (
    <>
      <JudulHalaman
        judul="Rekap Produktivitas & Sarana"
        sub={kec ? `Kecamatan ${kec.nama} — per desa` : "Se-kabupaten — rata-rata per kecamatan. Pilih kecamatan untuk melihat per desa."}
        aksi={<TombolUnduh href={unduh} />}
      />
      <FormFilter>
        <Pilihan label="Tahun" name="tahun" nilai={tahun} opsi={daftarTahun.map((t) => ({ v: t, t: String(t) }))} />
        <Pilihan label="Komoditas" name="komoditas" nilai={kom} opsi={KOMODITAS.map((k) => ({ v: k, t: k }))} />
        <Pilihan label="Kecamatan" name="kecamatan" nilai={kec?.id ?? ""} opsi={[{ v: "", t: "Semua (per kecamatan)" }, ...kecs.map((k) => ({ v: k.id, t: k.nama }))]} />
      </FormFilter>
      <RekapProduktivitas s={s} kecs={kecs} desa={desa} tahun={tahun} kom={kom} perDesa={Boolean(kec)} />
    </>
  );
}
