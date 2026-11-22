import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { NAMA_BULAN, bulanTahunWIB, formatAngka } from "@/lib/format";
import { KOMODITAS, ambilTargetDesa, daftarDesa, daftarKecamatan, jenisPadi, type Komoditas } from "@/lib/data";
import { daftarAnggota } from "@/lib/pengguna";
import { JudulHalaman, Kartu, Kosong, PilihBulanKomoditas, Tabel, sel, selAngka } from "@/components/ui";
import { angkaParam, teksParam, type CariParam } from "@/lib/param";
import { DaftarTargetDesa } from "@/components/target-desa/daftar-target-desa";
import { barisTargetDesa } from "@/components/target-desa/data";

export const metadata: Metadata = { title: "Target Desa — SMART LTT" };

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
  const kini = bulanTahunWIB();
  const tahun = angkaParam(q, "tahun", 2000, 2100, kini.tahun);
  const bulan = angkaParam(q, "bulan", 1, 12, kini.bulan);
  const kom = ((KOMODITAS as string[]).includes(teksParam(q, "komoditas") ?? "") ? teksParam(q, "komoditas") : "Padi") as Komoditas;

  const s = await supabaseServer();
  const [desa, ppl, kecs, jenis, { data: tp }] = await Promise.all([
    daftarDesa(s, p.kecamatanId),
    daftarAnggota({ kecamatanId: p.kecamatanId, role: ["penyuluh", "admin_bpp"] }),
    daftarKecamatan(s),
    jenisPadi(s),
    s.from("target_provinsi").select("target_tanam").eq("tahun", tahun).eq("bulan", bulan).eq("komoditas", kom).eq("kecamatan_id", p.kecamatanId).maybeSingle(),
  ]);
  const [target, barisDesa] = await Promise.all([
    ambilTargetDesa(s, desa.map((d) => d.id), { tahun, bulan, komoditas: kom }),
    barisTargetDesa(s, { tahun, bulan, kom, desa, kecs }),
  ]);
  const namaKec = kecs.find((k) => k.id === p.kecamatanId)?.nama ?? "";
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

  return (
    <>
      <JudulHalaman judul="Target Desa Kecamatan" sub="Target desa diisi PPL masing-masing, dan dapat dibuat / diubah oleh Admin BPP. Target kecamatan = jumlah target desa." />

      <PilihBulanKomoditas dasar="/bpp/target" tahun={tahun} bulan={bulan} kom={kom} />
      <Kartu judul={`Rekap target per PPL — ${kom}, ${NAMA_BULAN[bulan - 1]} ${tahun}`} className="mb-4">
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

      <Kartu judul={`Target per desa — ${kom}, ${NAMA_BULAN[bulan - 1]} ${tahun}`}>
        <DaftarTargetDesa
          baris={barisDesa}
          jenis={jenis}
          tahun={tahun}
          bulan={bulan}
          kom={kom}
          kuota={{ [p.kecamatanId]: Number(tp?.target_tanam) || 0 }}
          namaCakupan={`Kec. ${namaKec}`}
          tampilKecamatan={false}
          penggunaId={p.id}
        />
      </Kartu>
    </>
  );
}
