"use client";

export default function Galat({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Detail galat tidak ditampilkan ke user (hanya di log server).
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-lg font-bold">Terjadi kesalahan</h1>
      <p className="text-sm text-muted">Coba lagi sebentar. Jika terus berulang, hubungi admin.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white"
      >
        Coba lagi
      </button>
    </main>
  );
}
