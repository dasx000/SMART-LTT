"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { kirimPengingatSekarangAction, setelNotifPplAction, type HasilNotif } from "./actions";

export function SakelarNotifikasi({ awal }: { awal: boolean }) {
  const [aktif, setAktif] = useState(awal);
  const [hasil, setHasil] = useState<HasilNotif | null>(null);
  const [proses, mulai] = useTransition();
  const [kirim, mulaiKirim] = useTransition();

  function ubah() {
    const baru = !aktif;
    setHasil(null);
    mulai(async () => {
      const h = await setelNotifPplAction(baru);
      setHasil(h);
      if (h.sukses) setAktif(baru);
    });
  }

  function kirimSekarang() {
    setHasil(null);
    mulaiKirim(async () => setHasil(await kirimPengingatSekarangAction()));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-gray-800">Notifikasi PPL</p>
          <p className={`text-xs font-semibold ${aktif ? "text-green-700" : "text-gray-500"}`}>{aktif ? "AKTIF — pengingat dikirim ke PPL" : "NONAKTIF — tidak ada notifikasi ke PPL"}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={aktif}
          aria-label="Notifikasi PPL"
          onClick={ubah}
          disabled={proses}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition disabled:opacity-60 ${aktif ? "bg-green-600" : "bg-gray-300"}`}
        >
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition ${aktif ? "translate-x-7" : "translate-x-1"}`}>
            {proses && <LoaderCircle size={14} className="animate-spin text-gray-500" />}
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={kirimSekarang}
        disabled={!aktif || kirim}
        className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-cyan-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {kirim ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />} Kirim Pengingat Target Padi Sekarang
      </button>

      {hasil && (
        <p role={hasil.sukses ? "status" : "alert"} className={`rounded-lg px-4 py-3 text-xs font-medium ${hasil.sukses ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {hasil.pesan}
        </p>
      )}
    </div>
  );
}
