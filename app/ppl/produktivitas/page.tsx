import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman, KepalaPanel } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { bulanTahunWIB, formatTanggalJam } from "@/lib/format";
import { KOMODITAS, ambilProduktivitas, ambilSarana, desaBinaanSaya, tahunProduktivitas } from "@/lib/data";
import { Kosong } from "@/components/ui";
import { SelectOtomatis } from "@/components/select-otomatis";
import { angkaParam, teksParam, type CariParam } from "@/lib/param";
import { KartuSarana, TabelProd } from "./form-produktivitas";

export const metadata: Metadata = { title: "Produktivitas — SMART LTT" };

/**
 * /ppl/produktivitas?desa=12&tahun=2026   → tabel produktivitas satu desa (12 bulan × 3 komoditas)
 * /ppl/produktivitas?tab=sarana           → isian sarana desa
 * Hanya data desa & tahun terpilih yang dikirim ke browser.
 */
export default function HalamanProduktivitasPpl({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Produktivitas" role={["penyuluh", "admin_bpp"]} gaya="ppl">
      <div className="px-5 pt-6 pb-20">
        <Isi searchParams={searchParams} />
      </div>
    </KerangkaHalaman>
  );
}

async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("penyuluh", "admin_bpp");
  const q = await searchParams;
  const sarana = teksParam(q, "tab") === "sarana";
  const tahunIni = bulanTahunWIB().tahun;
  const tahun = angkaParam(q, "tahun", 2000, 2100, tahunIni);

  const s = await supabaseServer();
  const desa = await desaBinaanSaya(s, p.id);

  if (desa.length === 0) {
    return (
      <>
        <KepalaPanel judul={sarana ? "Sarana Desa" : "Produktivitas"} warna={sarana ? "text-orange-600" : undefined} />
        <Kosong teks="Belum ada desa binaan. Hubungi Admin BPP." />
      </>
    );
  }

  const desaPilih = desa.find((d) => d.id === angkaParam(q, "desa", 1, Number.MAX_SAFE_INTEGER, 0)) ?? desa[0];
  const { data: kec } = await s.from("kecamatan").select("nama").eq("id", desaPilih.kecamatan_id).maybeSingle();
  const subKec = kec?.nama ? `Kec. ${kec.nama}` : "Desa binaan Anda";
  const kelasPilih = (fokus: string) =>
    `mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-800 normal-case tracking-normal focus:outline-hidden ${fokus}`;
  const pilihDesa = (fokus: string) => (
    <label className="flex-1 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
      Desa
      <SelectOtomatis name="desa" defaultValue={desaPilih.id} className={kelasPilih(fokus)}>
        {desa.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nama}
          </option>
        ))}
      </SelectOtomatis>
    </label>
  );

  if (sarana) {
    const data = await ambilSarana(s, [desaPilih.id]);
    const x = data.get(desaPilih.id);
    return (
      <>
        <KepalaPanel judul="Sarana Desa" sub={subKec} warna="text-orange-600" />
        <form method="get" className="mb-3">
          <input type="hidden" name="tab" value="sarana" />
          {pilihDesa("focus:border-orange-400")}
        </form>
        <KartuSarana
          key={desaPilih.id}
          desaId={desaPilih.id}
          awal={x ? { desaId: desaPilih.id, gudang_gabah: x.gudang_gabah, embung: x.embung, lantai_jemur: x.lantai_jemur, mesin_pengering: x.mesin_pengering } : undefined}
          diperbarui={x?.updated_at ? formatTanggalJam(x.updated_at) : null}
        />
      </>
    );
  }

  const [nilai, daftarTahun, terakhir] = await Promise.all([
    ambilProduktivitas(s, tahun, [desaPilih.id]),
    tahunProduktivitas(s, tahunIni),
    s.from("produktivitas_desa").select("updated_at").eq("tahun", tahun).eq("desa_id", desaPilih.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const pilihanTahun = [...new Set([...daftarTahun, tahunIni - 1])].sort((a, b) => b - a);
  const awal = Object.fromEntries(KOMODITAS.map((k) => [k, nilai.get(`${desaPilih.id}|${k}`)]).filter(([, v]) => v));
  const diperbarui = terakhir.data?.updated_at ? formatTanggalJam(terakhir.data.updated_at as string) : null;

  return (
    <>
      <KepalaPanel judul="Produktivitas" sub={subKec} />
      <form method="get" className="mb-2 flex items-end gap-2">
        {pilihDesa("focus:border-green-500")}
        <label className="w-24 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
          Tahun
          <SelectOtomatis name="tahun" defaultValue={tahun} className={kelasPilih("focus:border-green-500")}>
            {pilihanTahun.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectOtomatis>
        </label>
      </form>
      <TabelProd
        key={`${desaPilih.id}-${tahun}`}
        desaId={desaPilih.id}
        tahun={tahun}
        bulanKini={tahun === tahunIni ? bulanTahunWIB().bulan : 0}
        awal={awal}
        diperbarui={diperbarui}
      />
    </>
  );
}
