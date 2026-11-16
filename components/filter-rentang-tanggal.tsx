"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import { TombolMuatUlang } from "@/components/tombol-muat-ulang";

const TGL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Filter rentang tanggal (+ jenis LTT opsional) yang langsung diterapkan saat diubah.
 * Validasi: tanggal tidak boleh melewati hari ini; "dari" tidak boleh melewati "sampai"
 * (jika dilanggar, tanggal pasangannya ikut disesuaikan).
 */
export function FilterRentangTanggal({
  dari,
  sampai,
  hariIni,
  jenis,
  daftarJenis,
  sisipan,
}: {
  dari: string;
  sampai: string;
  hariIni: string;
  jenis?: string | null;
  daftarJenis?: string[];
  /** elemen tambahan (mis. tombol Excel) sebelum tombol muat ulang */
  sisipan?: React.ReactNode;
}) {
  const router = useRouter();
  const path = usePathname();
  const [d, setD] = useState(dari);
  const [s, setS] = useState(sampai);
  const [j, setJ] = useState(jenis ?? "");
  const [pesan, setPesan] = useState<string | null>(null);

  // Sinkron dengan nilai dari server: saat pindah tab/halaman (mis. Padi → Jagung → Padi) komponen ini
  // tidak dibuat ulang, jadi tanggal di filter bisa tertinggal dari data yang tampil. Bila nilai server
  // berubah, isi filter disetel ulang mengikuti server (pola "reset state saat props berubah").
  const kunciServer = `${path}|${dari}|${sampai}|${jenis ?? ""}`;
  const [kunciTerakhir, setKunciTerakhir] = useState(kunciServer);
  if (kunciTerakhir !== kunciServer) {
    setKunciTerakhir(kunciServer);
    setD(dari);
    setS(sampai);
    setJ(jenis ?? "");
    // pesan validasi dipertahankan bila server memakai tanggal hasil koreksi filter ini sendiri
    if (dari !== d || sampai !== s) setPesan(null);
  }

  const terapkan = (nd: string, ns: string, nj: string) => {
    const q = new URLSearchParams({ dari: nd, sampai: ns });
    if (nj) q.set("jenisLtt", nj);
    router.push(`${path}?${q.toString()}`, { scroll: false });
  };

  const ubahTanggal = (sisi: "dari" | "sampai", v: string) => {
    if (!TGL.test(v)) return; // belum lengkap diketik
    let nd = sisi === "dari" ? v : d;
    let ns = sisi === "sampai" ? v : s;
    let info: string | null = null;
    if (nd > hariIni) { nd = hariIni; info = "Tanggal tidak boleh melewati hari ini."; }
    if (ns > hariIni) { ns = hariIni; info = "Tanggal tidak boleh melewati hari ini."; }
    if (nd > ns) {
      if (sisi === "dari") ns = nd;
      else nd = ns;
      info = "Tanggal awal tidak boleh melewati tanggal akhir — disesuaikan otomatis.";
    }
    setD(nd);
    setS(ns);
    setPesan(info);
    terapkan(nd, ns, j);
  };

  const kelasIn = "rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-green-500";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" aria-label="Dari tanggal" value={d} max={s < hariIni ? s : hariIni} onChange={(e) => ubahTanggal("dari", e.target.value)} className={kelasIn} />
        <span className="text-gray-400">-</span>
        <input type="date" aria-label="Sampai tanggal" value={s} min={d} max={hariIni} onChange={(e) => ubahTanggal("sampai", e.target.value)} className={kelasIn} />
        {daftarJenis && (
          <select aria-label="Jenis LTT" value={j} onChange={(e) => { setJ(e.target.value); terapkan(d, s, e.target.value); }} className={kelasIn}>
            <option value="">Semua Jenis LTT</option>
            {daftarJenis.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        )}
        {sisipan}
        <TombolMuatUlang className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50" />
      </div>
      {pesan && <p className="text-[11px] font-semibold text-amber-600">{pesan}</p>}
    </div>
  );
}
