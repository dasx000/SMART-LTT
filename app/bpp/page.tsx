import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseSiap } from "@/lib/env";
import {
  TampilanBPP,
  type CapaianKomoditas,
  type RekapDesaRow,
  type ItemLaporanBpp,
  type ItemTargetKecamatan,
} from "./tampilan-bpp";

export const metadata: Metadata = {
  title: "Koordinator BPP — SMART LTT",
};

export default async function HalamanBPP() {
  return (
    <KerangkaHalaman judul="SMART LTT · BPP" role={["Admin_BPP", "Admin_Kab"]}>
      <MuatKontenBPP />
    </KerangkaHalaman>
  );
}

async function MuatKontenBPP() {
  const pengguna = await wajibRole("Admin_BPP", "Admin_Kab");

  const now = new Date();
  const bulanAktif = now.getMonth() + 1; // 1 - 12
  const tahunAktif = now.getFullYear();

  let kecamatanNama = "Way Kanan";
  const kecamatanId = pengguna.kecamatanId ?? 1;

  let daftarDesa: { id: number; nama: string }[] = [];
  const rekapKomoditas: {
    padi: CapaianKomoditas;
    jagung: CapaianKomoditas;
    ubiKayu: CapaianKomoditas;
  } = {
    padi: { realisasiTanam: 0, realisasiPanen: 0, targetTanam: 0, targetPanen: 0 },
    jagung: { realisasiTanam: 0, realisasiPanen: 0, targetTanam: 0, targetPanen: 0 },
    ubiKayu: { realisasiTanam: 0, realisasiPanen: 0, targetTanam: 0, targetPanen: 0 },
  };

  let rekapDesa: RekapDesaRow[] = [];
  let laporanKecamatan: ItemLaporanBpp[] = [];
  let targetList: ItemTargetKecamatan[] = [];

  if (supabaseSiap()) {
    try {
      const supabase = await supabaseServer();

      // 1. Ambil nama kecamatan
      if (pengguna.kecamatanId) {
        const { data: kec } = await supabase
          .from("kecamatan")
          .select("nama")
          .eq("id", pengguna.kecamatanId)
          .single();
        if (kec?.nama) kecamatanNama = kec.nama;
      }

      // 2. Ambil seluruh desa di kecamatan ini
      const { data: desas } = await supabase
        .from("desa")
        .select("id, nama")
        .eq("kecamatan_id", kecamatanId)
        .order("nama");

      if (desas) {
        daftarDesa = desas;
      }

      const idDesaList = daftarDesa.map((d) => d.id);

      // 3. Ambil target kecamatan
      const { data: targets } = await supabase
        .from("target_kecamatan")
        .select("bulan, komoditas, target_tanam, target_panen")
        .eq("kecamatan_id", kecamatanId)
        .order("bulan");

      if (targets) {
        targetList = targets.map((t: {
          bulan: number;
          komoditas: string;
          target_tanam: number;
          target_panen: number;
        }) => ({
          bulan: t.bulan,
          komoditas: t.komoditas as "Padi" | "Jagung" | "Ubi Kayu",
          target_tanam: Number(t.target_tanam) || 0,
          target_panen: Number(t.target_panen) || 0,
        }));

        // Pasang target bulan berjalan
        const tBlnIni = targetList.filter((t) => t.bulan === bulanAktif);
        const tPadi = tBlnIni.find((t) => t.komoditas === "Padi");
        const tJagung = tBlnIni.find((t) => t.komoditas === "Jagung");
        const tUbi = tBlnIni.find((t) => t.komoditas === "Ubi Kayu");

        if (tPadi) {
          rekapKomoditas.padi.targetTanam = tPadi.target_tanam;
          rekapKomoditas.padi.targetPanen = tPadi.target_panen;
        }
        if (tJagung) {
          rekapKomoditas.jagung.targetTanam = tJagung.target_tanam;
          rekapKomoditas.jagung.targetPanen = tJagung.target_panen;
        }
        if (tUbi) {
          rekapKomoditas.ubiKayu.targetTanam = tUbi.target_tanam;
          rekapKomoditas.ubiKayu.targetPanen = tUbi.target_panen;
        }
      }

      // 4. Ambil laporan LTT bulan berjalan di kecamatan ini
      if (idDesaList.length > 0) {
        const awalBulan = new Date(tahunAktif, bulanAktif - 1, 1).toISOString();

        const { data: laps } = await supabase
          .from("laporan_ltt")
          .select("id, desa_id, komoditas, realisasi_tanam, realisasi_panen, keterangan, tanggal_lapor, sumber, nama_pelapor, desa:desa_id(nama)")
          .in("desa_id", idDesaList)
          .gte("tanggal_lapor", awalBulan)
          .is("dihapus_pada", null)
          .order("tanggal_lapor", { ascending: false });

        if (laps) {
          laporanKecamatan = laps.map((l: {
            id: number;
            desa_id: number;
            komoditas: string;
            realisasi_tanam: number;
            realisasi_panen: number;
            keterangan: string | null;
            tanggal_lapor: string;
            sumber: string;
            nama_pelapor: string | null;
            desa: unknown;
          }) => {
            const d = l.desa as { nama: string } | null;
            return {
              id: l.id,
              desa_id: l.desa_id,
              nama_desa: d?.nama ?? "Desa",
              komoditas: l.komoditas as "Padi" | "Jagung" | "Ubi Kayu",
              realisasi_tanam: Number(l.realisasi_tanam) || 0,
              realisasi_panen: Number(l.realisasi_panen) || 0,
              keterangan: l.keterangan,
              waktu: l.tanggal_lapor,
              sumber: l.sumber as "manual" | "epusluh",
              nama_pelapor: l.nama_pelapor,
            };
          });

          // Akumulasi realisasi tanam & panen per komoditas kecamatan
          for (const lap of laporanKecamatan) {
            if (lap.komoditas === "Padi") {
              rekapKomoditas.padi.realisasiTanam += lap.realisasi_tanam;
              rekapKomoditas.padi.realisasiPanen += lap.realisasi_panen;
            } else if (lap.komoditas === "Jagung") {
              rekapKomoditas.jagung.realisasiTanam += lap.realisasi_tanam;
              rekapKomoditas.jagung.realisasiPanen += lap.realisasi_panen;
            } else if (lap.komoditas === "Ubi Kayu") {
              rekapKomoditas.ubiKayu.realisasiTanam += lap.realisasi_tanam;
              rekapKomoditas.ubiKayu.realisasiPanen += lap.realisasi_panen;
            }
          }

          // Akumulasi capaian per desa
          rekapDesa = daftarDesa.map((desa) => {
            const lapDesa = laporanKecamatan.filter((l) => l.desa_id === desa.id);
            const tanamPadi = lapDesa
              .filter((l) => l.komoditas === "Padi")
              .reduce((acc, l) => acc + l.realisasi_tanam, 0);
            const tanamJagung = lapDesa
              .filter((l) => l.komoditas === "Jagung")
              .reduce((acc, l) => acc + l.realisasi_tanam, 0);
            const tanamUbi = lapDesa
              .filter((l) => l.komoditas === "Ubi Kayu")
              .reduce((acc, l) => acc + l.realisasi_tanam, 0);
            const totalTanam = tanamPadi + tanamJagung + tanamUbi;
            const totalPanen = lapDesa.reduce((acc, l) => acc + l.realisasi_panen, 0);

            return {
              desaId: desa.id,
              namaDesa: desa.nama,
              tanamPadi,
              tanamJagung,
              tanamUbi,
              totalTanam,
              totalPanen,
            };
          });
        }
      }
    } catch {
      // Fallback aman jika tabel Supabase belum dimigrasikan
    }
  }

  return (
    <TampilanBPP
      namaAdmin={pengguna.nama}
      kecamatanNama={kecamatanNama}
      bulanAktif={bulanAktif}
      rekapKomoditas={rekapKomoditas}
      rekapDesa={rekapDesa}
      laporanKecamatan={laporanKecamatan}
      targetList={targetList}
      daftarDesa={daftarDesa}
    />
  );
}
