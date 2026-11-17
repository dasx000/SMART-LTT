import { KOLOM_PROV, type rekapProvinsiPadi } from "@/lib/data";
import { NAMA_BULAN, formatAngka } from "@/lib/format";
import { TombolUnduh } from "@/components/tombol-unduh";

type Data = Awaited<ReturnType<typeof rekapProvinsiPadi>>;

export { LEGENDA, levelPersen } from "@/lib/warna-persen";
import { LEGENDA, levelPersen } from "@/lib/warna-persen";

/** Kotak warna legenda persentase (dipakai juga di halaman LTT PM AAS). */
export function KotakLegendaPersen() {
  return (
    <div className="mb-2 flex flex-wrap gap-x-5 gap-y-2">
      {LEGENDA.map((l) => (
        <span key={l.label} className="flex items-center gap-2">
          <span className={`inline-block h-5 w-10 rounded ${l.kelas}`} />
          <span><b>{l.label}</b> — {l.arti}</span>
        </span>
      ))}
      <span className="flex items-center gap-2">
        <span className="inline-block h-5 w-10 rounded border border-gray-200 bg-gray-50 text-center leading-5 text-gray-400">-</span>
        <span>Target belum diisi</span>
      </span>
    </div>
  );
}

/** Angka; 0 ditulis abu-abu tipis supaya yang berisi menonjol. */
function N({ n }: { n: number }) {
  return n ? <>{formatAngka(n)}</> : <span className="font-normal text-gray-300">0</span>;
}

function Persen({ p, adaTarget, tebal }: { p: number; adaTarget: boolean; tebal?: boolean }) {
  if (!adaTarget) return <td className="border border-gray-100 bg-gray-50 p-2 text-center text-gray-400">-</td>;
  return (
    <td className={`border border-gray-100 p-2 text-right ${tebal ? "font-extrabold" : "font-bold"} ${levelPersen(p).kelas}`}>
      {formatAngka(p)}
    </td>
  );
}

/** Tabel LTT Padi format laporan Provinsi: realisasi hari ini + kumulatif 1 s.d hari ini per kecamatan. */
export function TabelLttProvinsi({ data }: { data: Data }) {
  const tgl = Number(data.akhir.slice(8, 10));
  const namaBulan = NAMA_BULAN[data.bulan - 1];
  const hariIniTeks = `${tgl} ${namaBulan} ${data.tahun}`;
  const sd = `1 s.d ${hariIniTeks}`;
  const th = "border border-gray-200 p-2";
  const td = "border border-gray-100 p-2 text-right";
  // Hanya kolom Kecamatan yang tetap terlihat saat tabel digeser; No ikut bergeser
  // supaya ruang untuk kolom angka lebih lega di layar sempit.
  const lekatNo = "w-10 min-w-10";
  const lekatKec = "sticky left-0 z-10 shadow-[2px_0_0_0_#f3f4f6]";

  return (
    <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:mb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Laporan LTT Padi (Format Provinsi)</h3>
          <p className="text-[11px] text-gray-400">
            Realisasi {data.bulanBerjalan ? "hari ini" : "tanggal terakhir"} ({hariIniTeks}) dan kumulatif {sd}
          </p>
        </div>
        <TombolUnduh
          href={`/api/unduh/ltt-provinsi?tahun=${data.tahun}&bulan=${data.bulan}`}
          className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-xs font-bold text-white hover:bg-green-800"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1150px] border-collapse text-xs">
          <thead className="text-[10px] font-bold text-gray-600 uppercase">
            <tr>
              <th rowSpan={2} className={`${th} ${lekatNo} bg-gray-50`}>No</th>
              <th rowSpan={2} className={`${th} ${lekatKec} bg-gray-50 text-left`}>Kecamatan</th>
              <th rowSpan={2} className={`${th} bg-gray-50`}>Target LTT Bulan {namaBulan} {data.tahun}</th>
              <th colSpan={KOLOM_PROV.length + 1} className={`${th} bg-blue-100 text-blue-900`}>Realisasi LTT {hariIniTeks}</th>
              <th rowSpan={2} className={`${th} bg-violet-100 text-violet-900`}>Total LTT PM-AAS {sd}</th>
              <th rowSpan={2} className={`${th} bg-orange-100 text-orange-900`}>Total LTT {sd}</th>
              <th rowSpan={2} className={`${th} bg-orange-100 text-orange-900`}>Persentase Total LTT {sd}</th>
            </tr>
            <tr>
              {KOLOM_PROV.map((k) => (
                <th key={k.kunci} className={`${th} bg-blue-50 text-blue-900`}>{k.label}</th>
              ))}
              <th className={`${th} bg-blue-50 text-blue-900`}>Total LTT</th>
            </tr>
            <tr className="bg-yellow-50 text-[11px] font-bold text-yellow-800">
              <td className="border border-gray-100 bg-yellow-50 p-2" />
              <td className={`${lekatKec} border border-gray-100 bg-yellow-50 p-2 text-left uppercase`}>Jumlah</td>
              <td className={td}><N n={data.total.target} /></td>
              {KOLOM_PROV.map((k) => (
                <td key={k.kunci} className={td}><N n={data.total.hariIni[k.kunci]} /></td>
              ))}
              <td className={td}><N n={data.total.hariIni.total} /></td>
              <td className={td}><N n={data.total.kumulatifPmAas} /></td>
              <td className={td}><N n={data.total.kumulatif} /></td>
              <Persen p={data.total.persen} adaTarget={data.total.target > 0} tebal />
            </tr>
          </thead>
          <tbody className="text-gray-800">
            {data.baris.map((b, i) => (
              <tr key={b.kecamatan} className="group">
                <td className={`${lekatNo} border border-gray-100 bg-white p-2 text-center text-gray-500 group-hover:bg-gray-50`}>{i + 1}</td>
                <td className={`${lekatKec} border border-gray-100 bg-white p-2 font-semibold whitespace-nowrap text-gray-700 group-hover:bg-gray-50`}>{b.kecamatan}</td>
                <td className={`${td} group-hover:bg-gray-50`}>{b.target > 0 ? formatAngka(b.target) : <span className="text-gray-400">-</span>}</td>
                {KOLOM_PROV.map((k) => (
                  <td key={k.kunci} className={`${td} group-hover:bg-gray-50`}><N n={b.hariIni[k.kunci]} /></td>
                ))}
                <td className={`${td} bg-blue-50/50 font-semibold`}><N n={b.hariIni.total} /></td>
                <td className={`${td} bg-violet-50/60`}><N n={b.kumulatifPmAas} /></td>
                <td className={`${td} bg-orange-50/60 font-semibold`}><N n={b.kumulatif} /></td>
                <Persen p={b.persen} adaTarget={b.target > 0} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3 text-[11px] text-gray-600">
        <p className="mb-2 font-bold text-gray-700">Keterangan</p>
        <KotakLegendaPersen />
        <ul className="list-disc space-y-0.5 pl-4">
          <li>Kolom <b>Realisasi LTT {hariIniTeks}</b> hanya berisi laporan tanggal {hariIniTeks}{data.bulanBerjalan ? " (hari ini)" : " (tanggal terakhir bulan ini)"}.</li>
          <li><b>Total LTT PM-AAS</b> dan <b>Total LTT</b> = akumulasi tanggal {sd}.</li>
          <li><b>Persentase</b> = Total LTT {sd} ÷ Target LTT bulan {namaBulan} × 100%.</li>
          <li>Hanya jenis yang tampil di tabel yang dihitung; Oplah 2024/2025 (non PM-AAS), CSR, dan Rehab Bencana tidak dihitung.</li>
          <li>Angka <span className="text-gray-300">0</span> ditulis samar agar data yang berisi lebih mudah terlihat.</li>
        </ul>
      </div>
    </div>
  );
}
