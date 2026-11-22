"use client";

import { useState } from "react";

/**
 * Pilihan Komoditas + Jenis LTT di kartu filter Laporan LTT.
 * Jenis LTT hanya aktif bila komoditas = Padi; urut aktif dulu, yang nonaktif diberi keterangan.
 */
export function PilihKomoditasJenis({
  daftarKomoditas,
  komoditas,
  jenis,
  jenisPilihan,
  kelasIn,
  lbl,
}: {
  daftarKomoditas: string[];
  komoditas: string;
  jenis: string;
  jenisPilihan: { id: number; nama: string; aktif: boolean }[];
  kelasIn: string;
  lbl: string;
}) {
  const [k, setK] = useState(komoditas);
  const [j, setJ] = useState(jenis);
  const padi = k === "Padi";

  return (
    <>
      <label>
        <span className={lbl}>Komoditas</span>
        <select name="komoditas" value={k} onChange={(e) => setK(e.target.value)} className={kelasIn}>
          <option value="">Semua Komoditas</option>
          {daftarKomoditas.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
      </label>
      <label>
        <span className={lbl}>Jenis LTT</span>
        <select
          name="jenis"
          value={padi ? j : ""}
          onChange={(e) => setJ(e.target.value)}
          disabled={!padi}
          className={`${kelasIn} disabled:bg-gray-50 disabled:text-gray-400`}
        >
          <option value="">{padi ? "Semua Jenis LTT" : "— Pilih Padi dulu —"}</option>
          {jenisPilihan.map((x) => (
            <option key={x.id} value={x.id}>{x.aktif ? x.nama : `${x.nama} (nonaktif)`}</option>
          ))}
        </select>
      </label>
    </>
  );
}
