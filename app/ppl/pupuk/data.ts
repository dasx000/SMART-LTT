// Dosis pupuk bersubsidi per hektar — disalin dari aplikasi TANIKU (src/lib/pupuk-data.ts).
// Sumber: Panduan dosis pupuk bersubsidi, PT Pupuk Indonesia.
//
// Total per jenis pupuk dihitung otomatis lewat hitungTotalPerJenis() dari dosis per fase.
// Urutan array = urutan tampil di pilihan komoditas (A-Z).

export type JadwalPupuk = {
  waktu: string;
  keterangan?: string;
  // null = tidak diberikan pada fase ini
  dosisPerHaKg: Record<string, number | null>;
};

export type KomoditasPupuk = {
  id: string;
  nama: string;
  jenisPupuk: string[];
  jadwal: JadwalPupuk[];
};

export const KOMODITAS_PUPUK: KomoditasPupuk[] = [
  {
    id: "bawang-merah",
    nama: "Bawang Merah",
    jenisPupuk: ["Petroganik", "Phonska", "ZA"],
    jadwal: [
      { waktu: "Dasar", dosisPerHaKg: { Petroganik: 2000, Phonska: 450, ZA: null } },
      {
        waktu: "Susulan 1",
        keterangan: "15 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: 350, ZA: 100 },
      },
      {
        waktu: "Susulan 2",
        keterangan: "30 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: null, ZA: 300 },
      },
    ],
  },
  {
    id: "bawang-putih",
    nama: "Bawang Putih",
    jenisPupuk: ["Petroganik", "Phonska", "ZA"],
    jadwal: [
      { waktu: "Dasar", dosisPerHaKg: { Petroganik: 2000, Phonska: 400, ZA: null } },
      {
        waktu: "Susulan 1",
        keterangan: "20 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: 400, ZA: 50 },
      },
      {
        waktu: "Susulan 2",
        keterangan: "40 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: null, ZA: 350 },
      },
    ],
  },
  {
    id: "buncis-kacang-panjang",
    nama: "Buncis / Kacang Panjang",
    jenisPupuk: ["Petroganik", "Phonska"],
    jadwal: [
      { waktu: "Dasar", dosisPerHaKg: { Petroganik: 2000, Phonska: 150 } },
      { waktu: "Susulan 1", keterangan: "15 HST", dosisPerHaKg: { Petroganik: null, Phonska: 150 } },
      { waktu: "Susulan 2", keterangan: "30 HST", dosisPerHaKg: { Petroganik: null, Phonska: 150 } },
    ],
  },
  {
    id: "cabai",
    nama: "Cabai",
    jenisPupuk: ["Petroganik", "Phonska", "ZA"],
    jadwal: [
      { waktu: "Dasar", dosisPerHaKg: { Petroganik: 2000, Phonska: 400, ZA: null } },
      {
        waktu: "Susulan 1",
        keterangan: "20 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: 400, ZA: null },
      },
      {
        waktu: "Susulan 2",
        keterangan: "40 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: null, ZA: 200 },
      },
    ],
  },
  {
    id: "jagung",
    nama: "Jagung",
    jenisPupuk: ["Petroganik", "Phonska", "Urea"],
    jadwal: [
      { waktu: "Dasar", dosisPerHaKg: { Petroganik: 500, Phonska: 150, Urea: 75 } },
      {
        waktu: "Susulan 1",
        keterangan: "20 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: 150, Urea: 75 },
      },
      {
        waktu: "Susulan 2",
        keterangan: "35 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: null, Urea: 150 },
      },
    ],
  },
  {
    id: "kedele-kacang-tanah",
    nama: "Kedele / Kacang Tanah",
    jenisPupuk: ["Petroganik", "Phonska"],
    jadwal: [
      { waktu: "Dasar", dosisPerHaKg: { Petroganik: 500, Phonska: 125 } },
      { waktu: "Susulan 1", keterangan: "30 HST", dosisPerHaKg: { Petroganik: null, Phonska: 125 } },
    ],
  },
  {
    id: "kentang",
    nama: "Kentang",
    jenisPupuk: ["Petroganik", "Phonska", "ZA"],
    jadwal: [
      { waktu: "Dasar", dosisPerHaKg: { Petroganik: 2000, Phonska: 500, ZA: 100 } },
      {
        waktu: "Susulan 1",
        keterangan: "30 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: 500, ZA: 200 },
      },
    ],
  },
  {
    id: "kubis",
    nama: "Kubis",
    jenisPupuk: ["Petroganik", "Phonska", "ZA"],
    jadwal: [
      { waktu: "Dasar", dosisPerHaKg: { Petroganik: 2000, Phonska: 200, ZA: 50 } },
      {
        waktu: "Susulan 1",
        keterangan: "15 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: 200, ZA: 50 },
      },
      {
        waktu: "Susulan 2",
        keterangan: "30 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: null, ZA: 200 },
      },
    ],
  },
  {
    id: "mentimun",
    nama: "Mentimun",
    jenisPupuk: ["Petroganik", "Phonska"],
    jadwal: [
      { waktu: "Dasar", dosisPerHaKg: { Petroganik: 2000, Phonska: 100 } },
      { waktu: "Susulan 1", keterangan: "20 HST", dosisPerHaKg: { Petroganik: null, Phonska: 150 } },
      { waktu: "Susulan 2", keterangan: "35 HST", dosisPerHaKg: { Petroganik: null, Phonska: 150 } },
    ],
  },
  {
    id: "padi",
    nama: "Padi",
    jenisPupuk: ["Petroganik", "Phonska", "Urea"],
    jadwal: [
      { waktu: "Dasar", dosisPerHaKg: { Petroganik: 500, Phonska: 150, Urea: 50 } },
      {
        waktu: "Susulan 1",
        keterangan: "20 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: 150, Urea: 50 },
      },
      {
        waktu: "Susulan 2",
        keterangan: "35 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: null, Urea: 100 },
      },
    ],
  },
  {
    id: "tomat",
    nama: "Tomat",
    jenisPupuk: ["Petroganik", "Phonska", "ZA"],
    jadwal: [
      { waktu: "Dasar", dosisPerHaKg: { Petroganik: 2000, Phonska: 400, ZA: null } },
      {
        waktu: "Susulan 1",
        keterangan: "15 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: 400, ZA: null },
      },
      {
        waktu: "Susulan 2",
        keterangan: "30 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: null, ZA: 200 },
      },
    ],
  },
  {
    id: "terong",
    nama: "Terong",
    jenisPupuk: ["Petroganik", "Phonska", "ZA"],
    jadwal: [
      { waktu: "Dasar", dosisPerHaKg: { Petroganik: 2000, Phonska: 600, ZA: null } },
      {
        waktu: "Susulan 1",
        keterangan: "40 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: 100, ZA: 150 },
      },
    ],
  },
  {
    id: "ubi-jalar",
    nama: "Ubi Jalar",
    jenisPupuk: ["Petroganik", "Phonska", "Urea"],
    jadwal: [
      { waktu: "Dasar", dosisPerHaKg: { Petroganik: 500, Phonska: 150, Urea: 25 } },
      {
        waktu: "Susulan 1",
        keterangan: "30 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: 150, Urea: 75 },
      },
    ],
  },
  {
    id: "ubi-kayu",
    nama: "Ubi Kayu",
    jenisPupuk: ["Petroganik", "Phonska", "Urea"],
    jadwal: [
      { waktu: "Dasar", dosisPerHaKg: { Petroganik: 500, Phonska: 150, Urea: 25 } },
      {
        waktu: "Susulan 1",
        keterangan: "60 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: 150, Urea: 125 },
      },
    ],
  },
  {
    id: "wortel",
    nama: "Wortel",
    jenisPupuk: ["Petroganik", "Phonska", "ZA"],
    jadwal: [
      { waktu: "Dasar", dosisPerHaKg: { Petroganik: 2000, Phonska: 200, ZA: 50 } },
      {
        waktu: "Susulan 1",
        keterangan: "15 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: 200, ZA: 50 },
      },
      {
        waktu: "Susulan 2",
        keterangan: "30 HST",
        dosisPerHaKg: { Petroganik: null, Phonska: null, ZA: 200 },
      },
    ],
  },
];

export function hitungTotalPerJenis(komoditas: KomoditasPupuk, jenis: string): number {
  return komoditas.jadwal.reduce((sum, row) => sum + (row.dosisPerHaKg[jenis] ?? 0), 0);
}
