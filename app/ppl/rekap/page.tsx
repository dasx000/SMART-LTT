import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KepalaPanel, KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka, tanggalIsoWIB } from "@/lib/format";
import { KOMODITAS, desaRekapPpl, limaBulanTerakhir, rekapBulananPpl, rekapHarianPpl } from "@/lib/data";
import { Kosong, TombolUnduh } from "@/components/ui";
import { SelectOtomatis } from "@/components/select-otomatis";
import { TanggalOtomatis } from "@/components/tanggal-otomatis";
import { teksParam, type CariParam } from "@/lib/param";

export const metadata: Metadata = { title: "Rekap Laporan Saya — SMART LTT" };

export default function HalamanRekapPpl({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Rekap" role={["penyuluh", "admin_bpp"]}>
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

// ─── Gaya tabel (mengikuti aplikasi lama File_HTML_PPL.html) ───
const th = "border-r border-green-800/40 p-2 text-[9px] font-bold tracking-wider text-white uppercase last:border-r-0";
const td = "p-2 text-[11px]";
const kelasInput = "h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700 outline-none focus:border-green-500";
const kelasExcel = "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-green-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-green-700 active:scale-95";
const strip = <span className="text-gray-300">—</span>;

/** Angka; 0 → "—" (untuk target/LBS yang belum diisi). */
const angkaAtauStrip = (n: number) => (n ? formatAngka(n) : strip);

function Capaian({ realisasi, target }: { realisasi: number; target: number }) {
  if (target <= 0) return strip;
  const p = (realisasi / target) * 100;
  const w = p >= 85 ? "text-green-600" : p >= 60 ? "text-amber-500" : "text-red-500";
  return <b className={w}>{formatAngka(p)}%</b>;
}

function BarisKomoditas({ kom, kolom }: { kom: string; kolom: number }) {
  return (
    <tr className="bg-green-50/70">
      <td colSpan={kolom} className="px-2 py-2 text-[10px] font-extrabold tracking-wide text-green-800 uppercase">Komoditas: {kom}</td>
    </tr>
  );
}

async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("penyuluh", "admin_bpp");
  const q = await searchParams;
  const s = await supabaseServer();
  const desa = await desaRekapPpl(s, p);

  const mode = teksParam(q, "mode") === "bulanan" ? "bulanan" : "harian";
  const sekarang = bulanTahunWIB();
  const pilihan = limaBulanTerakhir(sekarang.tahun, sekarang.bulan);

  const tab = (m: "harian" | "bulanan", label: string) => (
    <Link
      href={`/ppl/rekap?mode=${m}`}
      className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition-all ${mode === m ? "bg-green-600 text-white shadow-sm" : "text-gray-500 hover:bg-white"}`}
    >
      {label}
    </Link>
  );

  const kepala = (
    <>
      <KepalaPanel judul="Rekap Laporan Saya" sub={p.nama} />
      <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1">
        {tab("harian", "Per Hari")}
        {tab("bulanan", "Per Bulan")}
      </div>
    </>
  );

  if (desa.length === 0) {
    return (
      <div className="px-5 pt-6 pb-20">
        {kepala}
        <Kosong teks="Belum ada desa binaan. Hubungi Admin BPP." />
      </div>
    );
  }

  // ─── Per Hari: tanggal hanya di bulan berjalan dan tidak melewati hari ini (aturan lama §23i) ───
  if (mode === "harian") {
    const hariIni = tanggalIsoWIB();
    const awalBulan = `${hariIni.slice(0, 8)}01`;
    let tanggal = teksParam(q, "tanggal") ?? hariIni;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || tanggal > hariIni || tanggal < awalBulan) tanggal = hariIni;
    const rows = await rekapHarianPpl(s, desa, tanggal);

    return (
      <div className="px-5 pt-6 pb-20">
        {kepala}
        <form method="get" action="/ppl/rekap" className="mb-4">
          <input type="hidden" name="mode" value="harian" />
          <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">Pilih Tanggal</label>
          <div className="flex items-center gap-2">
            <TanggalOtomatis name="tanggal" defaultValue={tanggal} min={awalBulan} max={hariIni} className={kelasInput} />
            <TombolUnduh href={`/api/unduh/rekap-ppl?mode=harian&tanggal=${tanggal}`} label="Excel" ikon={<FileSpreadsheet size={14} />} className={kelasExcel} />
          </div>
        </form>

        <div className="overflow-hidden rounded-xl border border-green-700/30 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-green-700">
                  <th className={`${th} w-14 text-center`}>No</th>
                  <th className={`${th} text-left`}>Kampung</th>
                  <th className={`${th} text-center`}>Luas Tanam (Ha)</th>
                  <th className={`${th} text-center`}>Luas Panen (Ha)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {KOMODITAS.flatMap((kom) => {
                  const isi = rows.filter((r) => r.komoditas === kom);
                  return [
                    <BarisKomoditas key={`k-${kom}`} kom={kom} kolom={4} />,
                    ...isi.map((r, i) => (
                      <tr key={`${kom}-${r.desa}`} className="hover:bg-gray-50">
                        <td className={`${td} text-center text-gray-500`}>{i + 1}</td>
                        <td className={`${td} text-gray-800`}>{r.desa}</td>
                        <td className={`${td} text-center text-green-700`}>{formatAngka(r.tanam)}</td>
                        <td className={`${td} text-center text-blue-600`}>{formatAngka(r.panen)}</td>
                      </tr>
                    )),
                    <tr key={`j-${kom}`} className="bg-green-50/40 font-bold">
                      <td className={`${td} text-center text-gray-400`}>—</td>
                      <td className={`${td} text-green-800`}>JUMLAH</td>
                      <td className={`${td} text-center text-green-700`}>{formatAngka(isi.reduce((a, r) => a + r.tanam, 0))}</td>
                      <td className={`${td} text-center text-blue-600`}>{formatAngka(isi.reduce((a, r) => a + r.panen, 0))}</td>
                    </tr>,
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ─── Per Bulan: 5 bulan terakhir ───
  const kode = teksParam(q, "periode");
  const terpilih = pilihan.find((x) => `${x.tahun}-${x.bulan}` === kode) ?? pilihan[0];
  const rows = await rekapBulananPpl(s, desa, terpilih.tahun, terpilih.bulan);

  return (
    <div className="px-5 pt-6 pb-20">
      {kepala}
      <form method="get" action="/ppl/rekap" className="mb-4">
        <input type="hidden" name="mode" value="bulanan" />
        <label className="mb-1 block text-[10px] font-bold text-gray-400 uppercase">Pilih Periode</label>
        <div className="flex items-center gap-2">
          <SelectOtomatis key={`${terpilih.tahun}-${terpilih.bulan}`} name="periode" defaultValue={`${terpilih.tahun}-${terpilih.bulan}`} className={`${kelasInput} cursor-pointer`}>
            {pilihan.map((x) => (
              <option key={`${x.tahun}-${x.bulan}`} value={`${x.tahun}-${x.bulan}`}>{NAMA_BULAN[x.bulan - 1]} {x.tahun}</option>
            ))}
          </SelectOtomatis>
          <TombolUnduh
            href={`/api/unduh/rekap-ppl?mode=bulanan&tahun=${terpilih.tahun}&bulan=${terpilih.bulan}`}
            label="Excel"
            ikon={<FileSpreadsheet size={14} />}
            className={kelasExcel}
          />
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-green-700/30 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="bg-green-700">
                <th className={`${th} text-center`}>No</th>
                <th className={`${th} text-left`}>Kampung</th>
                <th className={`${th} text-left`}>Komoditas</th>
                <th className={`${th} text-right`}>LBS (Ha)</th>
                <th className={`${th} text-center`}>Standing Crop</th>
                <th className={`${th} text-right`}>Target Tanam</th>
                <th className={`${th} text-right`}>Realisasi Tanam</th>
                <th className={`${th} text-right`}>Capaian Tanam (%)</th>
                <th className={`${th} text-center`}>Bera</th>
                <th className={`${th} text-right`}>Target Panen</th>
                <th className={`${th} text-right`}>Realisasi Panen</th>
                <th className={`${th} text-right`}>Capaian Panen (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {KOMODITAS.flatMap((kom) => {
                const isi = rows.filter((r) => r.komoditas === kom);
                const j = (f: (r: (typeof isi)[number]) => number) => isi.reduce((a, r) => a + f(r), 0);
                const padi = kom === "Padi";
                return [
                  <BarisKomoditas key={`k-${kom}`} kom={kom} kolom={12} />,
                  ...isi.map((r, i) => (
                    <tr key={`${kom}-${r.desa}`} className="hover:bg-gray-50">
                      <td className={`${td} text-center text-gray-500`}>{i + 1}</td>
                      <td className={`${td} font-semibold text-gray-800`}>{r.desa}</td>
                      <td className={`${td} text-gray-600`}>{kom}</td>
                      <td className={`${td} text-right`}>{padi ? angkaAtauStrip(r.luasBaku) : strip}</td>
                      {/* Standing crop belum ada datanya → selalu 0 */}
                      <td className={`${td} text-center text-gray-700`}>0,00</td>
                      <td className={`${td} text-right`}>{angkaAtauStrip(r.targetTanam)}</td>
                      <td className={`${td} text-right text-green-700`}>{formatAngka(r.realisasiTanam)}</td>
                      <td className={`${td} text-right`}><Capaian realisasi={r.realisasiTanam} target={r.targetTanam} /></td>
                      <td className={`${td} text-center`}>{strip}</td>
                      <td className={`${td} text-right`}>{angkaAtauStrip(r.targetPanen)}</td>
                      <td className={`${td} text-right text-blue-600`}>{formatAngka(r.realisasiPanen)}</td>
                      <td className={`${td} text-right`}><Capaian realisasi={r.realisasiPanen} target={r.targetPanen} /></td>
                    </tr>
                  )),
                  <tr key={`j-${kom}`} className="bg-green-50/40 font-bold">
                    <td className={`${td} text-center text-gray-400`}>—</td>
                    <td className={`${td} text-green-800`}>JUMLAH</td>
                    <td className={`${td} text-green-800`}>{kom}</td>
                    <td className={`${td} text-right`}>{padi ? angkaAtauStrip(j((r) => r.luasBaku)) : strip}</td>
                    <td className={`${td} text-center text-gray-700`}>0,00</td>
                    <td className={`${td} text-right`}>{angkaAtauStrip(j((r) => r.targetTanam))}</td>
                    <td className={`${td} text-right text-green-700`}>{formatAngka(j((r) => r.realisasiTanam))}</td>
                    <td className={`${td} text-right`}><Capaian realisasi={j((r) => r.realisasiTanam)} target={j((r) => r.targetTanam)} /></td>
                    <td className={`${td} text-center`}>{strip}</td>
                    <td className={`${td} text-right`}>{angkaAtauStrip(j((r) => r.targetPanen))}</td>
                    <td className={`${td} text-right text-blue-600`}>{formatAngka(j((r) => r.realisasiPanen))}</td>
                    <td className={`${td} text-right`}><Capaian realisasi={j((r) => r.realisasiPanen)} target={j((r) => r.targetPanen)} /></td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
