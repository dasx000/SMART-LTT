import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseSiap } from "@/lib/env";
import {
  TampilanKab,
  type ItemKecamatanCapaian,
  type ItemPmAasKecamatan,
  type ItemLaporanKab,
} from "./tampilan-kab";

export const metadata: Metadata = {
  title: "Kabupaten — SMART LTT",
};

export default async function HalamanKab() {
  return (
    <KerangkaHalaman judul="SMART LTT · Kabupaten" role={["Admin_Kab", "Dinas"]}>
      <MuatKontenKab />
    </KerangkaHalaman>
  );
}

async function MuatKontenKab() {
  const pengguna = await wajibRole("Admin_Kab", "Dinas");

  const now = new Date();
  const bulanAktif = now.getMonth() + 1; // 1 - 12
  const tahunAktif = now.getFullYear();

  const totalPadi = { tanam: 0, panen: 0 };
  const totalJagung = { tanam: 0, panen: 0 };
  const totalUbi = { tanam: 0, panen: 0 };
  const totalPmAas = { tanam: 0, panen: 0 };

  const targetKabupaten = {
    padi: 0,
    jagung: 0,
    ubiKayu: 0,
  };

  let rekapKecamatan: ItemKecamatanCapaian[] = [];
  let rekapPmAas: ItemPmAasKecamatan[] = [];
  let laporanKabupaten: ItemLaporanKab[] = [];
  let daftarDesaSemua: { id: number; nama: string; kecamatan_id: number }[] = [];

  if (supabaseSiap()) {
    try {
      const supabase = await supabaseServer();

      // 1. Ambil seluruh 15 Kecamatan
      const { data: kecs } = await supabase
        .from("kecamatan")
        .select("id, nama")
        .order("nama");

      // 2. Ambil seluruh Desa untuk modal pilihan koreksi
      const { data: desas } = await supabase
        .from("desa")
        .select("id, nama, kecamatan_id")
        .order("nama");

      if (desas) {
        daftarDesaSemua = desas;
      }

      // 3. Ambil target kabupaten (dari view v_target_kabupaten atau target_kecamatan)
      const { data: targets } = await supabase
        .from("target_kecamatan")
        .select("kecamatan_id, bulan, komoditas, target_tanam")
        .eq("bulan", bulanAktif);

      const targetPerKecMap = new Map<string, number>();
      if (targets) {
        for (const t of targets) {
          const val = Number(t.target_tanam) || 0;
          if (t.komoditas === "Padi") targetKabupaten.padi += val;
          else if (t.komoditas === "Jagung") targetKabupaten.jagung += val;
          else if (t.komoditas === "Ubi Kayu") targetKabupaten.ubiKayu += val;

          const keyKec = `${t.kecamatan_id}`;
          targetPerKecMap.set(keyKec, (targetPerKecMap.get(keyKec) || 0) + val);
        }
      }

      // 4. Ambil seluruh laporan LTT bulan berjalan se-Kabupaten
      const awalBulan = new Date(tahunAktif, bulanAktif - 1, 1).toISOString();

      const { data: laps } = await supabase
        .from("laporan_ltt")
        .select(`
          id, desa_id, komoditas, realisasi_tanam, realisasi_panen,
          luas_bera, realisasi_olah, metode_penanaman, keterangan,
          tanggal_lapor, sumber, nama_pelapor,
          desa:desa_id(id, nama, kecamatan_id, kecamatan:kecamatan_id(id, nama))
        `)
        .gte("tanggal_lapor", awalBulan)
        .is("dihapus_pada", null)
        .order("tanggal_lapor", { ascending: false });

      if (laps) {
        laporanKabupaten = laps.map((l: {
          id: number;
          desa_id: number;
          komoditas: string;
          realisasi_tanam: number;
          realisasi_panen: number;
          luas_bera: number;
          realisasi_olah: number;
          metode_penanaman: string | null;
          keterangan: string | null;
          tanggal_lapor: string;
          sumber: string;
          nama_pelapor: string | null;
          desa: unknown;
        }) => {
          const d = l.desa as {
            nama: string;
            kecamatan_id: number;
            kecamatan: { id: number; nama: string } | null;
          } | null;

          return {
            id: l.id,
            desa_id: l.desa_id,
            nama_desa: d?.nama ?? "Desa",
            nama_kecamatan: d?.kecamatan?.nama ?? "Kecamatan",
            komoditas: l.komoditas as "Padi" | "Jagung" | "Ubi Kayu",
            realisasi_tanam: Number(l.realisasi_tanam) || 0,
            realisasi_panen: Number(l.realisasi_panen) || 0,
            luas_bera: Number(l.luas_bera) || 0,
            realisasi_olah: Number(l.realisasi_olah) || 0,
            metode_penanaman: l.metode_penanaman as "Regular" | "PM AAS" | null,
            keterangan: l.keterangan,
            waktu: l.tanggal_lapor,
            sumber: l.sumber as "manual" | "epusluh",
            nama_pelapor: l.nama_pelapor,
          };
        });

        // Hitung total kabupaten
        for (const lap of laporanKabupaten) {
          if (lap.komoditas === "Padi") {
            totalPadi.tanam += lap.realisasi_tanam;
            totalPadi.panen += lap.realisasi_panen;
            if (lap.metode_penanaman === "PM AAS") {
              totalPmAas.tanam += lap.realisasi_tanam;
              totalPmAas.panen += lap.realisasi_panen;
            }
          } else if (lap.komoditas === "Jagung") {
            totalJagung.tanam += lap.realisasi_tanam;
            totalJagung.panen += lap.realisasi_panen;
          } else if (lap.komoditas === "Ubi Kayu") {
            totalUbi.tanam += lap.realisasi_tanam;
            totalUbi.panen += lap.realisasi_panen;
          }
        }

        // Susun rekapitulasi per kecamatan (15 kecamatan)
        if (kecs) {
          rekapKecamatan = kecs.map((k) => {
            const lapsKec = laporanKabupaten.filter((l) => l.nama_kecamatan === k.nama);
            const tanamPadi = lapsKec
              .filter((l) => l.komoditas === "Padi")
              .reduce((acc, l) => acc + l.realisasi_tanam, 0);
            const tanamJagung = lapsKec
              .filter((l) => l.komoditas === "Jagung")
              .reduce((acc, l) => acc + l.realisasi_tanam, 0);
            const tanamUbi = lapsKec
              .filter((l) => l.komoditas === "Ubi Kayu")
              .reduce((acc, l) => acc + l.realisasi_tanam, 0);
            const totalTanam = tanamPadi + tanamJagung + tanamUbi;
            const totalPanen = lapsKec.reduce((acc, l) => acc + l.realisasi_panen, 0);
            const targetTanam = targetPerKecMap.get(`${k.id}`) || 0;

            return {
              kecamatanId: k.id,
              namaKecamatan: k.nama,
              tanamPadi,
              tanamJagung,
              tanamUbi,
              totalTanam,
              targetTanam,
              totalPanen,
            };
          });

          // Susun rekapitulasi PM AAS per kecamatan
          rekapPmAas = kecs.map((k) => {
            const lapsPmAas = laporanKabupaten.filter(
              (l) => l.nama_kecamatan === k.nama && l.komoditas === "Padi" && l.metode_penanaman === "PM AAS"
            );
            const tanamPmAas = lapsPmAas.reduce((acc, l) => acc + l.realisasi_tanam, 0);
            const panenPmAas = lapsPmAas.reduce((acc, l) => acc + l.realisasi_panen, 0);

            return {
              kecamatanId: k.id,
              namaKecamatan: k.nama,
              tanamPmAas,
              panenPmAas,
            };
          });
        }
      }
    } catch {
      // Fallback anggun jika tabel Supabase belum dimigrasikan
    }
  }

  return (
    <TampilanKab
      rolePengguna={pengguna.role === "Dinas" ? "Dinas" : "Admin_Kab"}
      namaPengguna={pengguna.nama}
      bulanAktif={bulanAktif}
      totalPadi={totalPadi}
      totalJagung={totalJagung}
      totalUbi={totalUbi}
      totalPmAas={totalPmAas}
      targetKabupaten={targetKabupaten}
      rekapKecamatan={rekapKecamatan}
      rekapPmAas={rekapPmAas}
      laporanKabupaten={laporanKabupaten}
      daftarDesaSemua={daftarDesaSemua}
    />
  );
}
