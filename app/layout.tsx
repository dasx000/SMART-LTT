import type { Metadata, Viewport } from "next";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SMART LTT", template: "%s · SMART LTT" },
  description: "Pelaporan Luas Tambah Tanam (LTT) Padi, Jagung, dan Ubi Kayu.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#15803d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* Garis progres di atas layar saat pindah halaman (gaya YouTube) */}
        <NextTopLoader color="#15803d" height={3} showSpinner={false} shadow={false} />
        {children}
      </body>
    </html>
  );
}
