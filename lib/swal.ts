"use client";

// Helper SweetAlert2. Pustaka dimuat saat pertama dipakai (bukan saat halaman dibuka)
// supaya JS awal halaman PPL tetap kecil (plan §2c).

type SwalModule = typeof import("sweetalert2");
let muat: Promise<SwalModule["default"]> | null = null;

function swal() {
  if (!muat) {
    muat = Promise.all([import("sweetalert2"), import("sweetalert2/dist/sweetalert2.min.css")]).then(
      ([m]) => m.default,
    );
  }
  return muat;
}

export async function sukses(judul: string, teks?: string) {
  const S = await swal();
  return S.fire({ icon: "success", title: judul, text: teks, timer: 1500, showConfirmButton: false });
}

export async function gagal(judul: string, teks?: string) {
  const S = await swal();
  return S.fire({ icon: "error", title: judul, text: teks, confirmButtonText: "Tutup" });
}

export async function peringatan(judul: string, teks?: string) {
  const S = await swal();
  return S.fire({ icon: "warning", title: judul, text: teks, confirmButtonText: "Oke" });
}

/** true jika user menekan "Ya". */
export async function konfirmasi(judul: string, teks?: string, tombolYa = "Ya, lanjutkan"): Promise<boolean> {
  const S = await swal();
  const r = await S.fire({
    icon: "question",
    title: judul,
    text: teks,
    showCancelButton: true,
    confirmButtonText: tombolYa,
    cancelButtonText: "Batal",
    reverseButtons: true,
  });
  return r.isConfirmed;
}

export async function memuat(judul = "Memproses...") {
  const S = await swal();
  S.fire({ title: judul, allowOutsideClick: false, allowEscapeKey: false, didOpen: () => S.showLoading() });
}

export async function tutup() {
  const S = await swal();
  S.close();
}
