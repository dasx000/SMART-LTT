import Link from "next/link";
import { Filter, FileSpreadsheet, FileUp, ListChecks, Pencil, Search, SearchCheck, Sprout, Wheat, X } from "lucide-react";
import { TombolMuatUlang } from "@/components/tombol-muat-ulang";
import { TombolUnduh } from "@/components/tombol-unduh";
import { formatAngka, formatTanggal } from "@/lib/format";
import { KOMODITAS, type BarisLaporan, type DesaRef, type Kec } from "@/lib/data";
import { urlDengan } from "@/lib/param";
import { TombolHapus } from "./tombol-hapus";

const kelasIn = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-green-500";
const lbl = "mb-1 block text-[10px] font-bold tracking-wide text-gray-400 uppercase";
const BADGE: Record<string, string> = {
  Padi: "bg-blue-50 text-blue-700 border-blue-100",
  Jagung: "bg-yellow-50 text-yellow-700 border-yellow-100",
  "Ubi Kayu": "bg-orange-50 text-orange-700 border-orange-100",
};
export const PILIHAN_PER = [10, 25, 50, 100];

/**
 * Laporan LTT (Kab & BPP) — tata letak aplikasi lama (menu Laporan LTT):
 * kartu filter, 4 kartu ringkasan, cari + jumlah per halaman, tabel lengkap.
 * Filter/cari/halaman/edit semuanya di URL dan diproses di server (hanya satu halaman dikirim).
 */
export function DaftarLaporan({
  dasar, q, baris, total, ringkas, hal, per, dari, sampai, hariIni, kecs, desaPilihan, kecamatanTerkunci, unduh, impor, aksiHapus,
}: {
  dasar: string;
  q: Record<string, string | string[] | undefined>;
  baris: BarisLaporan[];
  total: number;
  ringkas: { jumlah: number; tanam: number; panen: number };
  hal: number;
  per: number;
  dari: string;
  sampai: string;
  /** Batas atas pilihan tanggal (YYYY-MM-DD, WIB). */
  hariIni: string;
  kecs: Kec[];
  /** desa untuk pilihan filter (kecamatan terpilih / kecamatan BPP) */
  desaPilihan: DesaRef[];
  /** BPP: kecamatan dikunci (pilihan kecamatan disembunyikan) */
  kecamatanTerkunci: boolean;
  unduh: string;
  /** Admin Kab: tautan jendela Impor Excel e-Pusluh (?impor=1) */
  impor?: string;
  /** Tanpa ini tombol hapus tidak ditampilkan (mis. Admin BPP hanya boleh ubah). */
  aksiHapus?: (id: number) => Promise<{ sukses: boolean; pesan: string }>;
}) {
  const ambil = (k: string) => {
    const v = q[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const jmlHal = Math.max(1, Math.ceil(total / per));
  const adaCari = Boolean(ambil("q"));

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Laporan LTT</h2>
          <p className="text-sm text-gray-500">Data lengkap laporan Padi, Jagung &amp; Ubi Kayu dari seluruh PPL</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {impor && (
            <Link href={impor} scroll={false} className="flex items-center gap-2 rounded-xl border border-green-200 bg-white px-4 py-2.5 text-sm font-bold text-green-700 shadow-sm hover:bg-green-50">
              <FileUp size={16} /> Impor Excel
            </Link>
          )}
          <TombolUnduh href={unduh} ikon={<FileSpreadsheet size={16} />} className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-green-700" />
          <TombolMuatUlang href={urlDengan(dasar, q, { edit: null })} label="Refresh" ukuran={16} className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-600 hover:bg-blue-100" />
        </div>
      </div>

      {/* Kartu filter (GET → URL) */}
      <form method="get" className="mb-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <label>
            <span className={lbl}>Dari Tanggal</span>
            <input type="date" name="dari" defaultValue={dari} max={hariIni} className={kelasIn} />
          </label>
          <label>
            <span className={lbl}>Sampai Tanggal</span>
            <input type="date" name="sampai" defaultValue={sampai} max={hariIni} className={kelasIn} />
          </label>
          <label>
            <span className={lbl}>Komoditas</span>
            <select name="komoditas" defaultValue={ambil("komoditas")} className={kelasIn}>
              <option value="">Semua Komoditas</option>
              {KOMODITAS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            <span className={lbl}>Metode Penanaman</span>
            <select name="metode" defaultValue={ambil("metode")} className={kelasIn}>
              <option value="">Semua Metode</option>
              <option value="Regular">Regular</option>
              <option value="PM AAS">PM AAS</option>
            </select>
          </label>
          {!kecamatanTerkunci && (
            <label>
              <span className={lbl}>Kecamatan</span>
              <select name="kecamatan" defaultValue={ambil("kecamatan")} className={kelasIn}>
                <option value="">Semua Kecamatan</option>
                {kecs.map((k) => (
                  <option key={k.id} value={k.id}>{k.nama}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span className={lbl}>Desa</span>
            <select name="desa" defaultValue={ambil("desa")} disabled={desaPilihan.length === 0} className={`${kelasIn} disabled:bg-gray-50 disabled:text-gray-400`}>
              <option value="">{desaPilihan.length ? "Semua Desa" : "— Pilih Kecamatan dulu —"}</option>
              {desaPilihan.map((d) => (
                <option key={d.id} value={d.id}>{d.nama}</option>
              ))}
            </select>
          </label>
        </div>
        {ambil("q") && <input type="hidden" name="q" value={ambil("q")} />}
        {ambil("per") && <input type="hidden" name="per" value={ambil("per")} />}
        <div className="mt-3 flex gap-2">
          <button type="submit" className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700">
            <Filter size={14} /> Terapkan Filter
          </button>
          <Link href={dasar} className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200">
            <X size={14} /> Reset
          </Link>
        </div>
      </form>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Data", nilai: formatAngka(ringkas.jumlah, 0), ikon: <ListChecks size={18} />, warna: "bg-blue-50 text-blue-600" },
          { label: "Total Tanam", nilai: `${formatAngka(ringkas.tanam)} Ha`, ikon: <Sprout size={18} />, warna: "bg-green-50 text-green-600" },
          { label: "Total Panen", nilai: `${formatAngka(ringkas.panen)} Ha`, ikon: <Wheat size={18} />, warna: "bg-yellow-50 text-yellow-600" },
          { label: "Hasil Pencarian", nilai: formatAngka(adaCari ? total : ringkas.jumlah, 0), ikon: <SearchCheck size={18} />, warna: "bg-purple-50 text-purple-600" },
        ].map((k) => (
          <div key={k.label} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${k.warna}`}>{k.ikon}</div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">{k.label}</p>
              <p className="text-lg font-bold text-gray-800">{k.nilai}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Cari + jumlah per halaman (GET, filter lain dipertahankan) */}
      <form method="get" className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {["dari", "sampai", "komoditas", "metode", "kecamatan", "desa"].map((k) => (ambil(k) ? <input key={k} type="hidden" name={k} value={ambil(k)} /> : null))}
        <div className="relative w-full max-w-sm">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-gray-400" />
          <input name="q" defaultValue={ambil("q")} placeholder="Cari penyuluh, kecamatan, desa..." className="w-full rounded-xl border border-gray-200 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-green-500" />
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          Tampilkan:
          <select name="per" defaultValue={String(per)} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm font-bold">
            {PILIHAN_PER.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          data per halaman
          <button type="submit" className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white">Cari</button>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                <th className="p-3 text-left">No</th>
                <th className="p-3 text-left">Tanggal Laporan</th>
                <th className="p-3 text-left">Nama Penyuluh</th>
                <th className="p-3 text-left">Kecamatan</th>
                <th className="p-3 text-left">Desa</th>
                <th className="p-3 text-left">Komoditas</th>
                <th className="p-3 text-left">Jenis LTT</th>
                <th className="p-3 text-left">Metode Penanaman</th>
                <th className="p-3 text-right">Bera (Ha)</th>
                <th className="p-3 text-right">Olah (Ha)</th>
                <th className="p-3 text-right">Tanam (Ha)</th>
                <th className="p-3 text-right">Panen (Ha)</th>
                <th className="p-3 text-left">Keterangan</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {baris.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-8 text-center text-gray-500">
                    Tidak ada laporan yang sesuai filter.
                    {hal > 1 && (
                      <Link href={urlDengan(dasar, q, { hal: null })} className="ml-1 font-bold text-green-700 underline">
                        Kembali ke halaman 1
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                baris.map((l, i) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-400">{(hal - 1) * per + i + 1}</td>
                    <td className="p-3 whitespace-nowrap text-gray-600">{formatTanggal(l.waktu)}</td>
                    <td className="p-3 font-bold text-gray-800 uppercase">{l.pelapor}</td>
                    <td className="p-3 text-gray-600">{l.kecamatan}</td>
                    <td className="p-3 text-gray-600">{l.desa}</td>
                    <td className="p-3">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${BADGE[l.komoditas]}`}>{l.komoditas}</span>
                    </td>
                    <td className="p-3 text-gray-600">{l.jenis ?? "-"}</td>
                    <td className="p-3 text-gray-600">{l.metode ?? "-"}</td>
                    <Angka n={l.bera} />
                    <Angka n={l.olah} />
                    <Angka n={l.tanam} warna="text-blue-600" />
                    <Angka n={l.panen} warna="text-amber-600" />
                    <td className="max-w-[160px] truncate p-3 text-gray-500" title={l.keterangan ?? ""}>{l.keterangan ?? "-"}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          href={urlDengan(dasar, q, { edit: l.id })}
                          scroll={false}
                          title="Edit Laporan"
                          className="rounded-lg bg-blue-50 p-1.5 text-blue-600 transition hover:bg-blue-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        {aksiHapus && <TombolHapus id={l.id} aksi={aksiHapus} />}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 p-3 text-xs text-gray-500">
          <span>
            Menampilkan {baris.length ? (hal - 1) * per + 1 : 0}–{(hal - 1) * per + baris.length} dari {formatAngka(total, 0)} data
          </span>
          {jmlHal > 1 && (
            <nav className="flex items-center gap-2 font-bold" aria-label="Halaman">
              {hal > 1 && (
                <Link href={urlDengan(dasar, q, { hal: hal - 1, edit: null })} className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50">‹</Link>
              )}
              <span>{hal} / {jmlHal}</span>
              {hal < jmlHal && (
                <Link href={urlDengan(dasar, q, { hal: hal + 1, edit: null })} className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50">›</Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </>
  );
}

function Angka({ n, warna = "text-gray-700" }: { n: number; warna?: string }) {
  return <td className={`p-3 text-right ${n ? `font-bold ${warna}` : "text-gray-300"}`}>{n ? formatAngka(n) : "—"}</td>;
}
