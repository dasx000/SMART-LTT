import type { Metadata } from "next";
import Image from "next/image";
import { FormLogin } from "./form-login";

export const metadata: Metadata = { title: "Masuk" };

// Tampilan disamakan dengan aplikasi lama (_gas_lama/File_HTML_Login.html).
// Halaman statis (tanpa baca sesi) → tampil instan dari CDN.
export default function HalamanLogin() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-gray-100">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center">
            <Image src="/logo.webp" alt="" width={64} height={64} priority className="h-16 w-16 object-contain drop-shadow-md" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">SMART LTT CWS Way Kanan</h1>
          <p className="mt-1 text-xs text-gray-500">Kementerian Pertanian Republik Indonesia</p>
        </div>

        <FormLogin />

        <div className="mt-8 text-center">
          <p className="text-[10px] font-medium tracking-widest text-gray-400 uppercase">
            © 2026 &nbsp;·&nbsp;{" "}
            <a
              href="https://dasx000.github.io/portofolio/"
              target="_blank"
              rel="noopener noreferrer"
              className="tracking-normal normal-case transition hover:text-green-600"
            >
              Dev - dasx000
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
