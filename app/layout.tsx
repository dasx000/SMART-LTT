import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";

// Font sama dengan aplikasi lama (Inter). Di-host sendiri oleh Next, tidak memanggil Google saat dibuka.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "SMART LTT", template: "%s · SMART LTT" },
  description: "Pelaporan Luas Tambah Tanam (LTT) Padi, Jagung, dan Ubi Kayu.",
  applicationName: "SMART LTT",
  // iPhone: "Tambah ke Layar Utama" → nama di bawah ikon + tampil tanpa bilah Safari
  appleWebApp: { capable: true, title: "SMART LTT", statusBarStyle: "default" },
  formatDetection: { telephone: false }, // NIP/angka panjang jangan dijadikan tautan telepon
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#15803d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Garis progres di atas layar saat pindah halaman (gaya YouTube) */}
        <NextTopLoader color="#f97316" height={4} showSpinner={false} shadow="0 0 10px #f97316,0 0 5px #fb923c" zIndex={9999} />
        {children}
      </body>
    </html>
  );
}
