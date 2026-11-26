import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Sprout } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { SelectOtomatis } from "@/components/select-otomatis";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB } from "@/lib/format";
import { KOMODITAS, ambilTargetDesaPmAas, ambilTargetPmAasRinci, desaBinaanSaya, jenisPadi, kodePeriode, periodeDariParam, type Komoditas } from "@/lib/data";
import { teksParam, type CariParam } from "@/lib/param";
import { rekapRealisasiPpl } from "@/lib/realisasi-ppl";
import { AlertTargetPpl, LegendaRealisasi, RingkasanRealisasi, TabelDesaSaya, teksPeriodeRealisasi } from "@/components/realisasi-ppl";
import { TombolTargetPmAas } from "@/components/tombol-target-pm-aas";
import { Kosong } from "@/components/ui";

export const metadata: Metadata = { title: "Realisasi LTT — SMART LTT" };

const KELAS_SELECT =
  "cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm outline-none";

export default function HalamanRealisasiSaya({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Realisasi" role={["penyuluh", "admin_bpp"]} panel={{ judul: "Realisasi LTT", sub: "Capaian LTT desa binaan terhadap target", warna: "text-green-700" }}>
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

/**
 * Realisasi LTT (Padi / Jagung / Ubi Kayu) — akun penyuluh (dan Admin BPP mode PPL): hanya dirinya sendiri.
 * Tombol PM-AAS (keputusan user 26 Nov 2026): hanya Padi, hanya bila kecamatan desa binaan punya target
 * PM-AAS kecamatan bulan itu. Aktif → target & realisasi khusus PM-AAS, target diisi lewat modal di tabel.
 */
async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("penyuluh", "admin_bpp");
  const q = await searchParams;
  const per = periodeDariParam(teksParam(q, "periode"), bulanTahunWIB());
  const kom = ((KOMODITAS as string[]).includes(teksParam(q, "komoditas") ?? "") ? teksParam(q, "komoditas") : "Padi") as Komoditas;
  const s = await supabaseServer();

  const [binaan, tgtKec] = await Promise.all([
    desaBinaanSaya(s, p.id),
    kom === "Padi" ? ambilTargetPmAasRinci(s, per.tahun, per.bulan) : Promise.resolve(null),
  ]);
  const bolehPmAas = Boolean(tgtKec && binaan.some((d) => tgtKec.perKec.has(d.kecamatan_id)));
  const pmAas = bolehPmAas && teksParam(q, "metode") === "pmaas";

  const [d, jenis, tgtPmAas] = await Promise.all([
    rekapRealisasiPpl(s, { tahun: per.tahun, bulan: per.bulan, userId: p.id, komoditas: kom, pmAas }),
    pmAas ? jenisPadi(s) : Promise.resolve([]),
    pmAas ? ambilTargetDesaPmAas(s, binaan.map((x) => x.id), per) : Promise.resolve([]),
  ]);
  const saya = d.kec[0]?.ppl[0] ?? null;
  const namaKec = d.kec[0]?.nama ?? "";
  const awalPmAas = new Map(tgtPmAas.map((t) => [t.desaId, t]));

  const periode = kodePeriode(per);
  const hrefPmAas = `/ppl/realisasi?komoditas=Padi&periode=${periode}${pmAas ? "" : "&metode=pmaas"}`;

  return (
    <div className="space-y-4">
      <Form action="/ppl/realisasi" scroll={false} className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">Kumulatif {teksPeriodeRealisasi(d)}</p>
        <div className="flex items-center gap-2">
          {pmAas && <input type="hidden" name="metode" value="pmaas" />}
          {bolehPmAas && (
            <Link
              href={hrefPmAas}
              scroll={false}
              aria-pressed={pmAas}
              title={pmAas ? "Tampilkan semua metode" : "Tampilkan khusus PM-AAS"}
              className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-extrabold shadow-sm transition active:scale-95 ${pmAas ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700" : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"}`}
            >
              <Sprout size={13} aria-hidden /> PM-AAS
            </Link>
          )}
          <SelectOtomatis key={kom} name="komoditas" defaultValue={kom} aria-label="Komoditas" className={KELAS_SELECT}>
            {KOMODITAS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </SelectOtomatis>
          <SelectOtomatis key={periode} name="periode" defaultValue={periode} aria-label="Periode" className={KELAS_SELECT}>
            {per.pilihan.slice(0, 6).map((x) => (
              <option key={kodePeriode(x)} value={kodePeriode(x)}>{NAMA_BULAN[x.bulan - 1]} {x.tahun}</option>
            ))}
          </SelectOtomatis>
        </div>
      </Form>

      {!saya ? (
        <Kosong teks="Belum ada desa binaan. Hubungi Admin BPP." />
      ) : (
        <>
          {pmAas ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
              <b>Filter PM-AAS aktif.</b> Target dan realisasi hanya padi metode PM-AAS. Desa yang belum ada target PM-AAS: klik <b>Isi Target</b> di tabel.
            </p>
          ) : (
            <AlertTargetPpl p={saya} href={`/ppl/target?tahun=${per.tahun}&bulan=${per.bulan}&komoditas=${encodeURIComponent(kom)}`} />
          )}
          <RingkasanRealisasi d={d} lingkup="Desa binaan Anda" saya={saya} komoditas={kom} pmAas={pmAas} />
          <TabelDesaSaya
            p={saya}
            aksi={
              pmAas
                ? (x) => (
                    <TombolTargetPmAas
                      desa={{ id: x.id, nama: x.nama, kecamatan: namaKec }}
                      jenis={jenis}
                      tahun={per.tahun}
                      bulan={per.bulan}
                      awal={awalPmAas.get(x.id) ?? null}
                    />
                  )
                : undefined
            }
          />
          <LegendaRealisasi />
        </>
      )}
    </div>
  );
}
