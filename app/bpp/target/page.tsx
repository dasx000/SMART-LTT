import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka } from "@/lib/format";
import { KOMODITAS, ambilTargetDesa, daftarDesa, jenisPadi, type Komoditas } from "@/lib/data";
import { daftarAnggota } from "@/lib/pengguna";
import { FormTarget } from "@/components/form-target";
import { JudulHalaman, Kartu, Kosong, PilihBulanKomoditas, Tabel, sel, selAngka } from "@/components/ui";
import { angkaParam, teksParam, type CariParam } from "@/lib/param";

export const metadata: Metadata = { title: "Target BPP — SMART LTT" };

export default function HalamanTargetBpp({ searchParams }: { searchParams: CariParam }) {
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
  const bulan = angkaParam(q, "bulan", 1, 12, bulanTahunWIB().bulan);
  const kom = ((KOMODITAS as string[]).includes(teksParam(q, "komoditas") ?? "") ? teksParam(q, "komoditas") : "Padi") as Komoditas;

  const s = await supabaseServer();
  const [desa, jenis, ppl] = await Promise.all([
    daftarDesa(s, p.kecamatanId),
    jenisPadi(s),
    daftarAnggota({ kecamatanId: p.kecamatanId, role: ["penyuluh", "admin_bpp"] }),
  ]);
  const target = await ambilTargetDesa(s, desa.map((d) => d.id), { bulan, komoditas: kom });
  const aktif = ppl.filter((x) => x.aktif);

  // Target per PPL = jumlah target desa binaannya (logika-bisnis §10)
  const ringkas = aktif.map((u) => {
    const t = target.filter((x) => x.bulan === bulan && x.komoditas === kom && u.desaIds.includes(x.desaId));
    return {
      nama: u.nama,
      jmlDesa: u.desaIds.length,
      terisi: t.length,
      tanam: t.reduce((a, x) => a + x.tanam, 0),
      panen: t.reduce((a, x) => a + x.panen, 0),
    };
  });

  const namaPpl = (desaId: number) =>
    aktif.filter((u) => u.desaIds.includes(desaId)).map((u) => u.nama).join(", ") || "Belum ada PPL";

  return (
    <>
      <JudulHalaman judul="Target Desa Kecamatan" sub="Isi atau perbaiki target desa untuk PPL di kecamatan Anda. Target kecamatan diisi di Dashboard BPP." />

      <PilihBulanKomoditas dasar="/bpp/target" bulan={bulan} kom={kom} />
      <Kartu judul={`Rekap target per PPL — ${kom}, ${NAMA_BULAN[bulan - 1]}`} className="mb-4">
        {ringkas.length === 0 ? (
          <Kosong teks="Belum ada PPL aktif di kecamatan ini." />
        ) : (
          <Tabel
            kepala={["Nama PPL", "Desa Terisi", "Target Tanam", "Target Panen", "Status"]}
            kaki={
              <tr>
                <td className={sel}>JUMLAH</td>
                <td className={selAngka}></td>
                <td className={selAngka}>{formatAngka(ringkas.reduce((a, r) => a + r.tanam, 0))}</td>
                <td className={selAngka}>{formatAngka(ringkas.reduce((a, r) => a + r.panen, 0))}</td>
                <td className={sel}></td>
              </tr>
            }
          >
            {ringkas.map((r) => (
              <tr key={r.nama}>
                <td className={sel}>{r.nama}</td>
                <td className={selAngka}>
                  {r.terisi}/{r.jmlDesa}
                </td>
                <td className={selAngka}>{formatAngka(r.tanam)}</td>
                <td className={selAngka}>{formatAngka(r.panen)}</td>
                <td className={`${sel} text-center font-bold ${r.terisi > 0 ? "text-primary" : "text-danger"}`}>
                  {r.terisi > 0 ? "Sudah" : "Belum"}
                </td>
              </tr>
            ))}
          </Tabel>
        )}
      </Kartu>

      <h2 className="mb-2 text-sm font-bold">Isi target per desa</h2>
      <FormTarget
        desa={desa.map((d) => ({ id: d.id, nama: d.nama, label: `PPL: ${namaPpl(d.id)}` }))}
        jenis={jenis}
        target={target.filter((t) => t.bulan === bulan && t.komoditas === kom)}
        bulan={bulan}
        kom={kom}
      />
    </>
  );
}
