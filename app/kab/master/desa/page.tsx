import type { Metadata } from "next";
import { wajibRole } from "@/lib/auth";
import { KerangkaHalaman } from "@/components/kerangka-halaman";
import { supabaseServer } from "@/lib/supabase/server";
import { ModalForm } from "@/components/master/modal-form";
import { Bidang, Catatan, KepalaMaster, kelasIn } from "@/components/master/ui-master";
import { angkaParam, teksParam, urlDengan, type CariParam } from "@/lib/param";
import { simpanDesaAction } from "../actions";
import { TabelDesa } from "./tabel-desa";

export const metadata: Metadata = { title: "Master Desa — SMART LTT" };

export default function HalamanMasterDesa({ searchParams }: { searchParams: CariParam }) {
  return (
    <KerangkaHalaman judul="Master Desa" role={["admin_kab"]} gaya="kab">
      <Isi searchParams={searchParams} />
    </KerangkaHalaman>
  );
}

const DASAR = "/kab/master/desa";

async function Isi({ searchParams }: { searchParams: CariParam }) {
  await wajibRole("admin_kab");
  const q = await searchParams;
  const kec = angkaParam(q, "kecamatan", 1, 100000, 0);

  const s = await supabaseServer();
  const [{ data: kecs }, { data: desa, error }] = await Promise.all([
    s.from("kecamatan").select("id, kode, nama").order("nama"),
    s.from("desa").select("id, kode, nama, kecamatan_id").order("kode").limit(5000),
  ]);

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
        tambah={{ dasar: DASAR }}
        label="Tambah Desa"
      />
      <Catatan>
        Nama desa harus <b>persis sama dengan e-Pusluh</b> (huruf besar/kecil dan spasi berlebih diabaikan); kalau berbeda, laporan
        desa itu dilewati saat impor dan sinkron bot. Desa tidak bisa dihapus karena dipakai laporan, target, dan desa binaan.
      </Catatan>

      <TabelDesa
        dasar={DASAR}
        desa={desa ?? []}
        kecamatan={(kecs ?? []).map((k) => ({ id: k.id, nama: k.nama }))}
        galat={error?.message ?? null}
        awal={{ q: teksParam(q, "q") ?? "", kecamatan: kec, hal: angkaParam(q, "hal", 1, 100000, 1) }}
      />

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
