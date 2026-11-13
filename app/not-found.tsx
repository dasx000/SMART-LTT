import Link from "next/link";

export default function TidakDitemukan() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-black text-primary">404</p>
      <h1 className="text-lg font-bold">Halaman tidak ditemukan</h1>
      <p className="text-sm text-muted">Alamat yang Anda buka tidak ada atau sudah dipindah.</p>
      <Link href="/" className="mt-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white">
        Kembali ke beranda
      </Link>
    </main>
  );
}
