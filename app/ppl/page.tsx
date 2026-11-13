import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseSiap } from "@/lib/env";
import {
  TampilanPPL,
  type ItemDesa,
  type ItemLaporanHariIni,
  type ItemStatusPadi,
} from "./tampilan-ppl";

export const metadata: Metadata = {
  title: "Penyuluh — SMART LTT",
};

export default async function HalamanPPL() {
  return (
    <KerangkaHalaman judul="SMART LTT" role={["Penyuluh", "Admin_BPP"]}>
      <MuatKontenPPL />
    </KerangkaHalaman>
  );
}

async function MuatKontenPPL() {
  const pengguna = await wajibRole("Penyuluh", "Admin_BPP");

  let daftarDesa: ItemDesa[] = [];
  let kecamatanNama = "Way Kanan";
  let laporanHariIni: ItemLaporanHariIni[] = [];
  let statusPadiHariIni: ItemStatusPadi[] = [];

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

      // 2. Ambil desa binaan
      if (pengguna.role === "Admin_BPP" && pengguna.kecamatanId) {
        // Admin BPP bisa melihat semua desa di kecamatannya
        const { data: desas } = await supabase
          .from("desa")
          .select("id, nama")
          .eq("kecamatan_id", pengguna.kecamatanId)
          .order("nama");
        if (desas) daftarDesa = desas;
      } else {
        // Penyuluh mengambil desa binaannya dari ltt.anggota_desa
        const { data: relasi } = await supabase
          .from("anggota_desa")
          .select("desa:desa_id(id, nama)")
          .eq("user_id", pengguna.id);

        if (relasi) {
          daftarDesa = relasi
            .map((r: { desa: unknown }) => {
              const d = r.desa as { id: number; nama: string } | null;
              return d ? { id: d.id, nama: d.nama } : null;
            })
            .filter((d): d is ItemDesa => d !== null);
        }
      }

      const idDesaList = daftarDesa.map((d) => d.id);

      // 3. Ambil laporan hari ini (WIB) jika ada desa binaan
      if (idDesaList.length > 0) {
        // Batas hari ini WIB
        const awalHariIni = new Date();
        awalHariIni.setHours(0, 0, 0, 0);

        const { data: laps } = await supabase
          .from("laporan_ltt")
          .select("id, desa_id, komoditas, realisasi_tanam, realisasi_panen, keterangan, tanggal_lapor, sumber, desa:desa_id(nama)")
          .in("desa_id", idDesaList)
          .gte("tanggal_lapor", awalHariIni.toISOString())
          .is("dihapus_pada", null)
          .order("tanggal_lapor", { ascending: false });

        if (laps) {
          laporanHariIni = laps.map((l: {
            id: number;
            desa_id: number;
            komoditas: string;
            realisasi_tanam: number;
            realisasi_panen: number;
            keterangan: string | null;
            tanggal_lapor: string;
            sumber: string;
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
            };
          });

          // 4. Susun status Padi hari ini per desa binaan
          const laporanPadi = laporanHariIni.filter((l) => l.komoditas === "Padi");
          statusPadiHariIni = daftarDesa.map((desa) => {
            const lapPadi = laporanPadi.find((lp) => lp.desa_id === desa.id);
            return {
              desa_id: desa.id,
              nama_desa: desa.nama,
              realisasi_tanam: lapPadi?.realisasi_tanam ?? 0,
              realisasi_panen: lapPadi?.realisasi_panen ?? 0,
              sudah_lapor: Boolean(lapPadi),
              waktu_tarik: lapPadi?.waktu ?? null,
            };
          });
        }
      }
    } catch {
      // Database belum diisi / error jaringan: biarkan array kosong, halaman tetap tampil anggun
    }
  }

  return (
    <TampilanPPL
      namaPenyuluh={pengguna.nama}
      nip={pengguna.nip}
      kecamatanNama={kecamatanNama}
      daftarDesa={daftarDesa}
      laporanHariIni={laporanHariIni}
      statusPadiHariIni={statusPadiHariIni}
    />
  );
}
