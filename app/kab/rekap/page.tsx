import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka, tanggalIsoWIB } from "@/lib/format";
import { KOMODITAS, ambilLaporan, daftarKecamatan, jenisPadi, laporanBulan, rekapDinas, rekapPerKecamatan, type Komoditas } from "@/lib/data";
import { JudulHalaman, Kartu, Pilihan, Tabel, Tanggal, TombolUnduh, kelasTombol, sel, selAngka } from "@/components/ui";
import { angkaParam, teksParam, type CariParam } from "@/lib/param";

export const metadata: Metadata = { title: "Rekap — SMART LTT" };

export default function HalamanRekapKab({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="SMART LTT · Rekap" role={["admin_kab"]}>
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

const tglOk = (v: string | null, def: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : def);

async function Isi({ searchParams }: { searchParams: CariParam }) {
  await wajibRole("admin_kab");
  const q = await searchParams;
  const hariIni = tanggalIsoWIB();
  const now = bulanTahunWIB();

  // Bagian 1: rekap per kecamatan (rentang tanggal)
  const dari = tglOk(teksParam(q, "dari"), hariIni);
  const sampaiMentah = tglOk(teksParam(q, "sampai"), dari);
  const sampai = sampaiMentah < dari ? dari : sampaiMentah;
  const kom = ((KOMODITAS as string[]).includes(teksParam(q, "komoditas") ?? "") ? teksParam(q, "komoditas") : "Padi") as Komoditas;
  const jenisLtt = kom === "Padi" ? teksParam(q, "jenisLtt") : null;

  // Bagian 2: rekap format Dinas (bulan)
  const bulan = angkaParam(q, "bulan", 1, 12, now.bulan);
  const tahun = angkaParam(q, "tahun", 2020, now.tahun, now.tahun);

  const s = await supabaseServer();
  const kecs = await daftarKecamatan(s);
  const akhir = new Date(`${sampai}T00:00:00+07:00`);
  akhir.setUTCDate(akhir.getUTCDate() + 1);
  const [jenis, lapRentang, lapBulan] = await Promise.all([
    jenisPadi(s),
    ambilLaporan(s, { dari: `${dari}T00:00:00+07:00`, sampai: `${tanggalIsoWIB(akhir)}T00:00:00+07:00`, komoditas: kom }, kecs),
    laporanBulan(s, tahun, bulan, kecs),
  ]);
  const r1 = rekapPerKecamatan(kecs, lapRentang, kom, jenisLtt);
  const dinas = rekapDinas(kecs, lapBulan);
  const tot = (f: (b: (typeof dinas)[number]) => number) => dinas.reduce((a, b) => a + f(b), 0);

  const tersembunyi1 = (
    <>
      <input type="hidden" name="bulan" value={bulan} />
      <input type="hidden" name="tahun" value={tahun} />
    </>
  );
  const tersembunyi2 = (
    <>
      <input type="hidden" name="dari" value={dari} />
      <input type="hidden" name="sampai" value={sampai} />
      <input type="hidden" name="komoditas" value={kom} />
      {jenisLtt && <input type="hidden" name="jenisLtt" value={jenisLtt} />}
    </>
  );
  const qs1 = new URLSearchParams({ dari, sampai, komoditas: kom, ...(jenisLtt ? { jenisLtt } : {}) }).toString();
  const formKelas = "mb-3 flex flex-wrap items-end gap-2";

  return (
    <>
      <JudulHalaman judul="Rekap Kabupaten" sub="Semua laporan dihitung (fitur verifikasi sudah dihapus)." />

      <Kartu judul={`Rekap ${kom} per Kecamatan`} aksi={<TombolUnduh href={`/api/unduh/rekap-kecamatan?${qs1}`} />} className="mb-4">
        <form method="get" className={formKelas}>
          {tersembunyi1}
          <Tanggal label="Dari" name="dari" nilai={dari} max={hariIni} />
          <Tanggal label="Sampai" name="sampai" nilai={sampai} max={hariIni} />
          <Pilihan label="Komoditas" name="komoditas" nilai={kom} opsi={KOMODITAS.map((k) => ({ v: k, t: k }))} />
          <Pilihan label="Jenis LTT (padi)" name="jenisLtt" nilai={jenisLtt ?? ""} opsi={[{ v: "", t: "Semua" }, ...jenis.map((j) => ({ v: j.nama, t: j.nama }))]} />
          <button className={kelasTombol}>Tampilkan</button>
        </form>
        <Tabel
          kepala={kom === "Padi" ? ["Kecamatan", "Jenis LTT", "Tanam (Ha)", "Panen (Ha)"] : ["Kecamatan", "Tanam (Ha)", "Panen (Ha)"]}
          kaki={
            <tr>
              <td className={sel} colSpan={kom === "Padi" ? 2 : 1}>TOTAL KABUPATEN</td>
              <td className={selAngka}>{formatAngka(r1.totalTanam)}</td>
              <td className={selAngka}>{formatAngka(r1.totalPanen)}</td>
            </tr>
          }
        >
          {r1.baris.map((b, i) => (
            <tr key={i}>
              <td className={sel}>{b.kecamatan}</td>
              {kom === "Padi" && <td className={sel}>{b.jenis}</td>}
              <td className={selAngka}>{formatAngka(b.tanam)}</td>
              <td className={selAngka}>{formatAngka(b.panen)}</td>
            </tr>
          ))}
        </Tabel>
      </Kartu>

      <Kartu
        judul={`Rekap LTT format Dinas — ${NAMA_BULAN[bulan - 1]} ${tahun}`}
        aksi={<TombolUnduh href={`/api/unduh/rekap-dinas?bulan=${bulan}&tahun=${tahun}`} />}
        className="mb-4"
      >
        <form method="get" className={formKelas}>
          {tersembunyi2}
          <Pilihan label="Bulan" name="bulan" nilai={bulan} opsi={NAMA_BULAN.map((n, i) => ({ v: i + 1, t: n }))} />
          <Pilihan label="Tahun" name="tahun" nilai={tahun} opsi={[now.tahun, now.tahun - 1].map((t) => ({ v: t, t: String(t) }))} />
          <button className={kelasTombol}>Tampilkan</button>
        </form>
        <p className="mb-2 text-[11px] text-muted">Padi Reguler = LTT Reguler saja. Oplah, CSR, Rehab Bencana tidak dihitung (aturan lama). Kedelai selalu 0.</p>
        <Tabel kepala={["Kecamatan", "Padi Reg. T", "Padi Reg. P", "Gogo T", "Gogo P", "Jagung T", "Jagung P", "Kedelai T", "Kedelai P", "Ubi Kayu T", "Ubi Kayu P"]}
          kaki={
            <tr>
              <td className={sel}>JUMLAH</td>
              {[(b: (typeof dinas)[number]) => b.padiReguler, (b: (typeof dinas)[number]) => b.padiGogo, (b: (typeof dinas)[number]) => b.jagung, (b: (typeof dinas)[number]) => b.kedelai, (b: (typeof dinas)[number]) => b.ubiKayu].flatMap((f, i) => [
                <td key={`t${i}`} className={selAngka}>{formatAngka(tot((b) => f(b).tanam))}</td>,
                <td key={`p${i}`} className={selAngka}>{formatAngka(tot((b) => f(b).panen))}</td>,
              ])}
            </tr>
          }
        >
          {dinas.map((b) => (
            <tr key={b.kecamatan}>
              <td className={sel}>{b.kecamatan}</td>
              {[b.padiReguler, b.padiGogo, b.jagung, b.kedelai, b.ubiKayu].flatMap((t, i) => [
                <td key={`t${i}`} className={selAngka}>{formatAngka(t.tanam)}</td>,
                <td key={`p${i}`} className={selAngka}>{formatAngka(t.panen)}</td>,
              ])}
            </tr>
          ))}
        </Tabel>
      </Kartu>

      <Kartu judul="Unduh Daftar Laporan LTT">
        {/* Langsung ke route unduh: browser menerima file .xlsx */}
        <form method="get" action="/api/unduh/laporan" className={formKelas}>
          <Tanggal label="Dari" name="dari" nilai={`${hariIni.slice(0, 8)}01`} max={hariIni} />
          <Tanggal label="Sampai" name="sampai" nilai={hariIni} max={hariIni} />
          <Pilihan label="Komoditas" name="komoditas" nilai="" opsi={[{ v: "", t: "Semua" }, ...KOMODITAS.map((k) => ({ v: k, t: k }))]} />
          <Pilihan label="Kecamatan" name="kecamatan" nilai="" opsi={[{ v: "", t: "Semua" }, ...kecs.map((k) => ({ v: k.id, t: k.nama }))]} />
          <button className={kelasTombol}>Unduh Excel</button>
        </form>
      </Kartu>
    </>
  );
}
