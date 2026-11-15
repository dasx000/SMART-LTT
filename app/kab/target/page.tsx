import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka } from "@/lib/format";
import {
  KATEGORI, daftarKecamatan, laporanBulan, realisasiKategoriPerKecamatan, targetKategoriPerKecamatan, type Kategori,
} from "@/lib/data";
import { FormFilter, JudulHalaman, Kartu, Persen, Pilihan, Tabel, TombolUnduh, sel, selAngka } from "@/components/ui";
import { angkaParam, teksParam, type CariParam } from "@/lib/param";

export const metadata: Metadata = { title: "Target — SMART LTT" };

export default function HalamanTargetKab({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="SMART LTT · Target" role={["admin_kab"]}>
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

async function Isi({ searchParams }: { searchParams: CariParam }) {
  await wajibRole("admin_kab");
  const q = await searchParams;
  const now = bulanTahunWIB();
  const bulan = angkaParam(q, "bulan", 1, 12, now.bulan);
  const tahun = angkaParam(q, "tahun", 2020, now.tahun, now.tahun);
  const kat = (KATEGORI.find((k) => k.kunci === teksParam(q, "kategori"))?.kunci ?? "LTTReguler") as Kategori;
  const sisi = teksParam(q, "sisi") === "panen" ? "panen" : "tanam";

  const s = await supabaseServer();
  const kecs = await daftarKecamatan(s);
  const [target, lap] = await Promise.all([targetKategoriPerKecamatan(s, bulan), laporanBulan(s, tahun, bulan, kecs)]);
  const real = realisasiKategoriPerKecamatan(lap);

  const baris = kecs.map((k) => ({
    nama: k.nama,
    target: target.get(k.id)?.[kat][sisi] ?? 0,
    realisasi: real.get(k.id)?.[kat][sisi] ?? 0,
  }));
  const tT = baris.reduce((a, b) => a + b.target, 0);
  const tR = baris.reduce((a, b) => a + b.realisasi, 0);
  const label = KATEGORI.find((k) => k.kunci === kat)!.label;

  // Ringkasan target kabupaten (= jumlah kecamatan) per kategori, sisi tanam & panen
  const kab = KATEGORI.map((k) => ({
    label: k.label,
    tanam: [...target.values()].reduce((a, t) => a + t[k.kunci].tanam, 0),
    panen: [...target.values()].reduce((a, t) => a + t[k.kunci].panen, 0),
  }));

  const urlUnduh = `/api/unduh/target-realisasi?bulan=${bulan}&tahun=${tahun}&kategori=${kat}&sisi=${sisi}`;

  return (
    <>
      <JudulHalaman
        judul="Target vs Realisasi"
        sub="Target kecamatan diisi Admin BPP; bila kosong dipakai jumlah target desa. Target kabupaten = jumlah kecamatan."
        aksi={<TombolUnduh href={urlUnduh} />}
      />
      <FormFilter>
        <Pilihan label="Bulan" name="bulan" nilai={bulan} opsi={NAMA_BULAN.map((n, i) => ({ v: i + 1, t: n }))} />
        <Pilihan label="Tahun realisasi" name="tahun" nilai={tahun} opsi={[now.tahun, now.tahun - 1].map((t) => ({ v: t, t: String(t) }))} />
        <Pilihan label="Kategori" name="kategori" nilai={kat} opsi={KATEGORI.map((k) => ({ v: k.kunci, t: k.label }))} />
        <Pilihan label="Sisi" name="sisi" nilai={sisi} opsi={[{ v: "tanam", t: "Tanam" }, { v: "panen", t: "Panen" }]} />
      </FormFilter>

      <Kartu judul={`${label} — ${sisi === "tanam" ? "Tanam" : "Panen"}, ${NAMA_BULAN[bulan - 1]} ${tahun}`} className="mb-4">
        <Tabel
          kepala={["Kecamatan", "Target (Ha)", "Realisasi (Ha)", "Capaian"]}
          kaki={
            <tr>
              <td className={sel}>TOTAL KABUPATEN</td>
              <td className={selAngka}>{formatAngka(tT)}</td>
              <td className={selAngka}>{formatAngka(tR)}</td>
              <td className={`${sel} text-center`}><Persen realisasi={tR} target={tT} /></td>
            </tr>
          }
        >
          {baris.map((b) => (
            <tr key={b.nama}>
              <td className={sel}>{b.nama}</td>
              <td className={selAngka}>{formatAngka(b.target)}</td>
              <td className={selAngka}>{formatAngka(b.realisasi)}</td>
              <td className={`${sel} text-center`}><Persen realisasi={b.realisasi} target={b.target} /></td>
            </tr>
          ))}
        </Tabel>
      </Kartu>

      <Kartu judul={`Target Kabupaten — ${NAMA_BULAN[bulan - 1]}`}>
        <Tabel kepala={["Kategori", "Target Tanam (Ha)", "Target Panen (Ha)"]}>
          {kab.map((k) => (
            <tr key={k.label}>
              <td className={sel}>{k.label}</td>
              <td className={selAngka}>{formatAngka(k.tanam)}</td>
              <td className={selAngka}>{formatAngka(k.panen)}</td>
            </tr>
          ))}
        </Tabel>
      </Kartu>
    </>
  );
}
