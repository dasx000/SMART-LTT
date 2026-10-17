Map bulan Agu/Ags dihapus. Tanggal yang tersimpan sebagai teks seperti "Agustus 1, 2026" tidak bisa dibaca lagi, sehingga data Agustus itu tidak ikut dihitung di rekap padi. Angkanya jadi lebih kecil tanpa ada error. Bug ini hanya berdampak kalau sheet Anda menyimpan tanggal dalam bentuk teks dengan nama bulan. Kalau isinya sudah berformat tanggal atau dd/mm/yyyy, tidak ada dampaknya.

Key cache PM AAS tidak cocok. Setelah Admin Kab menyimpan target PM AAS, dashboard masih menampilkan target dan persentase capaian yang lama sampai 30 menit, kecuali di-refresh paksa. Datanya tidak rusak, hanya tampilannya yang telat.

Fallback komoditas di editLaporanBPP. Kalau baris palawija di Data_LTT kolom komoditasnya kosong lalu diedit, selisih luasnya akan tercatat di ringkasan Padi. Akibatnya angka dashboard Padi bisa sedikit melenceng. Ini jarang terjadi karena kolom komoditas biasanya terisi.
