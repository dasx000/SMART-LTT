import type { Metadata } from "next";
import Link from "next/link";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka, tanggalIsoWIB } from "@/lib/format";
import { KOMODITAS, desaRekapPpl, limaBulanTerakhir, rekapBulananPpl, rekapHarianPpl } from "@/lib/data";
import { FormFilter, Kartu, Kosong, Persen, Pilihan, Tabel, Tanggal, TombolUnduh, sel, selAngka } from "@/components/ui";
import { teksParam, type CariParam } from "@/lib/param";

export const metadata: Metadata = { title: "Rekap — SMART LTT" };

export default function HalamanRekapPpl({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Rekap" role={["penyuluh", "admin_bpp"]} panel={{ judul: "Rekap Saya", sub: "Rekap LTT desa", warna: "text-purple-700" }}>
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

async function Isi({ searchParams }: { searchParams: CariParam }) {
  const p = await wajibRole("penyuluh", "admin_bpp");
  const q = await searchParams;
  const s = await supabaseServer();
  const desa = await desaRekapPpl(s, p);

  const mode = teksParam(q, "mode") === "harian" ? "harian" : "bulanan";
  const sekarang = bulanTahunWIB();
  const pilihan = limaBulanTerakhir(sekarang.tahun, sekarang.bulan);
  const cakupan = p.role === "admin_bpp" ? "Semua desa di kecamatan Anda" : "Desa binaan Anda";

  const tab = (m: "bulanan" | "harian", label: string) => (
    <Link
      href={`/ppl/rekap?mode=${m}`}
      className={`flex-1 rounded-lg py-2 text-center text-xs font-bold transition-all ${mode === m ? "bg-green-600 text-white" : "text-gray-500 hover:bg-white"}`}
    >
      {label}
    </Link>
  );

  if (mode === "harian") {
    // Tanggal hanya di bulan berjalan dan tidak melewati hari ini (aturan lama §23i)
    const hariIni = tanggalIsoWIB();
    const awalBulan = `${hariIni.slice(0, 8)}01`;
    let tanggal = teksParam(q, "tanggal") ?? hariIni;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || tanggal > hariIni || tanggal < awalBulan) tanggal = hariIni;
    const rows = await rekapHarianPpl(s, desa, tanggal);

    return (
      <>
        <div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs text-gray-500">{cakupan}</p><TombolUnduh href={`/api/unduh/rekap-ppl?mode=harian&tanggal=${tanggal}`} /></div>
        <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1">{tab("bulanan", "Bulanan")}{tab("harian", "Harian")}</div>
        <FormFilter>
          <input type="hidden" name="mode" value="harian" />
          <Tanggal label="Tanggal" name="tanggal" nilai={tanggal} min={awalBulan} max={hariIni} />
        </FormFilter>
        {desa.length === 0 ? (
          <Kosong teks="Belum ada desa binaan. Hubungi Admin BPP." />
        ) : (
          <div className="space-y-4">
            {KOMODITAS.map((kom) => {
              const isi = rows.filter((r) => r.komoditas === kom);
              return (
                <Kartu key={kom} judul={kom}>
                  <Tabel
                    kepala={["Desa", "Tanam (Ha)", "Panen (Ha)", "Jml Laporan"]}
                    kaki={
                      <tr>
                        <td className={sel}>JUMLAH</td>
                        <td className={selAngka}>{formatAngka(isi.reduce((a, r) => a + r.tanam, 0))}</td>
                        <td className={selAngka}>{formatAngka(isi.reduce((a, r) => a + r.panen, 0))}</td>
                        <td className={selAngka}>{isi.reduce((a, r) => a + r.jumlah, 0)}</td>
                      </tr>
                    }
                  >
                    {isi.map((r) => (
                      <tr key={r.desa}>
                        <td className={sel}>{r.desa}</td>
                        <td className={selAngka}>{formatAngka(r.tanam)}</td>
                        <td className={selAngka}>{formatAngka(r.panen)}</td>
                        <td className={selAngka}>{r.jumlah}</td>
                      </tr>
                    ))}
                  </Tabel>
                </Kartu>
              );
            })}
          </div>
        )}
      </>
    );
  }

  // Bulanan: 5 bulan terakhir
  const kode = teksParam(q, "periode");
  const terpilih = pilihan.find((x) => `${x.tahun}-${x.bulan}` === kode) ?? pilihan[0];
  const rows = await rekapBulananPpl(s, desa, terpilih.tahun, terpilih.bulan);

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs text-gray-500">{cakupan}</p><TombolUnduh href={`/api/unduh/rekap-ppl?mode=bulanan&tahun=${terpilih.tahun}&bulan=${terpilih.bulan}`} /></div>
      <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1">{tab("bulanan", "Bulanan")}{tab("harian", "Harian")}</div>
      <FormFilter>
        <input type="hidden" name="mode" value="bulanan" />
        <Pilihan
          label="Bulan"
          name="periode"
          nilai={`${terpilih.tahun}-${terpilih.bulan}`}
          opsi={pilihan.map((x) => ({ v: `${x.tahun}-${x.bulan}`, t: `${NAMA_BULAN[x.bulan - 1]} ${x.tahun}` }))}
        />
      </FormFilter>
      {desa.length === 0 ? (
        <Kosong teks="Belum ada desa binaan. Hubungi Admin BPP." />
      ) : (
        <div className="space-y-4">
          {KOMODITAS.map((kom) => {
            const isi = rows.filter((r) => r.komoditas === kom);
            const j = (f: (r: (typeof isi)[number]) => number) => isi.reduce((a, r) => a + f(r), 0);
            return (
              <Kartu key={kom} judul={kom}>
                <Tabel
                  kepala={["Desa", ...(kom === "Padi" ? ["LBS (Ha)"] : []), "Target Tanam", "Real. Tanam", "% Tanam", "Target Panen", "Real. Panen", "% Panen"]}
                  kaki={
                    <tr>
                      <td className={sel}>JUMLAH</td>
                      {kom === "Padi" && <td className={selAngka}>{formatAngka(j((r) => r.luasBaku))}</td>}
                      <td className={selAngka}>{formatAngka(j((r) => r.targetTanam))}</td>
                      <td className={selAngka}>{formatAngka(j((r) => r.realisasiTanam))}</td>
                      <td className={`${sel} text-center`}><Persen realisasi={j((r) => r.realisasiTanam)} target={j((r) => r.targetTanam)} /></td>
                      <td className={selAngka}>{formatAngka(j((r) => r.targetPanen))}</td>
                      <td className={selAngka}>{formatAngka(j((r) => r.realisasiPanen))}</td>
                      <td className={`${sel} text-center`}><Persen realisasi={j((r) => r.realisasiPanen)} target={j((r) => r.targetPanen)} /></td>
                    </tr>
                  }
                >
                  {isi.map((r) => (
                    <tr key={r.desa}>
                      <td className={sel}>{r.desa}</td>
                      {kom === "Padi" && <td className={selAngka}>{formatAngka(r.luasBaku)}</td>}
                      <td className={selAngka}>{formatAngka(r.targetTanam)}</td>
                      <td className={selAngka}>{formatAngka(r.realisasiTanam)}</td>
                      <td className={`${sel} text-center`}><Persen realisasi={r.realisasiTanam} target={r.targetTanam} /></td>
                      <td className={selAngka}>{formatAngka(r.targetPanen)}</td>
                      <td className={selAngka}>{formatAngka(r.realisasiPanen)}</td>
                      <td className={`${sel} text-center`}><Persen realisasi={r.realisasiPanen} target={r.targetPanen} /></td>
                    </tr>
                  ))}
                </Tabel>
              </Kartu>
            );
          })}
        </div>
      )}
    </>
  );
}
