"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { angkaIsian, formatAngka, parseDesimal } from "@/lib/format";
import { gagal, memuat, sukses } from "@/lib/swal";
import { simpanTargetProvinsiAction } from "./actions";

type Baris = { id: number; nama: string; tanam: number; panen: number };

/** Form Target Provinsi per kecamatan untuk satu (tahun, bulan, komoditas) — Admin Kab. Dibuka lewat ?set=1. */
export function FormTargetProvinsi({
  tahun, bulan, komoditas, judul, baris, kembali,
}: {
  tahun: number;
  bulan: number;
  komoditas: string;
  judul: string;
  baris: Baris[];
  kembali: string;
}) {
  const router = useRouter();
  const [proses, mulai] = useTransition();
  const [isi, setIsi] = useState<Record<string, string>>(() =>
    Object.fromEntries(baris.flatMap((b) => [[`tanam_${b.id}`, angkaIsian(b.tanam)], [`panen_${b.id}`, angkaIsian(b.panen)]])),
  );
  const jumlah = (awalan: string) => baris.reduce((a, b) => a + (parseDesimal(isi[`${awalan}_${b.id}`] ?? "") || 0), 0);

  const kotak = (nama: string) => (
    <input
      name={nama}
      inputMode="decimal"
      autoComplete="off"
      value={isi[nama] ?? ""}
      onChange={(e) => setIsi((x) => ({ ...x, [nama]: e.target.value }))}
      placeholder="0"
      className="w-24 rounded-md border border-gray-200 px-2 py-1 text-right text-sm outline-none focus:border-green-500"
    />
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("tahun", String(tahun));
        fd.set("bulan", String(bulan));
        fd.set("komoditas", komoditas);
        mulai(async () => {
          memuat("Menyimpan target...");
          const r = await simpanTargetProvinsiAction(fd);
          if (r.sukses) {
            await sukses("Berhasil!", r.pesan);
            router.replace(kembali, { scroll: false });
          } else await gagal("Gagal", r.pesan);
        });
      }}
    >
      <p className="mb-3 text-[11px] text-gray-500">{judul} · kosongkan bila kecamatan tidak punya target. Angka desimal pakai koma (mis. 12,5).</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
              <th className="p-2.5 text-left">Kecamatan</th>
              <th className="p-2.5 text-right">Target Tanam (Ha)</th>
              <th className="p-2.5 text-right">Target Panen (Ha)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {baris.map((b) => (
              <tr key={b.id}>
                <td className="p-2 font-semibold text-gray-700">{b.nama}</td>
                <td className="p-2 text-right">{kotak(`tanam_${b.id}`)}</td>
                <td className="p-2 text-right">{kotak(`panen_${b.id}`)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-yellow-50 font-bold text-yellow-800">
              <td className="p-2.5">JUMLAH KABUPATEN</td>
              <td className="p-2.5 text-right">{formatAngka(jumlah("tanam"))}</td>
              <td className="p-2.5 text-right">{formatAngka(jumlah("panen"))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Link href={kembali} scroll={false} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-500">
          Batal
        </Link>
        <button type="submit" disabled={proses} className="rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
          Simpan
        </button>
      </div>
    </form>
  );
}
