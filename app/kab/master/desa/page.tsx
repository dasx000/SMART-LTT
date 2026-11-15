import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Search } from "lucide-react";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { ModalForm } from "@/components/master/modal-form";
import { Bidang, Catatan, KepalaMaster, kelasIn } from "@/components/master/ui-master";
import { angkaParam, teksParam, urlDengan, type CariParam } from "@/lib/param";
import { simpanDesaAction } from "../actions";

export const metadata: Metadata = { title: "Master Desa — SMART LTT" };

export default function HalamanMasterDesa({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Master Desa" role={["admin_kab"]} gaya="kab">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

const DASAR = "/kab/master/desa";
const kelasFilter = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-500";

async function Isi({ searchParams }: { searchParams: CariParam }) {
  await wajibRole("admin_kab");
  const q = await searchParams;
  const kec = angkaParam(q, "kecamatan", 1, 100000, 0);
  const cari = (teksParam(q, "q") ?? "").trim().toLowerCase();

  const s = await supabaseServer();
  const [{ data: kecs }, { data: desa, error }] = await Promise.all([
    s.from("kecamatan").select("id, kode, nama").order("nama"),
    s.from("desa").select("id, kode, nama, kecamatan_id").order("kode").limit(5000),
  ]);
  const namaKec = new Map((kecs ?? []).map((k) => [k.id, k.nama]));
  const tampil = (desa ?? []).filter(
    (d) => (!kec || d.kecamatan_id === kec) && (!cari || d.nama.toLowerCase().includes(cari) || d.kode.includes(cari)),
  );

  const edit = teksParam(q, "edit");
  const dipilih = edit && edit !== "baru" ? desa?.find((d) => String(d.id) === edit) : undefined;
  const kembali = urlDengan(DASAR, q, { edit: null });
  const kecAwal = dipilih?.kecamatan_id ?? (kec || undefined);
  const kodeAwal = dipilih?.kode ?? (kecs ?? []).find((k) => k.id === kec)?.kode ?? "";

  return (
    <>
      <KepalaMaster
        judul="Desa"
        sub="Desa binaan PPL. Nama dicocokkan dengan e-Pusluh saat impor dan sinkron bot."
        tambah={urlDengan(DASAR, q, { edit: "baru" })}
        label="Tambah Desa"
      />
      <Catatan>
        Nama desa harus <b>persis sama dengan e-Pusluh</b> (huruf besar/kecil dan spasi berlebih diabaikan); kalau berbeda, laporan
        desa itu dilewati saat impor dan sinkron bot. Desa tidak bisa dihapus karena dipakai laporan, target, dan desa binaan.
      </Catatan>

      <form method="get" className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-[1fr_14rem_auto]">
        <label className="relative block">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-gray-400" />
          <input name="q" defaultValue={teksParam(q, "q") ?? ""} placeholder="Cari nama atau kode desa..." className={`${kelasFilter} pl-9`} />
        </label>
        <select name="kecamatan" defaultValue={kec || ""} className={kelasFilter}>
          <option value="">Semua Kecamatan</option>
          {(kecs ?? []).map((k) => (
            <option key={k.id} value={k.id}>{k.nama}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white">Tampilkan</button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                <th className="p-3 text-left">No</th>
                <th className="p-3 text-left">Kode</th>
                <th className="p-3 text-left">Nama Desa</th>
                <th className="p-3 text-left">Kecamatan</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {error ? (
                <tr><td colSpan={5} className="p-6 text-center text-red-500">Gagal memuat: {error.message}</td></tr>
              ) : tampil.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">Tidak ada desa yang cocok.</td></tr>
              ) : (
                tampil.map((d, i) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-400">{i + 1}</td>
                    <td className="p-3 font-mono text-xs text-gray-500">{d.kode}</td>
                    <td className="p-3 font-semibold text-gray-800">{d.nama}</td>
                    <td className="p-3 text-gray-600">{namaKec.get(d.kecamatan_id) ?? "-"}</td>
                    <td className="p-3 text-center">
                      <Link href={urlDengan(DASAR, q, { edit: d.id })} scroll={false} title="Ubah" className="inline-flex rounded-lg bg-blue-50 p-1.5 text-blue-600 hover:bg-blue-100">
                        <Pencil size={14} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-gray-100 p-3 text-xs text-gray-500">
          {tampil.length} dari {desa?.length ?? 0} desa
        </p>
      </div>

      {(edit === "baru" || dipilih) && (
        <ModalForm key={edit} judul={dipilih ? `Ubah Desa ${dipilih.nama}` : "Tambah Desa"} aksi={simpanDesaAction} kembali={kembali}>
          {dipilih && <input type="hidden" name="id" value={dipilih.id} />}
          <Bidang label="Kecamatan" wajib bantuan={dipilih ? "Memindah kecamatan juga memindah desa ini ke wilayah BPP lain." : undefined}>
            <select name="kecamatanId" defaultValue={kecAwal ?? ""} required className={kelasIn}>
              <option value="" disabled>Pilih kecamatan</option>
              {(kecs ?? []).map((k) => (
                <option key={k.id} value={k.id}>{k.nama} ({k.kode})</option>
              ))}
            </select>
          </Bidang>
          <Bidang label="Kode Kemendagri" wajib bantuan="10 angka, diawali kode kecamatannya (6 angka).">
            <input name="kode" defaultValue={kodeAwal} required inputMode="numeric" pattern="\d{10}" maxLength={10} className={kelasIn} />
          </Bidang>
          <Bidang label="Nama Desa" wajib bantuan="Tulis persis seperti di e-Pusluh.">
            <input name="nama" defaultValue={dipilih?.nama ?? ""} required maxLength={80} className={kelasIn} />
          </Bidang>
        </ModalForm>
      )}
    </>
  );
}
