const SPREADSHEET_ID = '1woRRTrpDvxeZfIvNCpQL77ZaIGeabTiKm8IVhYxaDDk';
const BACKUP_FOLDER_ID = '1UMfCG2ZwWt5VW5CmXPd_zoVjZqjRoiRF'; // Isi dengan ID folder backup di Google Drive

// =========================================================================
// FUNGSI AUTHENTICATION
// =========================================================================

function prosesLogin(nip, password) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'USER_' + nip;
  var cachedData = cache.get(cacheKey);

  if (cachedData) {
    var cached = JSON.parse(cachedData);
    var cachedPassword = (
      cached.password !== undefined
        ? cached.password
        : cached.pin !== undefined
          ? cached.pin
          : ''
    ).toString();
    if (cachedPassword === password.toString()) {
      return {
        status: 'success',
        data: cached.userData,
        url: ScriptApp.getService().getUrl(),
      };
    }
    cache.remove(cacheKey);
    return {
      status: 'error',
      message:
        'Password Salah (Sistem telah menyegarkan data, silakan coba lagi)',
    };
  }

  var sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_User');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][2].toString() === nip.toString()) {
      if (
        data[i][3].toString() === password.toString() &&
        data[i][7] === 'Aktif'
      ) {
        var userData = {
          id: data[i][0],
          nama: data[i][1],
          nip: data[i][2].toString(),
          role: data[i][4],
          kecamatan: data[i][5],
          desa: data[i][6],
        };
        var cacheEntry = {
          password: data[i][3].toString(),
          userData: userData,
        };
        cache.put(cacheKey, JSON.stringify(cacheEntry), 21600);
        return {
          status: 'success',
          data: userData,
          url: ScriptApp.getService().getUrl(),
        };
      }
    }
  }
  return { status: 'error', message: 'NIP tidak terdaftar atau akun nonaktif' };
}

// =========================================================================
// FUNGSI INPUT DATA LTT
// =========================================================================

function parseDecimal_(val) {
  if (val === null || val === undefined || val === '') return 0;
  return parseFloat(String(val).replace(',', '.')) || 0;
}

function submitLaporan(formData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Data_LTT');

    var timestamp = new Date();
    var idLaporan = 'LTT-' + timestamp.getTime() + '-' + formData.komoditas;

    sheet.appendRow([
      idLaporan,
      timestamp,
      formData.pelapor,
      formData.kecamatan,
      formData.desa,
      formData.komoditas,
      formData.jenis_ltt,
      formData.target_tanam,
      formData.target_panen,
      formData.luas_bera,
      formData.olah_lahan,
      formData.luas_tanam,
      formData.luas_panen,
      formData.keterangan,
      'Menunggu',
      '',
      '',
      formData.nip || '',
    ]);
    clearAllAppCaches();
    upsertRingkasan_(
      ss,
      Utilities.formatDate(timestamp, 'Asia/Jakarta', 'yyyy-MM-dd'),
      formData.komoditas,
      formData.jenis_ltt || '',
      parseFloat(formData.luas_tanam) || 0,
      parseFloat(formData.luas_panen) || 0,
    );
    return { status: 'success', id: idLaporan };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function editLaporan(idLaporan, formData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Data_LTT');

    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    var rowData = null;

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === idLaporan) {
        rowIndex = i + 1;
        rowData = data[i];
        break;
      }
    }

    if (rowIndex === -1) {
      return { status: 'error', message: 'Laporan tidak ditemukan.' };
    }

    if (rowData[14] !== 'Menunggu') {
      return {
        status: 'error',
        message: 'Hanya laporan dengan status Menunggu yang dapat diedit.',
      };
    }

    // Ambil nilai lama
    var oldTanam = parseFloat(rowData[11]) || 0;
    var oldPanen = parseFloat(rowData[12]) || 0;
    var oldKomoditas = rowData[5];
    var oldJenisLtt = rowData[6] || '';
    var timestamp =
      rowData[1] instanceof Date ? rowData[1] : new Date(rowData[1]);

    // Update cell
    var newTanam = parseFloat(formData.luas_tanam) || 0;
    var newPanen = parseFloat(formData.luas_panen) || 0;
    var newDesa = formData.desa;
    var newKeterangan = formData.keterangan || '-';

    sheet.getRange(rowIndex, 5).setValue(newDesa);
    sheet.getRange(rowIndex, 12).setValue(newTanam);
    sheet.getRange(rowIndex, 13).setValue(newPanen);
    sheet.getRange(rowIndex, 14).setValue(newKeterangan);

    // Update Ringkasan Harian (selisih nilai baru - nilai lama)
    upsertRingkasan_(
      ss,
      Utilities.formatDate(timestamp, 'Asia/Jakarta', 'yyyy-MM-dd'),
      oldKomoditas,
      oldJenisLtt,
      newTanam - oldTanam,
      newPanen - oldPanen,
    );

    clearAllAppCaches();
    return { status: 'success', id: idLaporan };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// FUNGSI ANTI-TYPO & DOUBLE CHECK (NAMA & DESA)
// =========================================================================

function bersihNama_(nama) {
  if (!nama) return '';
  // Normalisasi: huruf kecil, hapus gelar umum, hapus spasi/tanda baca/angka
  return nama
    .toString()
    .toLowerCase()
    .replace(
      /(,\s*(s\.?p|s\.?st|s\.?t|m\.?si|h\.?|m\.?pd|se|sh|ak|pt|dr|drh|ir))|(\.(s\.?p|s\.?st|s\.?t|m\.?si|h\.?|m\.?pd|se|sh|ak|pt|dr|drh|ir))/gi,
      '',
    )
    .replace(/[^a-z]/gi, '') // Ambil hanya huruf a-z
    .trim();
}

/**
 * Mengambil laporan PPL hari ini dengan pengecekan Nama (Anti-Typo) dan Desa (Binaan)
 */
function getLaporanPPLHariIni(namaUser, komoditas, daftarDesaUser) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Data_LTT');
    var data = sheet.getDataRange().getValues();

    // Gunakan zona waktu Jakarta untuk membandingkan tanggal hari ini
    var now = new Date();
    var todayStr = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyy-MM-dd');

    var namaTarget = bersihNama_(namaUser);
    var komTarget = komoditas.toString().toLowerCase().trim();

    // Pastikan daftarDesaUser adalah array yang sudah dibersihkan
    var listDesa = [];
    if (Array.isArray(daftarDesaUser)) {
      listDesa = daftarDesaUser.map(function (d) {
        return d.toString().toLowerCase().trim();
      });
    } else {
      listDesa = (daftarDesaUser || '')
        .toString()
        .split(',')
        .map(function (d) {
          return d.toLowerCase().trim();
        });
    }

    var hasil = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[1]) continue; // Lewati jika tidak ada timestamp (Kolom B)

      // Ambil tanggal dari kolom Timestamp
      var tglObj = row[1] instanceof Date ? row[1] : new Date(row[1]);
      var tglRowStr = Utilities.formatDate(
        tglObj,
        'Asia/Jakarta',
        'yyyy-MM-dd',
      );

      var namaRow = bersihNama_(row[2]);
      var desaRow = (row[4] || '').toString().toLowerCase().trim();
      var komRow = (row[5] || '').toString().toLowerCase().trim();

      // Pengecekan ganda yang lebih toleran
      if (
        tglRowStr === todayStr &&
        namaRow === namaTarget &&
        listDesa.indexOf(desaRow) !== -1 &&
        komRow === komTarget
      ) {
        var jam = Utilities.formatDate(tglObj, 'Asia/Jakarta', 'HH:mm');
        hasil.push({
          id: row[0],
          desa: row[4],
          tanam: row[11] || 0,
          panen: row[12] || 0,
          status: row[14] || 'Menunggu',
          jam: jam,
        });
      }
    }

    // Urutkan berdasarkan waktu terbaru (Jam)
    hasil.sort(function (a, b) {
      return b.jam.localeCompare(a.jam);
    });

    return { status: 'success', data: hasil };
  } catch (e) {
    console.error('Error getLaporanPPLHariIni: ' + e.toString());
    return { status: 'error', message: e.toString() };
  }
}

// =========================================================================
// FUNGSI BACKUP
// =========================================================================

function backupDatabaseHarian() {
  var file = DriveApp.getFileById(SPREADSHEET_ID);
  var folder = BACKUP_FOLDER_ID
    ? DriveApp.getFolderById(BACKUP_FOLDER_ID)
    : DriveApp.getFoldersByName('Backup_eLTT').hasNext()
      ? DriveApp.getFoldersByName('Backup_eLTT').next()
      : DriveApp.createFolder('Backup_eLTT');

  var namaBackup =
    'Backup_eLTT_' +
    Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd_HHmm');
  file.makeCopy(namaBackup, folder);

  // Hapus backup lama, pertahankan hanya 7 terbaru
  var semuaFile = [];
  var iter = folder.getFiles();
  while (iter.hasNext()) {
    var f = iter.next();
    if (f.getName().indexOf('Backup_eLTT_') === 0) {
      semuaFile.push(f);
    }
  }
  semuaFile.sort(function(a, b) {
    return b.getDateCreated() - a.getDateCreated();
  });
  for (var i = 7; i < semuaFile.length; i++) {
    semuaFile[i].setTrashed(true);
  }
}

// =========================================================================
// FUNGSI SINKRONISASI PADI (e-Pusluh) — sheet: Data_LTT_Padi
// =========================================================================

// =========================================================================
// UPDATE FUNGSI SINKRONISASI PADI (VERSI FIX BATCHING)
// =========================================================================

// =========================================================================
// UPDATE FUNGSI SINKRONISASI PADI (VERSI SMART OVERWRITE BY DATE)
// =========================================================================

function terimaSinkronPadi(dataArray, logData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // 1. PASTIKAN SHEET LOG ADA (Selalu cek di awal)
    var logSheet = ss.getSheetByName('Logs_Sinkron');
    if (!logSheet) {
      logSheet = ss.insertSheet('Logs_Sinkron');
      logSheet.appendRow([
        'ID_Sync',
        'Waktu_Sinkron',
        'Total_Tarik',
        'Data_Berisi',
        'Data_Nihil',
        'Tanggal_Laporan',
        'Status',
      ]);
      logSheet.getRange('A1:G1').setFontWeight('bold').setBackground('#fce5cd');
      logSheet.setFrozenRows(1);
    } else {
      // Validasi Header (Jika versi lama, paksa ganti ke versi baru 7 kolom)
      var currentHeader = logSheet.getRange(1, 1, 1, 7).getValues()[0];
      if (currentHeader[5] !== 'Tanggal_Laporan') {
        logSheet
          .getRange(1, 1, 1, 7)
          .setValues([
            [
              'ID_Sync',
              'Waktu_Sinkron',
              'Total_Tarik',
              'Data_Berisi',
              'Data_Nihil',
              'Tanggal_Laporan',
              'Status',
            ],
          ]);
        logSheet
          .getRange('A1:G1')
          .setFontWeight('bold')
          .setBackground('#fce5cd');
      }
    }

    // 2. CATAT LOG JIKA DATA ADA
    if (logData) {
      logSheet.appendRow([
        logData.idSync || 'N/A',
        logData.waktuSinkron || new Date(),
        logData.totalTarik || 0,
        logData.dataBerisi || 0,
        logData.dataNihil || 0,
        logData.tanggalLaporan || '-',
        'Sukses (Injeksi)',
      ]);
    } else {
      logSheet.appendRow([
        'Manual/Unknown',
        new Date(),
        dataArray ? dataArray.length : 0,
        '?',
        '?',
        '-',
        'Sukses (Tanpa LogData)',
      ]);
    }

    var PADI_HEADER = [
      'ID_Laporan', 'Waktu_Lapor', 'Pelapor', 'Kecamatan', 'Desa',
      'Komoditas', 'Jenis_LTT', 'Target_Tanam_Bln_Ini', 'Target_Panen_Bln_Ini',
      'Luas_Lahan_Bera', 'Realisasi_Olah_Lahan', 'Realisasi_Luas_Tanam',
      'Realisasi_Luas_Panen', 'Keterangan', 'Status_Verifikasi',
      'Waktu_Verifikasi_BPP', 'Waktu_Verifikasi_Kab',
    ];

    // Tentukan sheet tujuan dari logData.tanggalLaporan (satu nilai sudah cukup, tak perlu scan semua baris)
    var BULAN_MAP = {
      Jan:1, Feb:2, Mar:3, Apr:4, Mei:5, Jun:6, Jul:7,
      Agu:8, Ags:8, Aug:8, Sep:9, Okt:10, Oct:10, Nov:11, Des:12, Dec:12
    };
    var tglRef = (logData && logData.tanggalLaporan)
      ? String(logData.tanggalLaporan)
      : (dataArray && dataArray.length > 0 ? String(dataArray[0][1]) : '');
    var now = new Date();
    var targetSheetName = 'Data_LTT_Padi';
    var mRef = tglRef.match(/(\w{3})\w*\s+\d+,\s+(\d{4})/);
    if (mRef) {
      var bln = BULAN_MAP[mRef[1]];
      var thn = parseInt(mRef[2]);
      if (bln && thn && (bln - 1 !== now.getMonth() || thn !== now.getFullYear())) {
        targetSheetName = 'Data_LTT_Padi_' + thn + '_' + (bln < 10 ? '0' + bln : String(bln));
      }
    }

    // Parse tanggal unik untuk logika dedup (hapus baris lama bertanggal sama sebelum insert)
    var uniqueDatesToReplace = [
      ...new Set(
        dataArray
          .map(function (r) {
            var t = parseTanggalEPusluh_(r[1]);
            return t ? Utilities.formatDate(t, 'Asia/Jakarta', 'yyyy-MM-dd') : '';
          })
          .filter(Boolean),
      ),
    ];

    var sheet = ss.getSheetByName(targetSheetName);
    if (!sheet) {
      sheet = ss.insertSheet(targetSheetName);
      sheet.appendRow(PADI_HEADER);
      sheet.setFrozenRows(1);
    }

    // 2. Ambil semua data yang ada di Sheet saat ini
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var allData = sheet.getRange(2, 1, lastRow - 1, 17).getValues();

      // 3. Filter: Buang data lama yang tanggalnya cocok dengan data baru
      var dataTetap = allData.filter(function (row) {
        var t = parseTanggalEPusluh_(row[1]);
        var tglSheet = t
          ? Utilities.formatDate(t, 'Asia/Jakarta', 'yyyy-MM-dd')
          : '';
        return !uniqueDatesToReplace.includes(tglSheet);
      });

      // 4. Gabungkan data yang tetap dengan data yang baru ditarik
      var finalData = dataTetap.concat(dataArray);

      // 5. Bersihkan isi sheet (kecuali header) dan tulis ulang semuanya
      sheet.getRange(2, 1, sheet.getLastRow(), 17).clearContent();
      if (finalData.length > 0) {
        sheet
          .getRange(2, 1, finalData.length, finalData[0].length)
          .setValues(finalData);
      }
    } else {
      // Jika sheet masih kosong, langsung masukkan saja
      if (dataArray.length > 0) {
        sheet
          .getRange(2, 1, dataArray.length, dataArray[0].length)
          .setValues(dataArray);
      }
    }

    rebuiltPadiRingkasan_(ss, dataArray);
    clearAllAppCaches();
    return { status: 'success', inserted: dataArray.length };
  } catch (e) {
    if (logData) {
      var logSheetErr = ss.getSheetByName('Logs_Sinkron');
      if (logSheetErr)
        logSheetErr.appendRow([
          logData.idSync,
          logData.waktuSinkron,
          logData.totalTarik,
          logData.dataBerisi,
          logData.dataNihil,
          logData.tanggalLaporan || '-',
          'Error: ' + e.toString(),
        ]);
    }
    return { status: 'error', message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function getLogsSinkron() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Logs_Sinkron');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var logs = [];
  for (var i = 1; i < data.length; i++) {
    var waktu = data[i][1];
    var tglLaporan = data[i][5];

    // Konversi Date object ke string agar bisa terserialisasi lewat google.script.run
    if (waktu instanceof Date) {
      waktu = waktu.toISOString();
    } else {
      waktu = waktu ? waktu.toString() : '';
    }
    if (tglLaporan instanceof Date) {
      tglLaporan = Utilities.formatDate(
        tglLaporan,
        'Asia/Jakarta',
        'dd MMMM yyyy HH:mm',
      );
    } else {
      tglLaporan = tglLaporan ? tglLaporan.toString() : '-';
    }

    logs.push({
      idSync: data[i][0] ? data[i][0].toString() : 'N/A',
      waktuSinkron: waktu,
      totalTarik: Number(data[i][2]) || 0,
      dataBerisi: Number(data[i][3]) || 0,
      dataNihil: Number(data[i][4]) || 0,
      tanggalLaporan: tglLaporan,
      status: data[i][6] ? data[i][6].toString() : '',
    });
  }
  // Sort by waktuSinkron descending (newest first)
  logs.sort(function (a, b) {
    var dateA = new Date(a.waktuSinkron);
    var dateB = new Date(b.waktuSinkron);
    return dateB - dateA;
  });
  return logs;
}

function cekStatusPadiHarian(daftarDesaUser) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Data_LTT_Padi');
  if (!sheet) return { status: 'belum', rows: [] };
  var listDesa = Array.isArray(daftarDesaUser)
    ? daftarDesaUser.map(function (d) {
        return d.toString().toLowerCase().trim();
      })
    : (daftarDesaUser || '')
        .toString()
        .split(',')
        .map(function (d) {
          return d.toLowerCase().trim();
        });
  var data = sheet.getDataRange().getValues();
  var hariIni = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy');
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var dp = parseTanggalEPusluh_(data[i][1]);
    if (!dp) continue;
    var tgl = Utilities.formatDate(dp, 'Asia/Jakarta', 'dd/MM/yyyy');
    if (
      tgl === hariIni &&
      listDesa.indexOf(data[i][4].toString().toLowerCase().trim()) !== -1
    ) {
      rows.push({
        desa: data[i][4],
        jenis_ltt: data[i][6] || 'Padi',
        tanam: parseFloat(data[i][11]) || 0,
        panen: parseFloat(data[i][12]) || 0,
      });
    }
  }
  return rows.length > 0
    ? { status: 'sudah', rows: rows }
    : { status: 'belum', rows: [] };
}

// =========================================================================
// FUNGSI VERIFIKASI ADMIN
// =========================================================================

function prosesVerifikasiMassal(idLaporanArray, roleAdmin) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Data_LTT');
    var data = sheet.getDataRange().getValues();
    var timestamp = new Date();

    var statusBaru =
      roleAdmin === 'Admin_Kab'
        ? 'Terverifikasi Kabupaten'
        : 'Terverifikasi BPP';
    var kolomWaktu = roleAdmin === 'Admin_Kab' ? 16 : 15;

    // Build lookup map O(n) — lebih efisien dari nested loop O(n×m)
    var idToRow = {};
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) idToRow[data[i][0].toString()] = i + 1; // simpan row number (1-indexed)
    }
    idLaporanArray.forEach(function (id) {
      var rowNum = idToRow[id.toString()];
      if (!rowNum) return;
      sheet.getRange(rowNum, 15).setValue(statusBaru);
      sheet.getRange(rowNum, kolomWaktu + 1).setValue(timestamp);
    });

    clearAllAppCaches();
    return { status: 'success', count: idLaporanArray.length };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// FUNGSI DATA DASHBOARD
// =========================================================================

// Gabung Data_LTT + Data_LTT_Padi, archive-aware (tanpa param = bulan berjalan)
function getAllLTTRows_(bulan0, tahun) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var now = new Date();
  var isPast =
    bulan0 !== undefined &&
    tahun !== undefined &&
    (bulan0 !== now.getMonth() || tahun !== now.getFullYear());
  var namaLTT, namaPadi;
  if (isPast) {
    var sfx =
      tahun +
      '_' +
      Utilities.formatDate(new Date(tahun, bulan0, 1), 'Asia/Jakarta', 'MM');
    namaLTT = 'Data_LTT_' + sfx;
    namaPadi = 'Data_LTT_Padi_' + sfx;
  } else {
    namaLTT = 'Data_LTT';
    namaPadi = 'Data_LTT_Padi';
  }
  var shLTT = ss.getSheetByName(namaLTT);
  var rows =
    shLTT && shLTT.getLastRow() > 1
      ? shLTT.getDataRange().getValues()
      : [new Array(17).fill('')];
  var sp = ss.getSheetByName(namaPadi);
  if (sp && sp.getLastRow() > 1) {
    var pr = sp.getDataRange().getValues();
    for (var i = 1; i < pr.length; i++) rows.push(pr[i]);
  }
  return rows;
}

function getDashboardKab(params) {
  var now = new Date();
  var filterTanggal = params && params.tanggal ? params.tanggal : null;
  var bulanFilter = params && params.bulan ? params.bulan - 1 : now.getMonth();
  var tahunFilter = params && params.tahun ? params.tahun : now.getFullYear();

  var cache = CacheService.getScriptCache();
  var version = cache.get('DB_VERSION') || '1';
  var cacheKey =
    'DASH_KAB_V' +
    version +
    '_' +
    (filterTanggal ? filterTanggal : tahunFilter + '_' + bulanFilter);
  var cached = cache.get(cacheKey);
  if (cached && !(params && params.forceRefresh)) return JSON.parse(cached);

  if (params && params.forceRefresh) {
    try {
      rekalkulasiRingkasan();
      clearAllAppCaches();
      // Re-read version after cache clearing
      version = cache.get('DB_VERSION') || '1';
      cacheKey =
        'DASH_KAB_V' +
        version +
        '_' +
        (filterTanggal ? filterTanggal : tahunFilter + '_' + bulanFilter);
    } catch (e) {
      // ignore
    }
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Anchor tren: hari ini untuk bulan berjalan, hari terakhir bulan untuk arsip
  var anchor = now;
  if (bulanFilter !== now.getMonth() || tahunFilter !== now.getFullYear()) {
    anchor = new Date(tahunFilter, bulanFilter + 1, 0);
  }

  // Peta ISO → label dd/MM untuk chart tren
  var trenLabels = [];
  var isoToLabel = {};
  for (var d = 6; d >= 0; d--) {
    var dt = new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      anchor.getDate() - d,
    );
    var label = Utilities.formatDate(dt, 'Asia/Jakarta', 'dd/MM');
    var iso = Utilities.formatDate(dt, 'Asia/Jakarta', 'yyyy-MM-dd');
    trenLabels.push(label);
    isoToLabel[iso] = label;
  }
  var trenMap = {};
  trenLabels.forEach(function (l) {
    trenMap[l] = { Padi: 0, Jagung: 0, 'Ubi Kayu': 0 };
  });

  var komposisiTanam = { Padi: 0, Jagung: 0, 'Ubi Kayu': 0 };
  var komposisiPanen = { Padi: 0, Jagung: 0, 'Ubi Kayu': 0 };
  var breakdownPadi = { tanam: {}, panen: {} };

  // === PATH CEPAT: Ringkasan_Harian untuk PADI saja ===
  // Jagung/Ubi Kayu dibaca langsung dari Data_LTT (lihat blok di bawah)
  var sheetRK = ss.getSheetByName('Ringkasan_Harian');
  var padiAda = false;
  if (sheetRK && sheetRK.getLastRow() > 1) {
    var rkData = sheetRK.getDataRange().getValues();
    for (var i = 1; i < rkData.length; i++) {
      var rawTgl = rkData[i][0];
      var tglStr =
        rawTgl instanceof Date
          ? Utilities.formatDate(rawTgl, 'Asia/Jakarta', 'yyyy-MM-dd')
          : (rawTgl || '').toString();
      if (!tglStr || tglStr.indexOf('-') < 0) continue;

      var kom = (rkData[i][1] || '').toString();
      if (kom !== 'Padi') continue; // Palawija dibaca dari Data_LTT, bukan dari sini

      if (filterTanggal) {
        if (tglStr !== filterTanggal) continue;
      } else {
        var p = tglStr.split('-');
        if (
          parseInt(p[1]) - 1 !== bulanFilter ||
          parseInt(p[0]) !== tahunFilter
        )
          continue;
      }
      padiAda = true;
      var jen = (rkData[i][2] || '').toString();
      var tam = parseFloat(rkData[i][3]) || 0;
      var pan = parseFloat(rkData[i][4]) || 0;
      komposisiTanam['Padi'] += tam;
      komposisiPanen['Padi'] += pan;
      if (jen) {
        breakdownPadi.tanam[jen] = (breakdownPadi.tanam[jen] || 0) + tam;
        breakdownPadi.panen[jen] = (breakdownPadi.panen[jen] || 0) + pan;
      }
      if (isoToLabel[tglStr]) {
        trenMap[isoToLabel[tglStr]]['Padi'] += tam;
      }
    }
  }

  // === FALLBACK PADI: jika Ringkasan_Harian belum punya data Padi bulan ini ===
  if (!padiAda) {
    var shPadi = ss.getSheetByName('Data_LTT_Padi');
    if (shPadi && shPadi.getLastRow() > 1) {
      var padiRows = shPadi.getDataRange().getValues();
      for (var ri = 1; ri < padiRows.length; ri++) {
        if (!padiRows[ri][1]) continue;
        var tgl = parseTanggalEPusluh_(padiRows[ri][1]);
        if (!tgl) continue;
        var tglFb = Utilities.formatDate(tgl, 'Asia/Jakarta', 'yyyy-MM-dd');
        if (filterTanggal) {
          if (tglFb !== filterTanggal) continue;
        } else {
          var fbM =
            parseInt(Utilities.formatDate(tgl, 'Asia/Jakarta', 'MM')) - 1;
          var fbY = parseInt(Utilities.formatDate(tgl, 'Asia/Jakarta', 'yyyy'));
          if (fbM !== bulanFilter || fbY !== tahunFilter) continue;
        }
        var rJen = (padiRows[ri][6] || '').toString();
        var rTam = parseFloat(padiRows[ri][11]) || 0;
        var rPan = parseFloat(padiRows[ri][12]) || 0;
        komposisiTanam['Padi'] += rTam;
        komposisiPanen['Padi'] += rPan;
        if (rJen) {
          breakdownPadi.tanam[rJen] = (breakdownPadi.tanam[rJen] || 0) + rTam;
          breakdownPadi.panen[rJen] = (breakdownPadi.panen[rJen] || 0) + rPan;
        }
        var rkLabel = Utilities.formatDate(tgl, 'Asia/Jakarta', 'dd/MM');
        if (trenMap[rkLabel]) trenMap[rkLabel]['Padi'] += rTam;
      }
    }
  }

  // === JAGUNG & UBI KAYU: dari sheet arsip jika bulan lalu, dari Data_LTT jika bulan ini ===
  var namaSheetJagung =
    bulanFilter !== now.getMonth() || tahunFilter !== now.getFullYear()
      ? 'Data_LTT_' +
        tahunFilter +
        '_' +
        Utilities.formatDate(
          new Date(tahunFilter, bulanFilter, 1),
          'Asia/Jakarta',
          'MM',
        )
      : 'Data_LTT';
  var shLTT = ss.getSheetByName(namaSheetJagung);
  if (shLTT && shLTT.getLastRow() > 1) {
    var lttRows = shLTT.getDataRange().getValues();
    for (var li = 1; li < lttRows.length; li++) {
      if (!lttRows[li][1]) continue;
      var ltTgl = parseTanggalEPusluh_(lttRows[li][1]);
      if (!ltTgl) continue;
      var ltKomRaw = (lttRows[li][5] || '').toString().trim().toLowerCase();
      var ltKom = '';
      if (ltKomRaw === 'jagung') ltKom = 'Jagung';
      else if (ltKomRaw === 'ubi kayu' || ltKomRaw === 'ubi_kayu')
        ltKom = 'Ubi Kayu';
      else continue;
      var ltTglStr = Utilities.formatDate(ltTgl, 'Asia/Jakarta', 'yyyy-MM-dd');
      if (filterTanggal) {
        if (ltTglStr !== filterTanggal) continue;
      } else {
        var ltM =
          parseInt(Utilities.formatDate(ltTgl, 'Asia/Jakarta', 'MM')) - 1;
        var ltY = parseInt(Utilities.formatDate(ltTgl, 'Asia/Jakarta', 'yyyy'));
        if (ltM !== bulanFilter || ltY !== tahunFilter) continue;
      }
      var ltTam = parseFloat(lttRows[li][11]) || 0;
      var ltPan = parseFloat(lttRows[li][12]) || 0;
      komposisiTanam[ltKom] += ltTam;
      komposisiPanen[ltKom] += ltPan;
      var ltLabel = Utilities.formatDate(ltTgl, 'Asia/Jakarta', 'dd/MM');
      if (trenMap[ltLabel] && trenMap[ltLabel].hasOwnProperty(ltKom)) {
        trenMap[ltLabel][ltKom] += ltTam;
      }
    }
  }

  // === STATUS COUNTS: baca dari arsip atau Data_LTT aktif tergantung bulan ===
  var countTotal = 0,
    countVerified = 0,
    countMenunggu = 0;
  var namaLttSheet =
    bulanFilter !== now.getMonth() || tahunFilter !== now.getFullYear()
      ? 'Data_LTT_' +
        tahunFilter +
        '_' +
        Utilities.formatDate(
          new Date(tahunFilter, bulanFilter, 1),
          'Asia/Jakarta',
          'MM',
        )
      : 'Data_LTT';
  var lttSheet = ss.getSheetByName(namaLttSheet);
  if (lttSheet && lttSheet.getLastRow() > 1) {
    var lttData = lttSheet.getDataRange().getValues();
    for (var li = 1; li < lttData.length; li++) {
      if (!lttData[li][1]) continue;
      var ltTgl = parseTanggalEPusluh_(lttData[li][1]);
      if (!ltTgl) continue;
      var ltSt = (lttData[li][14] || '').toString();
      if (
        ltTgl.getMonth() === bulanFilter &&
        ltTgl.getFullYear() === tahunFilter
      ) {
        countTotal++;
        if (ltSt === 'Terverifikasi Kabupaten') countVerified++;
      }
      if (ltSt === 'Terverifikasi BPP') countMenunggu++;
    }
  }

  // Pembulatan
  ['Padi', 'Jagung', 'Ubi Kayu'].forEach(function (k) {
    komposisiTanam[k] = Math.round(komposisiTanam[k] * 100) / 100;
    komposisiPanen[k] = Math.round(komposisiPanen[k] * 100) / 100;
  });
  for (var bk in breakdownPadi.tanam) {
    breakdownPadi.tanam[bk] = Math.round(breakdownPadi.tanam[bk] * 100) / 100;
    breakdownPadi.panen[bk] = Math.round(breakdownPadi.panen[bk] * 100) / 100;
  }

  var result = {
    totalTanam:
      Math.round(
        (komposisiTanam['Padi'] +
          komposisiTanam['Jagung'] +
          komposisiTanam['Ubi Kayu']) *
          100,
      ) / 100,
    totalPanen:
      Math.round(
        (komposisiPanen['Padi'] +
          komposisiPanen['Jagung'] +
          komposisiPanen['Ubi Kayu']) *
          100,
      ) / 100,
    pctVerified:
      countTotal > 0 ? Math.round((countVerified / countTotal) * 100) : 0,
    countMenunggu: countMenunggu,
    trenLabels: trenLabels,
    trenPadi: trenLabels.map(function (l) {
      return Math.round(trenMap[l].Padi * 100) / 100;
    }),
    trenJagung: trenLabels.map(function (l) {
      return Math.round(trenMap[l].Jagung * 100) / 100;
    }),
    trenUbiKayu: trenLabels.map(function (l) {
      return Math.round(trenMap[l]['Ubi Kayu'] * 100) / 100;
    }),
    komposisiTanam: komposisiTanam,
    komposisiPanen: komposisiPanen,
    breakdownPadi: breakdownPadi,
    komposisi: [
      komposisiTanam['Padi'],
      komposisiTanam['Jagung'],
      komposisiTanam['Ubi Kayu'],
    ],
  };
  var ttl =
    bulanFilter !== now.getMonth() || tahunFilter !== now.getFullYear()
      ? 1800
      : 300;
  cache.put(cacheKey, JSON.stringify(result), ttl);
  return result;
}

function getAntreanKabupaten(komoditas, tanggal) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheetUser = ss.getSheetByName('Data_User');
  var users = sheetUser.getDataRange().getValues();
  var data = getAllLTTRows_();

  // komoditas: 'Jagung' | 'Ubi Kayu' (wajib, tidak ada combined)
  var filterKom = (komoditas || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  // tanggal: 'YYYY-MM-DD' dari HTML date input, kosong = semua tanggal
  var filterTgl = (tanggal || '').toString().trim();

  // Bangun map hanya dari kecamatan yg punya Penyuluh/Admin_BPP aktif
  var kecMap = {};
  for (var j = 1; j < users.length; j++) {
    var role = (users[j][4] || '').toString().trim();
    var status = (users[j][7] || '').toString().trim();
    if (role !== 'Penyuluh' && role !== 'Admin_BPP') continue;
    if (status !== 'Aktif') continue;
    var kec = (users[j][5] || '').toString().trim();
    if (kec && !kecMap[kec]) {
      kecMap[kec] = {
        totalLaporan: 0,
        belumBPP: 0,
        siapVerif: 0,
        sudahKab: 0,
        totalTanam: 0,
        totalPanen: 0,
        ids: [],
      };
    }
  }

  var countTotal = 0,
    countVerified = 0;
  for (var i = 1; i < data.length; i++) {
    if (!data[i][1]) continue;
    var tgl = new Date(data[i][1]);
    if (isNaN(tgl.getTime())) continue;

    // Filter tanggal jika diisi
    if (filterTgl) {
      var tglStr = Utilities.formatDate(tgl, 'Asia/Jakarta', 'yyyy-MM-dd');
      if (tglStr !== filterTgl) continue;
    }

    var kec = (data[i][3] || '').toString().trim();
    var komRaw = (data[i][5] || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/_/g, ' ');
    var status = (data[i][14] || '').toString();
    var id = (data[i][0] || '').toString();

    // Padi ditangani ePusluh, skip dari tab verifikasi ini
    if (komRaw === 'padi') continue;
    // Filter komoditas
    if (filterKom && komRaw !== filterKom) continue;

    if (status) countTotal++;
    if (status === 'Terverifikasi Kabupaten') countVerified++;
    if (!kecMap[kec]) continue;
    kecMap[kec].totalLaporan++;
    kecMap[kec].totalTanam += parseFloat(data[i][11]) || 0;
    kecMap[kec].totalPanen += parseFloat(data[i][12]) || 0;
    if (status === 'Menunggu') kecMap[kec].belumBPP++;
    else if (status === 'Terverifikasi BPP') {
      kecMap[kec].siapVerif++;
      kecMap[kec].ids.push(id);
    } else if (status === 'Terverifikasi Kabupaten') kecMap[kec].sudahKab++;
  }

  var kecList = Object.keys(kecMap)
    .sort()
    .map(function (nama) {
      return {
        nama: nama,
        totalLaporan: kecMap[nama].totalLaporan,
        belumBPP: kecMap[nama].belumBPP,
        siapVerif: kecMap[nama].siapVerif,
        sudahKab: kecMap[nama].sudahKab,
        totalTanam: Math.round(kecMap[nama].totalTanam * 100) / 100,
        totalPanen: Math.round(kecMap[nama].totalPanen * 100) / 100,
        ids: kecMap[nama].ids,
      };
    });

  return {
    kecList: kecList,
    countMenunggu: kecList.reduce(function (s, k) {
      return s + k.siapVerif;
    }, 0),
    pctVerified:
      countTotal > 0 ? Math.round((countVerified / countTotal) * 100) : 0,
  };
}

function getDashboardBPP(kecamatan) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheetUser = ss.getSheetByName('Data_User');
  var users = sheetUser.getDataRange().getValues();
  var data = getAllLTTRows_();
  var hariIni = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy');

  var semuaPPL = [];
  for (var j = 1; j < users.length; j++) {
    if (
      (users[j][4] === 'Penyuluh' || users[j][4] === 'Admin_BPP') &&
      users[j][5] === kecamatan &&
      users[j][7] === 'Aktif'
    ) {
      semuaPPL.push(users[j][1].toString());
    }
  }

  var pplSudahLapor = [];
  var laporanHariIni = 0;
  var laporanMenunggu = [];

  for (var i = 1; i < data.length; i++) {
    if (!data[i][1]) continue;
    var tgl = new Date(data[i][1]);
    if (isNaN(tgl.getTime())) continue;
    if ((data[i][3] || '').toString() !== kecamatan) continue;

    var tglStr = Utilities.formatDate(tgl, 'Asia/Jakarta', 'dd/MM/yyyy');
    var status = (data[i][14] || '').toString();
    var pelapor = (data[i][2] || '').toString();
    var komoditas = (data[i][5] || '').toString();
    var tanam = parseFloat(data[i][11]) || 0;
    var panen = parseFloat(data[i][12]) || 0;

    if (tglStr === hariIni) {
      laporanHariIni++;
      if (komoditas !== 'Padi' && pplSudahLapor.indexOf(pelapor) === -1) {
        pplSudahLapor.push(pelapor);
      }
    }

    if (status === 'Menunggu' && tglStr === hariIni) {
      laporanMenunggu.push([
        (data[i][0] || '').toString(),
        Utilities.formatDate(tgl, 'Asia/Jakarta', 'dd/MM/yyyy'),
        pelapor,
        (data[i][4] || '').toString(),
        komoditas,
        Math.round(tanam * 100) / 100,
        Math.round(panen * 100) / 100,
        (data[i][13] || '-').toString(),
      ]);
    }
  }

  var pplBelumLapor = semuaPPL.filter(function (nama) {
    return pplSudahLapor.indexOf(nama) === -1;
  });

  return {
    laporanHariIni: laporanHariIni,
    countMenunggu: laporanMenunggu.length,
    sudahLapor: pplSudahLapor.length,
    totalPPL: semuaPPL.length,
    pplBelumLapor: pplBelumLapor,
    laporanMenunggu: laporanMenunggu,
  };
}

// =========================================================================
// FUNGSI EDIT LAPORAN OLEH BPP
// =========================================================================
function editLaporanBPP(
  id,
  luasTanam,
  luasPanen,
  keterangan,
  luasBera,
  olahLahan,
) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetNames = ['Data_LTT', 'Data_LTT_Padi'];
    for (var s = 0; s < sheetNames.length; s++) {
      var sheet = ss.getSheetByName(sheetNames[s]);
      if (!sheet) continue;
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0].toString() === id.toString()) {
          if (luasBera !== undefined && luasBera !== null) {
            sheet.getRange(i + 1, 10).setValue(parseFloat(luasBera) || 0);
          }
          if (olahLahan !== undefined && olahLahan !== null) {
            sheet.getRange(i + 1, 11).setValue(parseFloat(olahLahan) || 0);
          }
          sheet.getRange(i + 1, 12).setValue(parseFloat(luasTanam) || 0);
          sheet.getRange(i + 1, 13).setValue(parseFloat(luasPanen) || 0);
          sheet.getRange(i + 1, 14).setValue(keterangan || '');
          clearAllAppCaches();
          return { status: 'success' };
        }
      }
    }
    return { status: 'error', message: 'Data tidak ditemukan' };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// FUNGSI TARGET PER PPL (untuk BPP)
// =========================================================================
function ambilTargetPerPPL(bulan, komoditas, kecamatan) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetUser = ss.getSheetByName('Data_User');
    var users = sheetUser.getDataRange().getValues();

    var daftarPPL = [];
    for (var j = 1; j < users.length; j++) {
      var role = users[j][4];
      var kec = users[j][5];
      var status = users[j][7];
      if (
        (role === 'Penyuluh' || role === 'Admin_BPP') &&
        kec === kecamatan &&
        status === 'Aktif'
      ) {
        daftarPPL.push({
          id: users[j][0].toString(),
          nama: users[j][1].toString(),
          desa: users[j][6].toString(),
        });
      }
    }

    var desaTargets = getDesaTargets_(ss, parseInt(bulan), komoditas);

    var desaMap = {};
    var desaPanenMap = {};
    desaTargets.forEach(function (t) {
      if (t.kecamatan === kecamatan) {
        var key = t.namaGeografi.toLowerCase().trim();
        desaMap[key] = (desaMap[key] || 0) + t.totalTarget;
        desaPanenMap[key] =
          (desaPanenMap[key] || 0) + (t.totalTargetPanen || 0);
      }
    });

    daftarPPL.forEach(function (ppl) {
      var total = 0;
      var totalPanen = 0;
      if (ppl.desa) {
        ppl.desa.split(',').forEach(function (d) {
          var key = d.trim().toLowerCase();
          if (desaMap[key]) total += desaMap[key];
          if (desaPanenMap[key]) totalPanen += desaPanenMap[key];
        });
      }
      ppl.totalTarget = Math.round(total * 100) / 100;
      ppl.totalTargetPanen = Math.round(totalPanen * 100) / 100;
    });

    return daftarPPL;
  } catch (e) {
    console.error('ambilTargetPerPPL: ' + e.toString());
    return [];
  }
}

// =========================================================================
// FUNGSI REKAP PADI HARIAN (e-Pusluh)
// =========================================================================

var spreadsheetTimeZone = null;

// Parse tanggal dari e-Pusluh: "Mei 6, 2026 06:50:10" atau Date object
function parseTanggalEPusluh_(val) {
  if (!val) return null;

  // Jika tipe data adalah Date object, konversi ke string yyyy-MM-dd berdasarkan timezone spreadsheet
  // lalu buat objek Date baru lokal pada jam 00:00:00 untuk menghindari pergeseran timezone
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    try {
      if (!spreadsheetTimeZone) {
        spreadsheetTimeZone =
          SpreadsheetApp.openById(SPREADSHEET_ID).getSpreadsheetTimeZone();
      }
      var dateStr = Utilities.formatDate(
        val,
        spreadsheetTimeZone,
        'yyyy-MM-dd',
      );
      var parts = dateStr.split('-');
      return new Date(
        parseInt(parts[0]),
        parseInt(parts[1]) - 1,
        parseInt(parts[2]),
      );
    } catch (e) {
      return isNaN(val.getTime()) ? null : val;
    }
  }

  // 1. Cek format DD/MM/YYYY atau MM/DD/YYYY (mendeteksi secara dinamis jika bagian bulan > 12)
  var mDMY = val.toString().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (mDMY) {
    var p1 = parseInt(mDMY[1]);
    var p2 = parseInt(mDMY[2]);
    var y = parseInt(mDMY[3]);

    // Jika angka kedua > 12, maka formatnya adalah MM/DD/YYYY (contoh: 5/19/2026)
    if (p2 > 12) {
      return new Date(y, p1 - 1, p2);
    }
    // Jika angka pertama > 12, maka formatnya adalah DD/MM/YYYY (contoh: 19/5/2026)
    else if (p1 > 12) {
      return new Date(y, p2 - 1, p1);
    }
    // Ambigu (kedua angka <= 12), default ke standar Indonesia DD/MM/YYYY (contoh: 1/5/2026 -> 1 Mei 2026)
    else {
      return new Date(y, p2 - 1, p1);
    }
  }

  // 2. Cek standard JavaScript Date parsing
  var d = new Date(val.toString());
  if (!isNaN(d.getTime())) return d;

  // 3. Cek format "Mei 1, 2026" dengan nama bulan Indonesia panjang/pendek
  var bulan = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    Mei: 4,
    Jun: 5,
    Jul: 6,
    Agu: 7,
    Ags: 7,
    Sep: 8,
    Okt: 9,
    Nov: 10,
    Des: 11,
  };
  var m = val.toString().match(/^(\w+)\s+(\d+),\s+(\d{4})/);
  if (m) {
    var key = m[1].substring(0, 3);
    key = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
    if (bulan.hasOwnProperty(key)) {
      return new Date(parseInt(m[3]), bulan[key], parseInt(m[2]));
    }
  }
  return null;
}

// Kembalikan daftar tanggal unik (terbaru dulu) yang ada datanya di Data_LTT_Padi
function getTanggalTersediaRekap() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Data_LTT_Padi');
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var data = sheet.getDataRange().getValues();
  var dateSet = {};
  for (var i = 1; i < data.length; i++) {
    var d = parseTanggalEPusluh_(data[i][1]);
    if (!d) continue;
    var tgl = Utilities.formatDate(d, 'Asia/Jakarta', 'yyyy-MM-dd');
    dateSet[tgl] = (dateSet[tgl] || 0) + 1;
  }
  return Object.keys(dateSet)
    .sort()
    .reverse()
    .map(function (tgl) {
      return { tanggal: tgl, jumlah: dateSet[tgl] };
    });
}

function getRekapPadiLengkap(tglMulai, tglAkhir, jenisLTT) {
  var cache = CacheService.getScriptCache();
  var version = cache.get('DB_VERSION') || '1';
  var cacheKey =
    'REKAP_PADI_V' +
    version +
    '_' +
    tglMulai +
    '_' +
    tglAkhir +
    '_' +
    (jenisLTT || 'semua');

  var today = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  var isTodayOnly = tglMulai === today && tglAkhir === today;

  if (isTodayOnly) {
    var cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Ambil Daftar Semua Kecamatan
  var sheetGeo = ss.getSheetByName('Data_Geografi');
  var listKecamatan = [];
  if (sheetGeo) {
    var geoData = sheetGeo.getDataRange().getValues();
    var kecSet = new Set();
    for (var g = 1; g < geoData.length; g++) {
      if (geoData[g][1]) kecSet.add(geoData[g][1].toString());
    }
    listKecamatan = Array.from(kecSet).sort();
  }
  if (listKecamatan.length === 0) {
    listKecamatan = [
      'Bahuga',
      'Banjit',
      'Baradatu',
      'Blambangan Umpu',
      'Buay Bahuga',
      'Bumi Agung',
      'Gunung Labuhan',
      'Kasui',
      'Negara Batin',
      'Negeri Agung',
      'Negeri Besar',
      'Pakuan Ratu',
      'Rebang Tangkas',
      'Umpu Semenguk',
      'Way Tuba',
    ].sort();
  }

  // Siapkan objek output harian
  var harian = {
    rows: [],
    count: 0,
    totalTanam: 0,
    totalPanen: 0,
    totalBera: 0,
    totalOlah: 0,
    jenisLTTList: [],
    breakdown: {},
  };

  var kecJenisMap = {};
  var jenisSet = {};

  var sheet = ss.getSheetByName('Data_LTT_Padi');
  if (sheet && sheet.getLastRow() > 1) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var d = parseTanggalEPusluh_(data[i][1]);
      if (!d) continue;
      var tgl = Utilities.formatDate(d, 'Asia/Jakarta', 'yyyy-MM-dd');
      if (tgl < tglMulai || tgl > tglAkhir) continue;

      var jenis = (data[i][6] || 'LTT').toString();
      jenisSet[jenis] = true;

      var bera = parseFloat(data[i][9]) || 0;
      var olah = parseFloat(data[i][10]) || 0;
      var tanam = parseFloat(data[i][11]) || 0;
      var panen = parseFloat(data[i][12]) || 0;
      var kec = (data[i][3] || '-').toString();

      // Hitung Breakdown Selalu
      if (!harian.breakdown[jenis])
        harian.breakdown[jenis] = { tanam: 0, panen: 0 };
      harian.breakdown[jenis].tanam += tanam;
      harian.breakdown[jenis].panen += panen;

      if (jenisLTT && jenisLTT !== '' && jenis !== jenisLTT) continue;

      // Harian Accumulation
      harian.totalBera += bera;
      harian.totalOlah += olah;
      harian.totalTanam += tanam;
      harian.totalPanen += panen;
      harian.rows.push([
        (data[i][2] || '').toString(),
        kec,
        (data[i][4] || '').toString(),
        jenis,
        Math.round(bera * 100) / 100,
        Math.round(olah * 100) / 100,
        Math.round(tanam * 100) / 100,
        Math.round(panen * 100) / 100,
        (data[i][13] || '-').toString(),
      ]);

      // Kecamatan Accumulation
      var key = kec + '|' + jenis;
      if (!kecJenisMap[key])
        kecJenisMap[key] = { kec: kec, jenis: jenis, tanam: 0, panen: 0 };
      kecJenisMap[key].tanam += tanam;
      kecJenisMap[key].panen += panen;
    }
  }

  // Format Harian output
  harian.rows.sort(function (a, b) {
    return a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]);
  });
  for (var key in harian.breakdown) {
    harian.breakdown[key].tanam =
      Math.round(harian.breakdown[key].tanam * 100) / 100;
    harian.breakdown[key].panen =
      Math.round(harian.breakdown[key].panen * 100) / 100;
  }
  harian.count = harian.rows.length;
  harian.totalTanam = Math.round(harian.totalTanam * 100) / 100;
  harian.totalPanen = Math.round(harian.totalPanen * 100) / 100;
  harian.totalBera = Math.round(harian.totalBera * 100) / 100;
  harian.totalOlah = Math.round(harian.totalOlah * 100) / 100;
  harian.jenisLTTList = Object.keys(jenisSet).sort();

  // Format Kecamatan output
  var kecRows = [];
  var totalKecTanam = 0;
  var totalKecPanen = 0;
  listKecamatan.forEach(function (kecStr) {
    var entries = [];
    for (var k in kecJenisMap) {
      if (kecJenisMap[k].kec === kecStr) entries.push(kecJenisMap[k]);
    }
    if (entries.length === 0) {
      kecRows.push([kecStr, '-', 0, 0]);
    } else {
      entries.sort(function (a, b) {
        return a.jenis.localeCompare(b.jenis);
      });
      entries.forEach(function (e) {
        kecRows.push([
          e.kec,
          e.jenis,
          Math.round(e.tanam * 100) / 100,
          Math.round(e.panen * 100) / 100,
        ]);
        totalKecTanam += e.tanam;
        totalKecPanen += e.panen;
      });
    }
  });

  var result = {
    harian: harian,
    kecamatan: {
      rows: kecRows,
      totalTanam: Math.round(totalKecTanam * 100) / 100,
      totalPanen: Math.round(totalKecPanen * 100) / 100,
    },
  };
  if (isTodayOnly) {
    cache.put(cacheKey, JSON.stringify(result), 1800); // 30 minutes
  }
  return result;
}

// =========================================================================
// INISIALISASI OTOMATIS (dipanggil dari doGet setiap kali app dibuka)
// Memastikan semua sheet wajib ada. Aman dijalankan berkali-kali.
// =========================================================================

function inisialisasiDatabase_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Sheet: Data_User
  if (!ss.getSheetByName('Data_User')) {
    var su = ss.insertSheet('Data_User');
    su.appendRow([
      'ID_User',
      'Nama_Penyuluh',
      'NIP',
      'Password',
      'Role',
      'Nama_Kecamatan',
      'Desa_Binaan',
      'Status_Aktif',
    ]);
    su.getRange('A1:H1').setFontWeight('bold').setBackground('#d9ead3');
    su.setFrozenRows(1);
  }

  // Sheet: Data_LTT
  if (!ss.getSheetByName('Data_LTT')) {
    var sl = ss.insertSheet('Data_LTT');
    sl.appendRow([
      'ID_Laporan',
      'Waktu_Lapor',
      'Pelapor',
      'Nama_Kecamatan',
      'Nama_Desa',
      'Komoditas',
      'Jenis_LTT',
      'Target_Tanam_Bln_Ini',
      'Target_Panen_Bln_Ini',
      'Luas_Lahan_Bera',
      'Realisasi_Olah_Lahan',
      'Realisasi_Luas_Tanam',
      'Realisasi_Luas_Panen',
      'Keterangan',
      'Status_Verifikasi',
      'Waktu_Verifikasi_BPP',
      'Waktu_Verifikasi_Kab',
      'NIP_Pelapor',
    ]);
    sl.getRange('A1:R1').setFontWeight('bold').setBackground('#c9daf8');
    sl.setFrozenRows(1);
  } else {
    // Migrasi: tambah header NIP_Pelapor jika kolom R1 masih kosong
    var sl = ss.getSheetByName('Data_LTT');
    if (!sl.getRange('R1').getValue()) {
      sl.getRange('R1')
        .setValue('NIP_Pelapor')
        .setFontWeight('bold')
        .setBackground('#c9daf8');
    }
  }

  // Sheet: Data_LTT_Padi
  if (!ss.getSheetByName('Data_LTT_Padi')) {
    var sp = ss.insertSheet('Data_LTT_Padi');
    sp.appendRow([
      'ID_Laporan',
      'Waktu_Lapor',
      'Pelapor',
      'Nama_Kecamatan',
      'Nama_Desa',
      'Komoditas',
      'Jenis_LTT',
      'Target_Tanam_Bln_Ini',
      'Target_Panen_Bln_Ini',
      'Luas_Lahan_Bera',
      'Realisasi_Olah_Lahan',
      'Realisasi_Luas_Tanam',
      'Realisasi_Luas_Panen',
      'Keterangan',
      'Status_Verifikasi',
      'Waktu_Verifikasi_BPP',
      'Waktu_Verifikasi_Kab',
    ]);
    sp.getRange('A1:Q1').setFontWeight('bold').setBackground('#fce5cd');
    sp.setFrozenRows(1);
  }

  // Sheet: Data_Geografi (struktur saja, data diisi manual/import)
  if (!ss.getSheetByName('Data_Geografi')) {
    var sg = ss.insertSheet('Data_Geografi');
    sg.appendRow(['ID_Kecamatan', 'Nama_Kecamatan', 'ID_Desa', 'Nama_Desa']);
    sg.getRange('A1:D1').setFontWeight('bold').setBackground('#efefef');
    sg.setFrozenRows(1);
  }

  // Sheet: Ringkasan_Harian
  if (!ss.getSheetByName('Ringkasan_Harian')) {
    var sr = ss.insertSheet('Ringkasan_Harian');
    sr.appendRow([
      'Tanggal',
      'Komoditas',
      'Jenis_LTT',
      'Total_Tanam',
      'Total_Panen',
    ]);
    sr.getRange('A1:E1').setFontWeight('bold').setBackground('#d0e0ff');
    sr.setFrozenRows(1);
  }

  // Sheet: Jenis_LTT
  if (!ss.getSheetByName('Jenis_LTT')) {
    var sj = ss.insertSheet('Jenis_LTT');
    sj.appendRow(['ID_Jenis_LTT', 'Nama_Jenis_LTT', 'Komoditas']);
    sj.getRange('A1:C1').setFontWeight('bold').setBackground('#d0e0ff');
    sj.setFrozenRows(1);
    // Seed default LTT types
    var seeds = [
      ['1', 'LTT Reguler', 'Padi'],
      ['2', 'LTT Padi Gogo', 'Padi'],
      ['3', 'LTT Oplah 2024', 'Padi'],
      ['4', 'LTT  Oplah 2025', 'Padi'],
      ['5', 'LTT CSR', 'Padi'],
      ['6', 'LTT Rehap Bencana', 'Padi'],
      ['7', 'Jagung', 'Jagung'],
      ['9', 'Ubi Kayu', 'Ubi Kayu'],
    ];
    sj.getRange(2, 1, seeds.length, 3).setValues(seeds);
  }

  // Sheet: Target_Bulanan
  if (!ss.getSheetByName('Target_Bulanan')) {
    var stb = ss.insertSheet('Target_Bulanan');
    stb.appendRow([
      'ID_Target',
      'Bulan',
      'Level_Wilayah',
      'Kode_Geografi',
      'Nama_Geografi',
      'Komoditas',
      'Total_Target',
      'IP_Eksisting',
      'Luas_Baku_Sawah',
      'Luas_Standing_Crop',
      'Pembuat_Target',
      'Waktu_Update',
    ]);
    stb.getRange('A1:L1').setFontWeight('bold').setBackground('#ffe599');
    stb.setFrozenRows(1);
  }

  // Sheet: Target_Detail_Jenis
  if (!ss.getSheetByName('Target_Detail_Jenis')) {
    var std = ss.insertSheet('Target_Detail_Jenis');
    std.appendRow([
      'ID_Target_Detail',
      'ID_Target',
      'Nama_Jenis_LTT',
      'Luas_Target',
    ]);
    std.getRange('A1:D1').setFontWeight('bold').setBackground('#ffe599');
    std.setFrozenRows(1);
  }

  // Sheet: Target_Desa_Padi
  var sdp = ss.getSheetByName('Target_Desa_Padi');
  var headerPadi = [
    'Bulan',
    'Nama_Kecamatan',
    'Nama_Desa',
    'LTT_Reguler',
    'Padi_Gogo',
    'Oplah_2024',
    'Oplah_2025',
    'CSR',
    'Rehab_Bencana',
    'Total_Target_Tanam',
    'Panen_Reguler',
    'Panen_Padi_Gogo',
    'Panen_Oplah_2024',
    'Panen_Oplah_2025',
    'Panen_CSR',
    'Panen_Rehab_Bencana',
    'Total_Target_Panen',
    'IP_Eksisting',
    'Luas_Baku_Sawah',
    'Luas_Standing_Crop',
    'Pembuat',
    'Waktu_Update',
  ];
  if (!sdp) {
    sdp = ss.insertSheet('Target_Desa_Padi');
    sdp.appendRow(headerPadi);
    sdp.getRange('A1:V1').setFontWeight('bold').setBackground('#ffe599');
    sdp.setFrozenRows(1);
  } else {
    var currentHeaders = sdp
      .getRange(1, 1, 1, Math.max(1, sdp.getLastColumn()))
      .getValues()[0];
    if (
      currentHeaders.length < headerPadi.length ||
      currentHeaders[9] === 'Total_Target'
    ) {
      sdp
        .getRange(1, 1, 1, headerPadi.length)
        .setValues([headerPadi])
        .setFontWeight('bold')
        .setBackground('#ffe599');
    }
  }

  // Sheet: Target_Desa_Jagung
  var sdj = ss.getSheetByName('Target_Desa_Jagung');
  var headerJagung = [
    'Bulan',
    'Nama_Kecamatan',
    'Nama_Desa',
    'Total_Target_Tanam',
    'Total_Target_Panen',
    'IP_Eksisting',
    'Luas_Baku',
    'Pembuat',
    'Waktu_Update',
  ];
  if (!sdj) {
    sdj = ss.insertSheet('Target_Desa_Jagung');
    sdj.appendRow(headerJagung);
    sdj.getRange('A1:I1').setFontWeight('bold').setBackground('#ffe599');
    sdj.setFrozenRows(1);
  } else {
    var currentHeaders = sdj
      .getRange(1, 1, 1, Math.max(1, sdj.getLastColumn()))
      .getValues()[0];
    if (
      currentHeaders.length < headerJagung.length ||
      currentHeaders[3] === 'Total_Target'
    ) {
      sdj
        .getRange(1, 1, 1, headerJagung.length)
        .setValues([headerJagung])
        .setFontWeight('bold')
        .setBackground('#ffe599');
    }
  }

  // Sheet: Target_Desa_UbiKayu
  var sdu = ss.getSheetByName('Target_Desa_UbiKayu');
  var headerUbi = [
    'Bulan',
    'Nama_Kecamatan',
    'Nama_Desa',
    'Total_Target_Tanam',
    'Total_Target_Panen',
    'IP_Eksisting',
    'Luas_Baku',
    'Pembuat',
    'Waktu_Update',
  ];
  if (!sdu) {
    sdu = ss.insertSheet('Target_Desa_UbiKayu');
    sdu.appendRow(headerUbi);
    sdu.getRange('A1:I1').setFontWeight('bold').setBackground('#ffe599');
    sdu.setFrozenRows(1);
  } else {
    var currentHeaders = sdu
      .getRange(1, 1, 1, Math.max(1, sdu.getLastColumn()))
      .getValues()[0];
    if (
      currentHeaders.length < headerUbi.length ||
      currentHeaders[3] === 'Total_Target'
    ) {
      sdu
        .getRange(1, 1, 1, headerUbi.length)
        .setValues([headerUbi])
        .setFontWeight('bold')
        .setBackground('#ffe599');
    }
  }

  // Sheet: Target_Kabupaten
  var skb = ss.getSheetByName('Target_Kabupaten');
  var headerKab = [
    'Bulan',
    'Komoditas',
    'Total_Target_Tanam',
    'Total_Target_Panen',
    'Pembuat',
    'Waktu_Update',
  ];
  if (!skb) {
    skb = ss.insertSheet('Target_Kabupaten');
    skb.appendRow(headerKab);
    skb.getRange('A1:F1').setFontWeight('bold').setBackground('#ffe599');
    skb.setFrozenRows(1);
  } else {
    var currentHeaders = skb
      .getRange(1, 1, 1, Math.max(1, skb.getLastColumn()))
      .getValues()[0];
    if (
      currentHeaders.length < headerKab.length ||
      currentHeaders[2] === 'Total_Target'
    ) {
      skb
        .getRange(1, 1, 1, headerKab.length)
        .setValues([headerKab])
        .setFontWeight('bold')
        .setBackground('#ffe599');
    }
  }

  // Sheet: Target_Kecamatan
  var skc = ss.getSheetByName('Target_Kecamatan');
  var headerKec = [
    'Bulan',
    'Komoditas',
    'Nama_Kecamatan',
    'Total_Target_Tanam',
    'Total_Target_Panen',
    'Waktu_Rebuild',
  ];
  if (!skc) {
    skc = ss.insertSheet('Target_Kecamatan');
    skc.appendRow(headerKec);
    skc.getRange('A1:F1').setFontWeight('bold').setBackground('#ffe599');
    skc.setFrozenRows(1);
  } else {
    var currentHeaders = skc
      .getRange(1, 1, 1, Math.max(1, skc.getLastColumn()))
      .getValues()[0];
    if (
      currentHeaders.length < headerKec.length ||
      currentHeaders[3] === 'Total_Target'
    ) {
      skc
        .getRange(1, 1, 1, headerKec.length)
        .setValues([headerKec])
        .setFontWeight('bold')
        .setBackground('#ffe599');
    }
  }
}

// =========================================================================
// FUNGSI DATA GEOGRAFI
// =========================================================================

// =========================================================================
// FUNGSI MANAJEMEN USER
// =========================================================================

function getDaftarKecamatan() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Data_Geografi');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var kecs = new Set();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1]) kecs.add(data[i][1]);
  }
  return Array.from(kecs).sort();
}

function getDaftarUser() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Data_User');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var users = [];
  for (var i = 1; i < data.length; i++) {
    users.push({
      id: data[i][0],
      nama: data[i][1],
      nip: data[i][2].toString(),
      password: data[i][3].toString(),
      role: data[i][4],
      kecamatan: data[i][5],
      desa: data[i][6],
      status: data[i][7],
    });
  }
  return users;
}

function simpanDataUser(u) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Data_User');
    var data = sheet.getDataRange().getValues();

    // Validasi NIP Duplikat (Baru maupun Edit)
    for (var i = 1; i < data.length; i++) {
      if (data[i][2].toString() === u.nip.toString() && data[i][0] !== u.id) {
        return {
          status: 'error',
          message: 'NIP/Username sudah terdaftar pada pengguna lain',
        };
      }
    }

    if (u.id) {
      // Update
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] == u.id) {
          var oldNip = data[i][2].toString();
          sheet
            .getRange(i + 1, 1, 1, 8)
            .setValues([
              [
                u.id,
                u.nama,
                u.nip,
                u.password,
                u.role,
                u.kecamatan,
                u.desa,
                u.status,
              ],
            ]);
          // Clear cache untuk NIP lama & NIP baru
          CacheService.getScriptCache().remove('USER_' + oldNip);
          if (oldNip !== u.nip.toString()) {
            CacheService.getScriptCache().remove('USER_' + u.nip.toString());
          }
          return { status: 'success', message: 'User berhasil diperbarui' };
        }
      }
    } else {
      // Create
      var newId = 'USR-' + new Date().getTime();
      sheet.appendRow([
        newId,
        u.nama,
        u.nip,
        u.password,
        u.role,
        u.kecamatan,
        u.desa,
        u.status,
      ]);
      return { status: 'success', message: 'User berhasil ditambahkan' };
    }
    return { status: 'error', message: 'User tidak ditemukan' };
  } catch (e) {
    return { status: 'error', message: 'Kesalahan sistem: ' + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function hapusDataUser(id, nip) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Data_User');
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == id) {
        sheet.deleteRow(i + 1);
        CacheService.getScriptCache().remove('USER_' + nip);
        return { status: 'success', message: 'User berhasil dihapus' };
      }
    }
    return { status: 'error', message: 'User tidak ditemukan' };
  } catch (e) {
    return { status: 'error', message: 'Kesalahan sistem: ' + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// FUNGSI UPDATE PROFIL MANDIRI (PPL & BPP)
// =========================================================================

function updateProfilUser(id, namaBaru, passwordLama, passwordBaru) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_User');
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString() !== id.toString()) continue;

      var passwordDiDB = data[i][3].toString();
      var nip = data[i][2].toString();

      if (passwordLama.toString() !== passwordDiDB) {
        return {
          status: 'error',
          message: 'Password Aktif yang Anda masukkan salah.',
        };
      }

      var passwordFinal = passwordDiDB;
      if (passwordBaru && passwordBaru.toString().trim() !== '') {
        if (passwordBaru.toString().trim().length < 4) {
          return {
            status: 'error',
            message: 'Password Baru minimal harus 4 karakter.',
          };
        }
        passwordFinal = passwordBaru.toString().trim();
      }

      sheet.getRange(i + 1, 2).setValue(namaBaru.trim());
      sheet.getRange(i + 1, 4).setValue(passwordFinal);

      var cache = CacheService.getScriptCache();
      var cacheKey = 'USER_' + nip;
      cache.remove(cacheKey);
      var updatedUserData = {
        id: data[i][0],
        nama: namaBaru.trim(),
        nip: nip,
        role: data[i][4],
        kecamatan: data[i][5],
        desa: data[i][6],
      };
      cache.put(
        cacheKey,
        JSON.stringify({ password: passwordFinal, userData: updatedUserData }),
        21600,
      );

      return {
        status: 'success',
        message: 'Profil berhasil diperbarui!',
        data: updatedUserData,
      };
    }

    return { status: 'error', message: 'Data akun tidak ditemukan.' };
  } catch (e) {
    return { status: 'error', message: 'Kesalahan sistem: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// SISTEM ARSIP BULANAN
// =========================================================================

// Jalankan otomatis tiap tanggal 1 via time trigger (lihat setupTriggerArsip)
function arsipBulanan() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var now = new Date();
  var prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var b0 = prev.getMonth();
  var thn = prev.getFullYear();
  var sfx = thn + '_' + Utilities.formatDate(prev, 'Asia/Jakarta', 'MM');

  pindahKeArsip_(ss, 'Data_LTT', 'Data_LTT_' + sfx, b0, thn);
  pindahKeArsip_(ss, 'Data_LTT_Padi', 'Data_LTT_Padi_' + sfx, b0, thn);
  clearAllAppCaches();
}

function pindahKeArsip_(ss, namaSheet, namaArsip, bulan0, tahun) {
  var sheet = ss.getSheetByName(namaSheet);
  if (!sheet || sheet.getLastRow() <= 1) return;
  if (ss.getSheetByName(namaArsip)) return; // sudah diarsip sebelumnya

  var data = sheet.getDataRange().getValues();
  var header = data[0];
  var arsip = [],
    sisa = [];

  for (var i = 1; i < data.length; i++) {
    if (!data[i][1]) continue;
    var tgl = parseTanggalEPusluh_(data[i][1]);
    if (!tgl) continue;
    if (tgl.getMonth() === bulan0 && tgl.getFullYear() === tahun)
      arsip.push(data[i]);
    else sisa.push(data[i]);
  }
  if (arsip.length === 0) return;

  // Buat sheet arsip dan isi
  var arsipSheet = ss.insertSheet(namaArsip);
  arsipSheet.appendRow(header);
  arsipSheet.getRange(2, 1, arsip.length, header.length).setValues(arsip);
  arsipSheet.setFrozenRows(1);

  // Tulis ulang sheet utama hanya dengan data tersisa
  sheet.getRange(2, 1, sheet.getLastRow() - 1, header.length).clearContent();
  if (sisa.length > 0) {
    sheet.getRange(2, 1, sisa.length, header.length).setValues(sisa);
  }
}

// =========================================================================
// RINGKASAN HARIAN (Summary Sheet)
// Schema: Tanggal | Komoditas | Jenis_LTT | Total_Tanam | Total_Panen
// =========================================================================

function upsertRingkasan_(
  ss,
  tanggal,
  komoditas,
  jenisLTT,
  addTanam,
  addPanen,
) {
  var sheet = ss.getSheetByName('Ringkasan_Harian');
  if (!sheet) {
    sheet = ss.insertSheet('Ringkasan_Harian');
    sheet.appendRow([
      'Tanggal',
      'Komoditas',
      'Jenis_LTT',
      'Total_Tanam',
      'Total_Panen',
    ]);
    sheet.getRange('A1:E1').setFontWeight('bold').setBackground('#d0e0ff');
    sheet.setFrozenRows(1);
  }

  var dataRange = sheet.getDataRange();
  var data = dataRange.getValues();
  var found = false;

  for (var i = 1; i < data.length; i++) {
    var tglSheet =
      data[i][0] instanceof Date
        ? Utilities.formatDate(data[i][0], 'Asia/Jakarta', 'yyyy-MM-dd')
        : data[i][0].toString();

    if (
      tglSheet === tanggal &&
      data[i][1] === komoditas &&
      data[i][2] === jenisLTT
    ) {
      data[i][3] =
        Math.round((parseFloat(data[i][3] || 0) + addTanam) * 100) / 100;
      data[i][4] =
        Math.round((parseFloat(data[i][4] || 0) + addPanen) * 100) / 100;
      found = true;
      break;
    }
  }

  if (found) {
    dataRange.setValues(data); // Timpa sekaligus
  } else {
    sheet.appendRow([
      tanggal,
      komoditas,
      jenisLTT,
      Math.round(addTanam * 100) / 100,
      Math.round(addPanen * 100) / 100,
    ]);
  }
}

// Dipanggil setelah terimaSinkronPadi — rebuild baris Padi untuk tanggal yang baru disinkron
function rebuiltPadiRingkasan_(ss, dataArray) {
  var padiByKey = {};
  dataArray.forEach(function (row) {
    var tgl = parseTanggalEPusluh_(row[1]);
    if (!tgl) return;
    var tglStr = Utilities.formatDate(tgl, 'Asia/Jakarta', 'yyyy-MM-dd');
    var jenis = (row[6] || '').toString();
    var key = tglStr + '|' + jenis;
    if (!padiByKey[key])
      padiByKey[key] = { tglStr: tglStr, jenis: jenis, tanam: 0, panen: 0 };
    padiByKey[key].tanam += parseFloat(row[11]) || 0;
    padiByKey[key].panen += parseFloat(row[12]) || 0;
  });
  if (Object.keys(padiByKey).length === 0) return;

  var affDates = {};
  Object.keys(padiByKey).forEach(function (k) {
    affDates[padiByKey[k].tglStr] = true;
  });

  var sheet = ss.getSheetByName('Ringkasan_Harian');
  var header = [
    'Tanggal',
    'Komoditas',
    'Jenis_LTT',
    'Total_Tanam',
    'Total_Panen',
  ];
  var finalData = [];

  if (!sheet) {
    sheet = ss.insertSheet('Ringkasan_Harian');
    sheet.appendRow(header);
    sheet.getRange('A1:E1').setFontWeight('bold').setBackground('#d0e0ff');
    sheet.setFrozenRows(1);
    finalData = [header];
  } else {
    // Bangun Virtual Sheet Array
    var ex = sheet.getDataRange().getValues();
    finalData = [ex[0]]; // Simpan header

    // Filter data lama, buang baris Padi pada tanggal yang terdampak
    for (var i = 1; i < ex.length; i++) {
      var tglObj = parseTanggalEPusluh_(ex[i][0]);
      var tglEx = tglObj
        ? Utilities.formatDate(tglObj, 'Asia/Jakarta', 'yyyy-MM-dd')
        : '';

      if (!(ex[i][1] === 'Padi' && affDates[tglEx])) {
        finalData.push(ex[i]);
      }
    }
  }

  // Tambahkan baris rekap Padi yang baru dihitung
  Object.keys(padiByKey).forEach(function (k) {
    var e = padiByKey[k];
    finalData.push([
      e.tglStr,
      'Padi',
      e.jenis,
      Math.round(e.tanam * 100) / 100,
      Math.round(e.panen * 100) / 100,
    ]);
  });

  // Tulis ulang sekaligus (Single Atomic Operation)
  if (sheet.getLastRow() > 0) {
    sheet.getRange(1, 1, sheet.getLastRow(), 5).clearContent();
  }
  sheet.getRange(1, 1, finalData.length, 5).setValues(finalData);
}

// Jalankan SEKALI untuk membangun Ringkasan_Harian dari semua data historis
function rekalkulasiRingkasan() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var old = ss.getSheetByName('Ringkasan_Harian');
  if (old) ss.deleteSheet(old);
  var sheet = ss.insertSheet('Ringkasan_Harian');
  sheet.appendRow([
    'Tanggal',
    'Komoditas',
    'Jenis_LTT',
    'Total_Tanam',
    'Total_Panen',
  ]);
  sheet.getRange('A1:E1').setFontWeight('bold').setBackground('#d0e0ff');
  sheet.setFrozenRows(1);

  var ringkasMap = {};
  function prosesSheet_(namaSheet, komoditasDefault) {
    var sh = ss.getSheetByName(namaSheet);
    if (!sh || sh.getLastRow() <= 1) return;
    var rows = sh.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (!rows[i][1]) continue;
      var tgl = parseTanggalEPusluh_(rows[i][1]);
      if (!tgl) continue;
      var tglStr = Utilities.formatDate(tgl, 'Asia/Jakarta', 'yyyy-MM-dd');
      var kom = komoditasDefault || (rows[i][5] || '').toString();
      var jen = (rows[i][6] || '').toString();
      var key = tglStr + '|' + kom + '|' + jen;
      if (!ringkasMap[key])
        ringkasMap[key] = {
          tglStr: tglStr,
          kom: kom,
          jen: jen,
          tam: 0,
          pan: 0,
        };
      ringkasMap[key].tam += parseFloat(rows[i][11]) || 0;
      ringkasMap[key].pan += parseFloat(rows[i][12]) || 0;
    }
  }

  prosesSheet_('Data_LTT', null);
  prosesSheet_('Data_LTT_Padi', 'Padi');
  ss.getSheets().forEach(function (s) {
    var n = s.getName();
    if (/^Data_LTT_\d{4}_\d{2}$/.test(n)) prosesSheet_(n, null);
    if (/^Data_LTT_Padi_\d{4}_\d{2}$/.test(n)) prosesSheet_(n, 'Padi');
  });

  var baris = Object.keys(ringkasMap)
    .map(function (k) {
      var e = ringkasMap[k];
      return [
        e.tglStr,
        e.kom,
        e.jen,
        Math.round(e.tam * 100) / 100,
        Math.round(e.pan * 100) / 100,
      ];
    })
    .sort(function (a, b) {
      return a[0].localeCompare(b[0]);
    });

  if (baris.length > 0) sheet.getRange(2, 1, baris.length, 5).setValues(baris);
  return (
    'Ringkasan_Harian dibangun: ' +
    baris.length +
    ' baris dari semua data historis.'
  );
}

function getDashboardTarget(params) {
  var now = new Date();
  var filterTanggal = params && params.tanggal ? params.tanggal : null;
  var bulan =
    params && params.bulan !== undefined
      ? parseInt(params.bulan)
      : now.getMonth() + 1;
  var tahun =
    params && params.tahun !== undefined
      ? parseInt(params.tahun)
      : now.getFullYear();
  var bulan0 = bulan - 1; // 0-indexed untuk getMonth()
  var bulanStr = (bulan < 10 ? '0' : '') + bulan;
  var bulanTahun = tahun + '-' + bulanStr;
  var isPast = bulan0 !== now.getMonth() || tahun !== now.getFullYear();

  var cache = CacheService.getScriptCache();
  var version = cache.get('DB_VERSION') || '1';
  var cacheKey =
    'DASH_TARGET_V' +
    version +
    '_' +
    (filterTanggal ? filterTanggal : tahun + '_' + bulan);
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Target aggregated dynamically from V2 desa sheets
  var targetMap = {};

  // Padi
  var shPadi = ss.getSheetByName('Target_Desa_Padi');
  if (shPadi && shPadi.getLastRow() > 1) {
    var data = shPadi.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var rBulan = parseInt(data[i][0]);
      if (rBulan !== bulan) continue;
      var kec = String(data[i][1]).trim();
      if (!kec) continue;

      if (!targetMap[kec]) {
        targetMap[kec] = {
          LTTReguler: { tanam: 0, panen: 0 },
          PadiGogo: { tanam: 0, panen: 0 },
          Oplah2025: { tanam: 0, panen: 0 },
          Jagung: { tanam: 0, panen: 0 },
          UbiKayu: { tanam: 0, panen: 0 },
        };
      }
      targetMap[kec].LTTReguler.tanam += parseFloat(data[i][3]) || 0;
      targetMap[kec].LTTReguler.panen += parseFloat(data[i][10]) || 0;
      targetMap[kec].PadiGogo.tanam += parseFloat(data[i][4]) || 0;
      targetMap[kec].PadiGogo.panen += parseFloat(data[i][11]) || 0;
      targetMap[kec].Oplah2025.tanam += parseFloat(data[i][6]) || 0;
      targetMap[kec].Oplah2025.panen += parseFloat(data[i][13]) || 0;
    }
  }

  // Jagung
  var shJagung = ss.getSheetByName('Target_Desa_Jagung');
  if (shJagung && shJagung.getLastRow() > 1) {
    var data = shJagung.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var rBulan = parseInt(data[i][0]);
      if (rBulan !== bulan) continue;
      var kec = String(data[i][1]).trim();
      if (!kec) continue;

      if (!targetMap[kec]) {
        targetMap[kec] = {
          LTTReguler: { tanam: 0, panen: 0 },
          PadiGogo: { tanam: 0, panen: 0 },
          Oplah2025: { tanam: 0, panen: 0 },
          Jagung: { tanam: 0, panen: 0 },
          UbiKayu: { tanam: 0, panen: 0 },
        };
      }
      targetMap[kec].Jagung.tanam += parseFloat(data[i][3]) || 0;
      targetMap[kec].Jagung.panen += parseFloat(data[i][4]) || 0;
    }
  }

  // Ubi Kayu
  var shUbi = ss.getSheetByName('Target_Desa_UbiKayu');
  if (shUbi && shUbi.getLastRow() > 1) {
    var data = shUbi.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var rBulan = parseInt(data[i][0]);
      if (rBulan !== bulan) continue;
      var kec = String(data[i][1]).trim();
      if (!kec) continue;

      if (!targetMap[kec]) {
        targetMap[kec] = {
          LTTReguler: { tanam: 0, panen: 0 },
          PadiGogo: { tanam: 0, panen: 0 },
          Oplah2025: { tanam: 0, panen: 0 },
          Jagung: { tanam: 0, panen: 0 },
          UbiKayu: { tanam: 0, panen: 0 },
        };
      }
      targetMap[kec].UbiKayu.tanam += parseFloat(data[i][3]) || 0;
      targetMap[kec].UbiKayu.panen += parseFloat(data[i][4]) || 0;
    }
  }

  // 2. Realisasi Jagung + Ubi Kayu dari Data_LTT (manual PPL)
  var realisasiMap = {};
  var namaLTT = isPast ? 'Data_LTT_' + tahun + '_' + bulanStr : 'Data_LTT';
  var shLTT = ss.getSheetByName(namaLTT);
  if (shLTT && shLTT.getLastRow() > 1) {
    var rows = shLTT.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var tgl = parseTanggalEPusluh_(rows[i][1]);
      if (!tgl) continue;
      var isoStr = Utilities.formatDate(tgl, 'Asia/Jakarta', 'yyyy-MM-dd');
      if (filterTanggal) {
        if (isoStr !== filterTanggal) continue;
      } else {
        var tglM =
          parseInt(Utilities.formatDate(tgl, 'Asia/Jakarta', 'MM')) - 1;
        var tglY = parseInt(Utilities.formatDate(tgl, 'Asia/Jakarta', 'yyyy'));
        if (tglM !== bulan0 || tglY !== tahun) continue;
      }
      var kec = rows[i][3];
      var komRaw = (rows[i][5] || '').toString().trim().toLowerCase();
      var tam = parseFloat(rows[i][11]) || 0;
      var pan = parseFloat(rows[i][12]) || 0;
      if (!realisasiMap[kec]) realisasiMap[kec] = initRealisasi_();
      if (komRaw === 'jagung') {
        realisasiMap[kec].Jagung.tanam += tam;
        realisasiMap[kec].Jagung.panen += pan;
      }
      if (komRaw === 'ubi kayu' || komRaw === 'ubi_kayu') {
        realisasiMap[kec].UbiKayu.tanam += tam;
        realisasiMap[kec].UbiKayu.panen += pan;
      }
    }
  }

  // 3. Realisasi Padi dari Data_LTT_Padi (e-Pusluh)
  var namaPadi = isPast
    ? 'Data_LTT_Padi_' + tahun + '_' + bulanStr
    : 'Data_LTT_Padi';
  var shPadi = ss.getSheetByName(namaPadi);
  if (shPadi && shPadi.getLastRow() > 1) {
    var prows = shPadi.getDataRange().getValues();
    for (var i = 1; i < prows.length; i++) {
      var tgl = parseTanggalEPusluh_(prows[i][1]);
      if (!tgl) continue;
      if (filterTanggal) {
        var isoStr = Utilities.formatDate(tgl, 'Asia/Jakarta', 'yyyy-MM-dd');
        if (isoStr !== filterTanggal) continue;
      } else {
        var pM = parseInt(Utilities.formatDate(tgl, 'Asia/Jakarta', 'MM')) - 1;
        var pY = parseInt(Utilities.formatDate(tgl, 'Asia/Jakarta', 'yyyy'));
        if (pM !== bulan0 || pY !== tahun) continue;
      }
      var kec = prows[i][3];
      var jen = (prows[i][6] || '').toString();
      var tam = parseFloat(prows[i][11]) || 0;
      var pan = parseFloat(prows[i][12]) || 0;
      if (!realisasiMap[kec]) realisasiMap[kec] = initRealisasi_();
      if (jen === 'LTT Reguler') {
        realisasiMap[kec].LTTReguler.tanam += tam;
        realisasiMap[kec].LTTReguler.panen += pan;
      }
      if (jen === 'LTT Padi Gogo') {
        realisasiMap[kec].PadiGogo.tanam += tam;
        realisasiMap[kec].PadiGogo.panen += pan;
      }
      if (jen === 'LTT Oplah 2025') {
        realisasiMap[kec].Oplah2025.tanam += tam;
        realisasiMap[kec].Oplah2025.panen += pan;
      }
    }
  }

  // 4. Target Kabupaten from Target_Kabupaten
  var targetKabupaten = {
    Padi: 0,
    Jagung: 0,
    'Ubi Kayu': 0,
  };
  var shKab = ss.getSheetByName('Target_Kabupaten');
  if (shKab && shKab.getLastRow() > 1) {
    var dataKab = shKab.getDataRange().getValues();
    for (var i = 1; i < dataKab.length; i++) {
      var rBulan = parseInt(dataKab[i][0]);
      if (rBulan !== bulan) continue;

      var rKomoditas = String(dataKab[i][1])
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '');
      var targetVal = parseFloat(dataKab[i][2]) || 0;
      if (rKomoditas === 'padi') {
        targetKabupaten['Padi'] = targetVal;
      } else if (rKomoditas === 'jagung') {
        targetKabupaten['Jagung'] = targetVal;
      } else if (rKomoditas === 'ubikayu') {
        targetKabupaten['Ubi Kayu'] = targetVal;
      }
    }
  }

  var result = {
    target: targetMap,
    realisasi: realisasiMap,
    targetKabupaten: targetKabupaten,
    bulanTahun: bulanTahun,
  };
  try {
    cache.put(cacheKey, JSON.stringify(result), 21600); // 6 hours
  } catch (e) {
    console.error('Error caching getDashboardTarget: ' + e.toString());
  }
  return result;
}

function initRealisasi_() {
  return {
    LTTReguler: { tanam: 0, panen: 0 },
    PadiGogo: { tanam: 0, panen: 0 },
    Oplah2025: { tanam: 0, panen: 0 },
    Jagung: { tanam: 0, panen: 0 },
    UbiKayu: { tanam: 0, panen: 0 },
  };
}

// =========================================================================
// FUNGSI REKAP PALAWIJA (JAGUNG & UBI KAYU)
// =========================================================================

function getRekapPalawijaLengkap(tglMulai, tglAkhir, komoditas) {
  var cache = CacheService.getScriptCache();
  var version = cache.get('DB_VERSION') || '1';
  var cacheKey =
    'REKAP_PALAWIJA_V' +
    version +
    '_' +
    tglMulai +
    '_' +
    tglAkhir +
    '_' +
    komoditas;

  var today = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  var isTodayOnly = tglMulai === today && tglAkhir === today;

  if (isTodayOnly) {
    var cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Ambil list kecamatan
  var sheetGeo = ss.getSheetByName('Data_Geografi');
  var listKecamatan = [];
  if (sheetGeo) {
    var geoData = sheetGeo.getDataRange().getValues();
    var kecSet = new Set();
    for (var g = 1; g < geoData.length; g++) {
      if (geoData[g][1]) kecSet.add(geoData[g][1].toString());
    }
    listKecamatan = Array.from(kecSet).sort();
  }
  if (listKecamatan.length === 0) {
    listKecamatan = [
      'Bahuga',
      'Banjit',
      'Baradatu',
      'Blambangan Umpu',
      'Buay Bahuga',
      'Bumi Agung',
      'Gunung Labuhan',
      'Kasui',
      'Negara Batin',
      'Negeri Agung',
      'Negeri Besar',
      'Pakuan Ratu',
      'Rebang Tangkas',
      'Umpu Semenguk',
      'Way Tuba',
    ].sort();
  }

  var harianTotalTanam = 0,
    harianTotalPanen = 0;
  var kecMap = {};

  var sheet = ss.getSheetByName('Data_LTT');
  if (sheet && sheet.getLastRow() > 1) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var tglDate = new Date(data[i][1]);
      if (isNaN(tglDate)) continue;
      var tgl = Utilities.formatDate(tglDate, 'Asia/Jakarta', 'yyyy-MM-dd');
      if (tgl < tglMulai || tgl > tglAkhir) continue;

      var komRaw = (data[i][5] || '').toString().trim().toLowerCase();
      var komoditasLower = komoditas.trim().toLowerCase();
      if (
        komRaw !== komoditasLower &&
        !(komRaw === 'ubi_kayu' && komoditasLower === 'ubi kayu')
      )
        continue;

      var kec = (data[i][3] || '-').toString();
      var tanam = parseFloat(data[i][11]) || 0;
      var panen = parseFloat(data[i][12]) || 0;

      // Harian Accumulation
      harianTotalTanam += tanam;
      harianTotalPanen += panen;

      // Kecamatan Accumulation
      if (!kecMap[kec]) kecMap[kec] = { tanam: 0, panen: 0 };
      kecMap[kec].tanam += tanam;
      kecMap[kec].panen += panen;
    }
  }

  var kecRows = [];
  var totalKecTanam = 0;
  var totalKecPanen = 0;

  listKecamatan.forEach(function (kec) {
    if (!kecMap[kec]) {
      kecRows.push([kec, '-', 0, 0]);
    } else {
      var t = Math.round(kecMap[kec].tanam * 100) / 100;
      var p = Math.round(kecMap[kec].panen * 100) / 100;
      kecRows.push([kec, '-', t, p]);
      totalKecTanam += t;
      totalKecPanen += p;
    }
  });

  var result = {
    harian: {
      totalTanam: Math.round(harianTotalTanam * 100) / 100,
      totalPanen: Math.round(harianTotalPanen * 100) / 100,
    },
    kecamatan: {
      rows: kecRows,
      totalTanam: Math.round(totalKecTanam * 100) / 100,
      totalPanen: Math.round(totalKecPanen * 100) / 100,
    },
  };
  if (isTodayOnly) {
    cache.put(cacheKey, JSON.stringify(result), 1800); // 30 minutes
  }
  return result;
}

// =========================================================================
// FUNGSI MANAJEMEN AKUN PENYULUH OLEH ADMIN BPP (BACKEND BARU)
// =========================================================================

function getDaftarPPLbyKecamatan(kecamatan, nipPemanggil) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Data_User');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var pplList = [];
  var nipCall = (nipPemanggil || '').toString().trim();
  for (var i = 1; i < data.length; i++) {
    var role = data[i][4];
    var kec = data[i][5];
    var nipRow = data[i][2].toString().trim();
    if ((role === 'Penyuluh' || role === 'Admin_BPP') && kec === kecamatan) {
      // if (nipRow === nipCall) continue; // Admin_BPP tetap tampil di list
      pplList.push({
        id: data[i][0],
        nama: data[i][1],
        nip: data[i][2].toString(),
        role: data[i][4],
        kecamatan: data[i][5],
        desa: data[i][6],
        status: data[i][7],
      });
    }
  }
  return pplList;
}

function resetPasswordPPL(idTarget, passwordBaru, idAdmin) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Data_User');
    var data = sheet.getDataRange().getValues();

    if (!passwordBaru || passwordBaru.toString().trim().length < 4) {
      return { status: 'error', message: 'Password Baru minimal 4 karakter.' };
    }

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == idTarget) {
        var role = data[i][4];
        var nip = data[i][2].toString();
        if (role !== 'Penyuluh' && role !== 'Admin_BPP') {
          return {
            status: 'error',
            message: 'Hanya password Penyuluh yang bisa direset.',
          };
        }

        sheet.getRange(i + 1, 4).setValue(passwordBaru);

        // Hapus cache
        CacheService.getScriptCache().remove('USER_' + nip);
        return {
          status: 'success',
          message: 'Password Penyuluh berhasil direset.',
        };
      }
    }
    return { status: 'error', message: 'User tidak ditemukan.' };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function updateDataPPL(u) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Data_User');
    var data = sheet.getDataRange().getValues();

    if (!u.id) {
      return { status: 'error', message: 'ID User tidak valid' };
    }

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == u.id) {
        var role = data[i][4];
        var nip = data[i][2].toString();

        if (role !== 'Penyuluh' && role !== 'Admin_BPP') {
          return {
            status: 'error',
            message: 'Hanya data Penyuluh yang dapat diubah.',
          };
        }

        // Update Nama_Penyuluh (kolom 2), Desa_Binaan (kolom 7), Status_Aktif (kolom 8)
        sheet.getRange(i + 1, 2).setValue(u.nama);
        sheet.getRange(i + 1, 7).setValue(u.desa);
        sheet.getRange(i + 1, 8).setValue(u.status);

        // Clear cache
        CacheService.getScriptCache().remove('USER_' + nip);
        return {
          status: 'success',
          message: 'Data Penyuluh berhasil diperbarui.',
        };
      }
    }
    return { status: 'error', message: 'Penyuluh tidak ditemukan.' };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Mengambil daftar desa berdasarkan kecamatan dari sheet Data_Geografi
 */
function getDaftarDesabyKecamatan(kecamatan) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Data_Geografi');
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var desaList = [];
    var targetKec = (kecamatan || '').toString().toLowerCase().trim();

    for (var i = 1; i < data.length; i++) {
      var kecName = (data[i][1] || '').toString().toLowerCase().trim();
      if (kecName === targetKec && data[i][3]) {
        desaList.push(data[i][3].toString().trim());
      }
    }
    // Hapus duplikat & urutkan alfabetis
    return Array.from(new Set(desaList)).sort();
  } catch (e) {
    console.error('Error getDaftarDesabyKecamatan: ' + e.toString());
    return [];
  }
}

function clearAllAppCaches() {
  var cache = CacheService.getScriptCache();
  var version = cache.get('DB_VERSION') || '1';
  var nextVersion = parseInt(version) + 1;
  cache.put('DB_VERSION', nextVersion.toString(), 21600); // 6 hours
}

// =========================================================================
// NEW: TARGET KOMODITAS BULANAN FUNCTIONS
// =========================================================================

function getSemuaGeografi() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Data_Geografi');
    if (!sheet) return { kecamatan: [], desaByKec: {} };
    var data = sheet.getDataRange().getValues();
    var kecSet = [];
    var desaByKec = {};
    for (var i = 1; i < data.length; i++) {
      var kec = (data[i][1] || '').toString().trim();
      var desa = (data[i][3] || '').toString().trim();
      if (!kec) continue;
      if (kecSet.indexOf(kec) === -1) kecSet.push(kec);
      if (!desaByKec[kec]) desaByKec[kec] = [];
      if (desa && desaByKec[kec].indexOf(desa) === -1)
        desaByKec[kec].push(desa);
    }
    return { kecamatan: kecSet, desaByKec: desaByKec };
  } catch (e) {
    console.error('Error getSemuaGeografi: ' + e.toString());
    return { kecamatan: [], desaByKec: {} };
  }
}

function getJenisLTT(komoditas) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Jenis_LTT');
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var result = [];
    var targetKom = (komoditas || '').toString().toLowerCase().trim();
    for (var i = 1; i < data.length; i++) {
      var komName = (data[i][2] || '').toString().toLowerCase().trim();
      if (komName === targetKom) {
        result.push(data[i][1].toString());
      }
    }
    return result;
  } catch (e) {
    console.error('Error getJenisLTT: ' + e.toString());
    return [];
  }
}

// =========================================================================
// HELPER & WRAPPER CACHING DATA TARGET
// =========================================================================

function cacheGetTarget(key) {
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error('Error cacheGetTarget for ' + key + ': ' + e.toString());
  }
  return null;
}

function cachePutTarget(key, data) {
  try {
    var cache = CacheService.getScriptCache();
    cache.put(key, JSON.stringify(data), 21600); // TTL 6 jam (21600 detik)
  } catch (e) {
    console.error('Error cachePutTarget for ' + key + ': ' + e.toString());
  }
}

function cacheDeleteTarget() {
  try {
    var cache = CacheService.getScriptCache();
    var keys = Array.prototype.slice.call(arguments);
    if (keys.length > 0) {
      cache.removeAll(keys);
    }
  } catch (e) {
    console.error('Error cacheDeleteTarget: ' + e.toString());
  }
}

function cacheDeleteBulan(bulan) {
  try {
    var komoditasList = ['padi', 'jagung', 'ubikayu'];
    var keys = [];
    komoditasList.forEach(function (kom) {
      keys.push('target_desa_' + kom + '_' + bulan);
      keys.push('target_kecamatan_' + kom + '_' + bulan);
      keys.push('target_kabupaten_' + kom + '_' + bulan);
      keys.push('target_all_' + kom); // hapus juga all-months cache
    });
    cacheDeleteTarget.apply(null, keys);
  } catch (e) {
    console.error('Error cacheDeleteBulan for ' + bulan + ': ' + e.toString());
  }
}

function invalidateAllKecamatanCache() {
  try {
    var keys = [];
    var komoditasList = ['padi', 'jagung', 'ubikayu'];
    komoditasList.forEach(function (kom) {
      keys.push('target_all_' + kom); // all-months cache juga perlu dihapus
    });
    for (var b = 1; b <= 12; b++) {
      komoditasList.forEach(function (kom) {
        keys.push('target_kecamatan_' + kom + '_' + b);
      });
    }
    cacheDeleteTarget.apply(null, keys);
  } catch (e) {
    console.error('Error invalidateAllKecamatanCache: ' + e.toString());
  }
}

function invalidateAllTargetCaches() {
  try {
    var keys = [];
    var komoditasList = ['padi', 'jagung', 'ubikayu'];
    komoditasList.forEach(function (kom) {
      keys.push('target_all_' + kom); // all-months cache
    });
    for (var b = 1; b <= 12; b++) {
      komoditasList.forEach(function (kom) {
        keys.push('target_desa_' + kom + '_' + b);
        keys.push('target_kecamatan_' + kom + '_' + b);
        keys.push('target_kabupaten_' + kom + '_' + b);
      });
    }
    cacheDeleteTarget.apply(null, keys);
  } catch (e) {
    console.error('Error invalidateAllTargetCaches: ' + e.toString());
  }
}

function fetchDesaTargetsFromSheet_(ss, bulan, komoditas) {
  var normKom = komoditas.toLowerCase().replace(/\s+/g, '');
  var desaSheetName = '';
  if (normKom === 'padi') {
    desaSheetName = 'Target_Desa_Padi';
  } else if (normKom === 'jagung') {
    desaSheetName = 'Target_Desa_Jagung';
  } else if (normKom === 'ubikayu') {
    desaSheetName = 'Target_Desa_UbiKayu';
  }

  var targets = [];
  if (!desaSheetName) return targets;

  var shDesa = ss.getSheetByName(desaSheetName);
  if (shDesa && shDesa.getLastRow() > 1) {
    var dataDesa = shDesa.getDataRange().getValues();
    var formatDate = function (val) {
      if (val instanceof Date) {
        return Utilities.formatDate(val, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
      }
      return val ? val.toString() : '';
    };

    for (var i = 1; i < dataDesa.length; i++) {
      var rBulan = parseInt(dataDesa[i][0]);
      if (rBulan !== bulan) continue;

      var kec = String(dataDesa[i][1]).trim();
      var desa = String(dataDesa[i][2]).trim();

      var targetObj = {
        id: 'Desa|' + rBulan + '|' + kec + '|' + desa + '|' + komoditas,
        bulan: rBulan,
        level: 'Desa',
        kodeGeografi: '',
        namaGeografi: desa,
        kecamatan: kec,
        komoditas: komoditas,
        details: [],
      };

      if (normKom === 'padi') {
        targetObj.totalTarget = parseFloat(dataDesa[i][9]) || 0;
        targetObj.totalTargetPanen = parseFloat(dataDesa[i][16]) || 0;
        targetObj.ipEksisting = parseFloat(dataDesa[i][17]) || 0;
        targetObj.luasBakuSawah = parseFloat(dataDesa[i][18]) || 0;
        targetObj.luasStandingCrop = 0; // standing_crop diabaikan / 0
        targetObj.pembuat = String(dataDesa[i][20]);
        targetObj.waktuUpdate = formatDate(dataDesa[i][21]);

        var lttTypes = [
          'LTT Reguler',
          'LTT Padi Gogo',
          'LTT Oplah 2024',
          'LTT  Oplah 2025',
          'LTT CSR',
          'LTT Rehap Bencana',
        ];
        var colIndicesTanam = [3, 4, 5, 6, 7, 8];
        var colIndicesPanen = [10, 11, 12, 13, 14, 15];
        for (var k = 0; k < lttTypes.length; k++) {
          var valTanam = parseFloat(dataDesa[i][colIndicesTanam[k]]) || 0;
          var valPanen = parseFloat(dataDesa[i][colIndicesPanen[k]]) || 0;
          if (valTanam > 0 || valPanen > 0) {
            targetObj.details.push({
              jenisLtt: lttTypes[k],
              luas: valTanam,
              luasPanen: valPanen,
            });
          }
        }
      } else {
        targetObj.totalTarget = parseFloat(dataDesa[i][3]) || 0;
        targetObj.totalTargetPanen = parseFloat(dataDesa[i][4]) || 0;
        targetObj.ipEksisting = parseFloat(dataDesa[i][5]) || 0;
        targetObj.luasBakuSawah = parseFloat(dataDesa[i][6]) || 0;
        targetObj.luasStandingCrop = 0;
        targetObj.pembuat = String(dataDesa[i][7]);
        targetObj.waktuUpdate = formatDate(dataDesa[i][8]);
      }

      targets.push(targetObj);
    }
  }
  return targets;
}

function fetchKecamatanTargetsFromSheet_(ss, bulan, komoditas) {
  var normKom = komoditas.toLowerCase().replace(/\s+/g, '');
  var targets = [];
  var shKec = ss.getSheetByName('Target_Kecamatan');
  if (shKec && shKec.getLastRow() > 1) {
    var dataKec = shKec.getDataRange().getValues();
    var formatDate = function (val) {
      if (val instanceof Date) {
        return Utilities.formatDate(val, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
      }
      return val ? val.toString() : '';
    };

    for (var i = 1; i < dataKec.length; i++) {
      var rBulan = parseInt(dataKec[i][0]);
      var rKomoditas = String(dataKec[i][1]).trim();
      var kec = String(dataKec[i][2]).trim();

      if (rBulan !== bulan) continue;

      var normRKom = rKomoditas.toLowerCase().replace(/\s+/g, '');
      if (normRKom !== normKom) continue;

      targets.push({
        id: 'Kecamatan|' + rBulan + '|' + kec + '|' + komoditas,
        bulan: rBulan,
        level: 'Kecamatan',
        kodeGeografi: '',
        namaGeografi: kec,
        kecamatan: kec,
        komoditas: komoditas,
        totalTarget: parseFloat(dataKec[i][3]) || 0,
        totalTargetPanen: parseFloat(dataKec[i][4]) || 0,
        ipEksisting: 0,
        luasBakuSawah: 0,
        luasStandingCrop: 0,
        pembuat: 'System (Computed)',
        waktuUpdate: formatDate(dataKec[i][5]),
        details: [],
      });
    }
  }
  return targets;
}

function fetchKabupatenTargetsFromSheet_(ss, bulan, komoditas) {
  var normKom = komoditas.toLowerCase().replace(/\s+/g, '');
  var targets = [];
  var shKab = ss.getSheetByName('Target_Kabupaten');
  if (shKab && shKab.getLastRow() > 1) {
    var dataKab = shKab.getDataRange().getValues();
    var formatDate = function (val) {
      if (val instanceof Date) {
        return Utilities.formatDate(val, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
      }
      return val ? val.toString() : '';
    };

    for (var i = 1; i < dataKab.length; i++) {
      var rBulan = parseInt(dataKab[i][0]);
      var rKomoditas = String(dataKab[i][1]).trim();

      if (rBulan !== bulan) continue;

      var normRKom = rKomoditas.toLowerCase().replace(/\s+/g, '');
      if (normRKom !== normKom) continue;

      targets.push({
        id: 'Kabupaten|' + rBulan + '|' + komoditas,
        bulan: rBulan,
        level: 'Kabupaten',
        kodeGeografi: '',
        namaGeografi: 'Kabupaten',
        kecamatan: '',
        komoditas: komoditas,
        totalTarget: parseFloat(dataKab[i][2]) || 0,
        totalTargetPanen: parseFloat(dataKab[i][3]) || 0,
        ipEksisting: 0,
        luasBakuSawah: 0,
        luasStandingCrop: 0,
        pembuat: String(dataKab[i][4]),
        waktuUpdate: formatDate(dataKab[i][5]),
        details: [],
      });
    }
  }
  return targets;
}

// Versi tanpa filter bulan — dipakai saat bulan=0 agar sheet dibaca sekali saja
function fetchAllDesaTargetsFromSheet_(ss, komoditas) {
  var normKom = komoditas.toLowerCase().replace(/\s+/g, '');
  var desaSheetName = '';
  if (normKom === 'padi') {
    desaSheetName = 'Target_Desa_Padi';
  } else if (normKom === 'jagung') {
    desaSheetName = 'Target_Desa_Jagung';
  } else if (normKom === 'ubikayu') {
    desaSheetName = 'Target_Desa_UbiKayu';
  }

  var targets = [];
  if (!desaSheetName) return targets;

  var shDesa = ss.getSheetByName(desaSheetName);
  if (shDesa && shDesa.getLastRow() > 1) {
    var dataDesa = shDesa.getDataRange().getValues();
    var formatDate = function (val) {
      if (val instanceof Date) {
        return Utilities.formatDate(val, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
      }
      return val ? val.toString() : '';
    };

    for (var i = 1; i < dataDesa.length; i++) {
      var rBulan = parseInt(dataDesa[i][0]);
      if (!rBulan) continue;

      var kec = String(dataDesa[i][1]).trim();
      var desa = String(dataDesa[i][2]).trim();

      var targetObj = {
        id: 'Desa|' + rBulan + '|' + kec + '|' + desa + '|' + komoditas,
        bulan: rBulan,
        level: 'Desa',
        kodeGeografi: '',
        namaGeografi: desa,
        kecamatan: kec,
        komoditas: komoditas,
        details: [],
      };

      if (normKom === 'padi') {
        targetObj.totalTarget = parseFloat(dataDesa[i][9]) || 0;
        targetObj.totalTargetPanen = parseFloat(dataDesa[i][16]) || 0;
        targetObj.ipEksisting = parseFloat(dataDesa[i][17]) || 0;
        targetObj.luasBakuSawah = parseFloat(dataDesa[i][18]) || 0;
        targetObj.luasStandingCrop = 0; // standing_crop diabaikan / 0
        targetObj.pembuat = String(dataDesa[i][20]);
        targetObj.waktuUpdate = formatDate(dataDesa[i][21]);

        var lttTypes = [
          'LTT Reguler',
          'LTT Padi Gogo',
          'LTT Oplah 2024',
          'LTT  Oplah 2025',
          'LTT CSR',
          'LTT Rehap Bencana',
        ];
        var colIndicesTanam = [3, 4, 5, 6, 7, 8];
        var colIndicesPanen = [10, 11, 12, 13, 14, 15];
        for (var k = 0; k < lttTypes.length; k++) {
          var valTanam = parseFloat(dataDesa[i][colIndicesTanam[k]]) || 0;
          var valPanen = parseFloat(dataDesa[i][colIndicesPanen[k]]) || 0;
          if (valTanam > 0 || valPanen > 0) {
            targetObj.details.push({
              jenisLtt: lttTypes[k],
              luas: valTanam,
              luasPanen: valPanen,
            });
          }
        }
      } else {
        targetObj.totalTarget = parseFloat(dataDesa[i][3]) || 0;
        targetObj.totalTargetPanen = parseFloat(dataDesa[i][4]) || 0;
        targetObj.ipEksisting = parseFloat(dataDesa[i][5]) || 0;
        targetObj.luasBakuSawah = parseFloat(dataDesa[i][6]) || 0;
        targetObj.luasStandingCrop = 0;
        targetObj.pembuat = String(dataDesa[i][7]);
        targetObj.waktuUpdate = formatDate(dataDesa[i][8]);
      }

      targets.push(targetObj);
    }
  }
  return targets;
}

function fetchAllKecamatanTargetsFromSheet_(ss, komoditas) {
  var normKom = komoditas.toLowerCase().replace(/\s+/g, '');
  var targets = [];
  var shKec = ss.getSheetByName('Target_Kecamatan');
  if (shKec && shKec.getLastRow() > 1) {
    var dataKec = shKec.getDataRange().getValues();
    var formatDate = function (val) {
      if (val instanceof Date) {
        return Utilities.formatDate(val, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
      }
      return val ? val.toString() : '';
    };

    for (var i = 1; i < dataKec.length; i++) {
      var rBulan = parseInt(dataKec[i][0]);
      var rKomoditas = String(dataKec[i][1]).trim();
      if (!rBulan) continue;

      var normRKom = rKomoditas.toLowerCase().replace(/\s+/g, '');
      if (normRKom !== normKom) continue;

      var kec = String(dataKec[i][2]).trim();
      targets.push({
        id: 'Kecamatan|' + rBulan + '|' + kec + '|' + komoditas,
        bulan: rBulan,
        level: 'Kecamatan',
        kodeGeografi: '',
        namaGeografi: kec,
        kecamatan: kec,
        komoditas: komoditas,
        totalTarget: parseFloat(dataKec[i][3]) || 0,
        totalTargetPanen: parseFloat(dataKec[i][4]) || 0,
        ipEksisting: 0,
        luasBakuSawah: 0,
        luasStandingCrop: 0,
        pembuat: 'System (Computed)',
        waktuUpdate: formatDate(dataKec[i][5]),
        details: [],
      });
    }
  }
  return targets;
}

function fetchAllKabupatenTargetsFromSheet_(ss, komoditas) {
  var normKom = komoditas.toLowerCase().replace(/\s+/g, '');
  var targets = [];
  var shKab = ss.getSheetByName('Target_Kabupaten');
  if (shKab && shKab.getLastRow() > 1) {
    var dataKab = shKab.getDataRange().getValues();
    var formatDate = function (val) {
      if (val instanceof Date) {
        return Utilities.formatDate(val, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
      }
      return val ? val.toString() : '';
    };

    for (var i = 1; i < dataKab.length; i++) {
      var rBulan = parseInt(dataKab[i][0]);
      var rKomoditas = String(dataKab[i][1]).trim();
      if (!rBulan) continue;

      var normRKom = rKomoditas.toLowerCase().replace(/\s+/g, '');
      if (normRKom !== normKom) continue;

      targets.push({
        id: 'Kabupaten|' + rBulan + '|' + komoditas,
        bulan: rBulan,
        level: 'Kabupaten',
        kodeGeografi: '',
        namaGeografi: 'Kabupaten',
        kecamatan: '',
        komoditas: komoditas,
        totalTarget: parseFloat(dataKab[i][2]) || 0,
        totalTargetPanen: parseFloat(dataKab[i][3]) || 0,
        ipEksisting: 0,
        luasBakuSawah: 0,
        luasStandingCrop: 0,
        pembuat: String(dataKab[i][4]),
        waktuUpdate: formatDate(dataKab[i][5]),
        details: [],
      });
    }
  }
  return targets;
}

function getDesaTargets_(ss, bulan, komoditas) {
  var normKom = komoditas.toLowerCase().replace(/\s+/g, '');
  var cacheKey = 'target_desa_' + normKom + '_' + bulan;
  var cached = cacheGetTarget(cacheKey);
  if (cached) return cached;

  var data = fetchDesaTargetsFromSheet_(ss, bulan, komoditas);
  cachePutTarget(cacheKey, data);
  return data;
}

function getKecamatanTargets_(ss, bulan, komoditas) {
  var normKom = komoditas.toLowerCase().replace(/\s+/g, '');
  var cacheKey = 'target_kecamatan_' + normKom + '_' + bulan;
  var cached = cacheGetTarget(cacheKey);
  if (cached) return cached;

  var data = fetchKecamatanTargetsFromSheet_(ss, bulan, komoditas);
  cachePutTarget(cacheKey, data);
  return data;
}

function getKabupatenTargets_(ss, bulan, komoditas) {
  var normKom = komoditas.toLowerCase().replace(/\s+/g, '');
  var cacheKey = 'target_kabupaten_' + normKom + '_' + bulan;
  var cached = cacheGetTarget(cacheKey);
  if (cached) return cached;

  var data = fetchKabupatenTargetsFromSheet_(ss, bulan, komoditas);
  cachePutTarget(cacheKey, data);
  return data;
}

function ambilTargetBulanan(params) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var bulan = parseInt(params.bulan);
    var komoditas = (params.komoditas || '').toString().trim();
    var normKom = komoditas.toLowerCase().replace(/\s+/g, '');

    if (bulan === 0) {
      // Baca tiap sheet sekali saja (bukan 12x) dan cache hasilnya
      var cacheAllKey = 'target_all_' + normKom;
      var cachedAll = cacheGetTarget(cacheAllKey);
      if (cachedAll) return cachedAll;

      var targets = [];
      targets = targets.concat(fetchAllDesaTargetsFromSheet_(ss, komoditas));
      targets = targets.concat(
        fetchAllKecamatanTargetsFromSheet_(ss, komoditas),
      );
      targets = targets.concat(
        fetchAllKabupatenTargetsFromSheet_(ss, komoditas),
      );
      cachePutTarget(cacheAllKey, targets);
      return targets;
    } else {
      var targets = [];
      targets = targets.concat(getDesaTargets_(ss, bulan, komoditas));
      targets = targets.concat(getKecamatanTargets_(ss, bulan, komoditas));
      targets = targets.concat(getKabupatenTargets_(ss, bulan, komoditas));
      return targets;
    }
  } catch (e) {
    console.error('Error ambilTargetBulanan: ' + e.toString());
    return [];
  }
}

function simpanTargetBulanan(formData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    var level = formData.level; // 'Desa', 'Kabupaten'
    var komoditas = formData.komoditas.trim();
    var bulan = parseInt(formData.bulan);
    var pembuat = formData.pembuat || 'System';
    var waktu = new Date();

    if (level === 'Kecamatan') {
      return {
        status: 'error',
        message:
          'Target tingkat Kecamatan dihitung otomatis dan tidak dapat disimpan langsung.',
      };
    }

    var normKom = komoditas.toLowerCase().replace(/\s+/g, '');

    if (level === 'Desa') {
      var sheetName = '';
      if (normKom === 'padi') {
        sheetName = 'Target_Desa_Padi';
      } else if (normKom === 'jagung') {
        sheetName = 'Target_Desa_Jagung';
      } else if (normKom === 'ubikayu') {
        sheetName = 'Target_Desa_UbiKayu';
      } else {
        return {
          status: 'error',
          message: 'Komoditas tidak dikenal: ' + komoditas,
        };
      }

      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        return {
          status: 'error',
          message: 'Sheet tidak ditemukan: ' + sheetName,
        };
      }

      var kecamatan = formData.kecamatan ? formData.kecamatan.trim() : '';
      if (!kecamatan) {
        kecamatan = lookupKecamatanFromDesa_(ss, formData.namaGeografi);
      }
      var namaDesa = formData.namaGeografi.trim();

      var rowIndex = findTargetRowIndex_(
        sheet,
        formData.id,
        {
          bulan: bulan,
          kecamatan: kecamatan,
          namaGeografi: namaDesa,
        },
        'Desa',
      );

      if (normKom === 'padi') {
        var lttReguler = 0;
        var padiGogo = 0;
        var oplah2024 = 0;
        var oplah2025 = 0;
        var csr = 0;
        var rehabBencana = 0;

        var panenReguler = 0;
        var panenPadiGogo = 0;
        var panenOplah2024 = 0;
        var panenOplah2025 = 0;
        var panenCsr = 0;
        var panenRehabBencana = 0;

        if (formData.details && formData.details.length > 0) {
          for (var i = 0; i < formData.details.length; i++) {
            var det = formData.details[i];
            var valTanam = parseFloat(det.luas) || 0;
            var valPanen = parseFloat(det.luasPanen) || 0;
            var idx = getPadiColumnIndex_(det.jenisLtt);
            if (idx === 3) {
              lttReguler = valTanam;
              panenReguler = valPanen;
            } else if (idx === 4) {
              padiGogo = valTanam;
              panenPadiGogo = valPanen;
            } else if (idx === 5) {
              oplah2024 = valTanam;
              panenOplah2024 = valPanen;
            } else if (idx === 6) {
              oplah2025 = valTanam;
              panenOplah2025 = valPanen;
            } else if (idx === 7) {
              csr = valTanam;
              panenCsr = valPanen;
            } else if (idx === 8) {
              rehabBencana = valTanam;
              panenRehabBencana = valPanen;
            }
          }
        }

        var totalTarget = parseFloat(formData.totalTarget) || 0;
        var totalTargetPanen = parseFloat(formData.totalTargetPanen) || 0;
        var ipEksisting = parseFloat(formData.ipEksisting) || 0;
        var luasBakuSawah = parseFloat(formData.luasBakuSawah) || 0;
        var luasStandingCrop = 0;

        var rowValues = [
          bulan,
          kecamatan,
          namaDesa,
          lttReguler,
          padiGogo,
          oplah2024,
          oplah2025,
          csr,
          rehabBencana,
          totalTarget,
          panenReguler,
          panenPadiGogo,
          panenOplah2024,
          panenOplah2025,
          panenCsr,
          panenRehabBencana,
          totalTargetPanen,
          ipEksisting,
          luasBakuSawah,
          luasStandingCrop,
          pembuat,
          waktu,
        ];

        if (rowIndex !== -1) {
          sheet.getRange(rowIndex, 1, 1, 22).setValues([rowValues]);
        } else {
          sheet.appendRow(rowValues);
        }
      } else {
        var totalTarget = parseFloat(formData.totalTarget) || 0;
        var totalTargetPanen = parseFloat(formData.totalTargetPanen) || 0;
        var ipEksisting = parseFloat(formData.ipEksisting) || 0;
        var luasBaku =
          parseFloat(formData.luasBakuSawah || formData.luasBaku) || 0;
        var rowValues = [
          bulan,
          kecamatan,
          namaDesa,
          totalTarget,
          totalTargetPanen,
          ipEksisting,
          luasBaku,
          pembuat,
          waktu,
        ];

        if (rowIndex !== -1) {
          sheet.getRange(rowIndex, 1, 1, 9).setValues([rowValues]);
        } else {
          sheet.appendRow(rowValues);
        }
      }

      rebuildTargetKecamatan(ss);

      // Invalidate cache
      var normKom = komoditas.toLowerCase().replace(/\s+/g, '');
      cacheDeleteTarget('target_desa_' + normKom + '_' + bulan);
    } else if (level === 'Kabupaten') {
      var sheet = ss.getSheetByName('Target_Kabupaten');
      if (!sheet) {
        return {
          status: 'error',
          message: 'Sheet Target_Kabupaten tidak ditemukan',
        };
      }

      var rowIndex = findTargetRowIndex_(
        sheet,
        formData.id,
        {
          bulan: bulan,
          komoditas: komoditas,
        },
        'Kabupaten',
      );

      var totalTarget = parseFloat(formData.totalTarget) || 0;
      var totalTargetPanen = parseFloat(formData.totalTargetPanen) || 0;
      var rowValues = [
        bulan,
        komoditas,
        totalTarget,
        totalTargetPanen,
        pembuat,
        waktu,
      ];

      if (rowIndex !== -1) {
        sheet.getRange(rowIndex, 1, 1, 6).setValues([rowValues]);
      } else {
        sheet.appendRow(rowValues);
      }

      // Invalidate cache
      var normKom = komoditas.toLowerCase().replace(/\s+/g, '');
      cacheDeleteTarget('target_kabupaten_' + normKom + '_' + bulan);
    }

    clearAllAppCaches();

    var newId = '';
    if (level === 'Desa') {
      var kec = formData.kecamatan
        ? formData.kecamatan.trim()
        : lookupKecamatanFromDesa_(ss, formData.namaGeografi);
      newId =
        'Desa|' +
        bulan +
        '|' +
        kec +
        '|' +
        formData.namaGeografi.trim() +
        '|' +
        komoditas;
    } else {
      newId = 'Kabupaten|' + bulan + '|' + komoditas;
    }

    return { status: 'success', idTarget: newId };
  } catch (e) {
    console.error('Error simpanTargetBulanan: ' + e.toString());
    return { status: 'error', message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function simpanBulkTargetDesa(bulan, komoditas, arrayData, pembuat) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    var bulanInt = parseInt(bulan);
    var komoditasStr = (komoditas || '').toString().trim();
    var normKom = komoditasStr.toLowerCase().replace(/\s+/g, '');
    var pembuatStr = pembuat || 'PPL';
    var waktu = new Date();

    var sheetName = '';
    if (normKom === 'padi') {
      sheetName = 'Target_Desa_Padi';
    } else if (normKom === 'jagung') {
      sheetName = 'Target_Desa_Jagung';
    } else if (normKom === 'ubikayu') {
      sheetName = 'Target_Desa_UbiKayu';
    } else {
      return {
        status: 'error',
        message: 'Komoditas tidak dikenal: ' + komoditasStr,
      };
    }

    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return {
        status: 'error',
        message: 'Sheet tidak ditemukan: ' + sheetName,
      };
    }

    var sheetData = sheet.getDataRange().getValues();
    var headers = sheetData[0];
    var numCols = headers.length;

    var findRowIndexLocal = function (b, kec, d) {
      var cleanKec = (kec || '').trim().toLowerCase();
      var cleanDesa = (d || '').trim().toLowerCase();
      for (var i = 1; i < sheetData.length; i++) {
        var rBulan = parseInt(sheetData[i][0]);
        var rKec = String(sheetData[i][1]).trim().toLowerCase();
        var rDesa = String(sheetData[i][2]).trim().toLowerCase();
        if (rBulan === b && rKec === cleanKec && rDesa === cleanDesa) {
          return i + 1;
        }
      }
      return -1;
    };

    var savedCount = 0;
    var errors = [];

    for (var i = 0; i < arrayData.length; i++) {
      var item = arrayData[i];
      var namaDesa = (item.desa || '').toString().trim();
      var kecamatan = (item.kecamatan || '').toString().trim();
      if (!kecamatan) {
        kecamatan = lookupKecamatanFromDesa_(ss, namaDesa);
      }

      if (!namaDesa) {
        errors.push('Data ke-' + (i + 1) + ': Nama desa kosong');
        continue;
      }

      var rowIndex = findRowIndexLocal(bulanInt, kecamatan, namaDesa);

      if (normKom === 'padi') {
        var lttReguler = 0;
        var padiGogo = 0;
        var oplah2024 = 0;
        var oplah2025 = 0;
        var csr = 0;
        var rehabBencana = 0;

        var panenReguler = 0;
        var panenPadiGogo = 0;
        var panenOplah2024 = 0;
        var panenOplah2025 = 0;
        var panenCsr = 0;
        var panenRehabBencana = 0;

        if (item.details && item.details.length > 0) {
          for (var j = 0; j < item.details.length; j++) {
            var det = item.details[j];
            var valTanam = parseFloat(det.luas) || 0;
            var valPanen = parseFloat(det.luasPanen) || 0;
            var idx = getPadiColumnIndex_(det.jenisLtt);
            if (idx === 3) {
              lttReguler = valTanam;
              panenReguler = valPanen;
            } else if (idx === 4) {
              padiGogo = valTanam;
              panenPadiGogo = valPanen;
            } else if (idx === 5) {
              oplah2024 = valTanam;
              panenOplah2024 = valPanen;
            } else if (idx === 6) {
              oplah2025 = valTanam;
              panenOplah2025 = valPanen;
            } else if (idx === 7) {
              csr = valTanam;
              panenCsr = valPanen;
            } else if (idx === 8) {
              rehabBencana = valTanam;
              panenRehabBencana = valPanen;
            }
          }
        }

        var totalTarget = parseFloat(item.total) || 0;
        var totalTargetPanen = parseFloat(item.totalPanen) || 0;
        var ipEksisting = parseFloat(item.ip) || 0;
        var luasBakuSawah = parseFloat(item.luasBaku) || 0;
        var luasStandingCrop = 0;

        var rowValues = [
          bulanInt,
          kecamatan,
          namaDesa,
          lttReguler,
          padiGogo,
          oplah2024,
          oplah2025,
          csr,
          rehabBencana,
          totalTarget,
          panenReguler,
          panenPadiGogo,
          panenOplah2024,
          panenOplah2025,
          panenCsr,
          panenRehabBencana,
          totalTargetPanen,
          ipEksisting,
          luasBakuSawah,
          luasStandingCrop,
          pembuatStr,
          waktu,
        ];

        if (rowIndex !== -1) {
          sheet.getRange(rowIndex, 1, 1, 22).setValues([rowValues]);
          sheetData[rowIndex - 1] = rowValues;
        } else {
          sheet.appendRow(rowValues);
          sheetData.push(rowValues);
        }
        savedCount++;
      } else {
        var totalTarget = parseFloat(item.total) || 0;
        var totalTargetPanen = parseFloat(item.totalPanen) || 0;
        var ipEksisting = parseFloat(item.ip) || 0;
        var luasBaku = parseFloat(item.luasBaku) || 0;
        var rowValues = [
          bulanInt,
          kecamatan,
          namaDesa,
          totalTarget,
          totalTargetPanen,
          ipEksisting,
          luasBaku,
          pembuatStr,
          waktu,
        ];

        if (rowIndex !== -1) {
          sheet.getRange(rowIndex, 1, 1, 9).setValues([rowValues]);
          sheetData[rowIndex - 1] = rowValues;
        } else {
          sheet.appendRow(rowValues);
          sheetData.push(rowValues);
        }
        savedCount++;
      }
    }

    rebuildTargetKecamatan(ss);
    invalidateAllTargetCaches();
    clearAllAppCaches();

    return {
      status: 'success',
      savedCount: savedCount,
      errors: errors,
    };
  } catch (e) {
    console.error('Error simpanBulkTargetDesa: ' + e.toString());
    return { status: 'error', message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function hapusTargetBulanan(idTarget) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var deleted = false;

    if (idTarget && idTarget.indexOf('|') !== -1) {
      var parts = idTarget.split('|');
      var level = parts[0];

      if (level === 'Desa') {
        var bulan = parseInt(parts[1]);
        var kec = parts[2].trim().toLowerCase();
        var desa = parts[3].trim().toLowerCase();
        var komoditas = parts[4].trim();
        var normKom = komoditas.toLowerCase().replace(/\s+/g, '');

        var sheetName = '';
        if (normKom === 'padi') {
          sheetName = 'Target_Desa_Padi';
        } else if (normKom === 'jagung') {
          sheetName = 'Target_Desa_Jagung';
        } else if (normKom === 'ubikayu') {
          sheetName = 'Target_Desa_UbiKayu';
        }

        if (sheetName) {
          var sheet = ss.getSheetByName(sheetName);
          if (sheet && sheet.getLastRow() > 1) {
            var data = sheet.getDataRange().getValues();
            for (var i = data.length - 1; i >= 1; i--) {
              var rBulan = parseInt(data[i][0]);
              var rKec = String(data[i][1]).trim().toLowerCase();
              var rDesa = String(data[i][2]).trim().toLowerCase();
              if (rBulan === bulan && rKec === kec && rDesa === desa) {
                sheet.deleteRow(i + 1);
                deleted = true;
                break;
              }
            }
          }
        }

        if (deleted) {
          rebuildTargetKecamatan(ss);
          // Invalidate cache
          cacheDeleteTarget('target_desa_' + normKom + '_' + bulan);
        }
      } else if (level === 'Kabupaten') {
        var bulan = parseInt(parts[1]);
        var komoditas = parts[2].trim().toLowerCase();

        var sheet = ss.getSheetByName('Target_Kabupaten');
        if (sheet && sheet.getLastRow() > 1) {
          var data = sheet.getDataRange().getValues();
          for (var i = data.length - 1; i >= 1; i--) {
            var rBulan = parseInt(data[i][0]);
            var rKom = String(data[i][1]).trim().toLowerCase();
            if (rBulan === bulan && rKom === komoditas) {
              sheet.deleteRow(i + 1);
              deleted = true;
              break;
            }
          }
        }
        if (deleted) {
          var normKom = komoditas.toLowerCase().replace(/\s+/g, '');
          cacheDeleteTarget('target_kabupaten_' + normKom + '_' + bulan);
        }
      }
    } else {
      var parts = idTarget.split('-');
      if (parts.length >= 4) {
        var bulan = parseInt(parts[0]);
        var level = parts[1];
        var geografi = parts[2].replace(/_/g, ' ');
        var komoditas = parts[3];

        if (level === 'Desa') {
          var normKom = komoditas.toLowerCase().replace(/\s+/g, '');
          var sheetName = '';
          if (normKom === 'padi') sheetName = 'Target_Desa_Padi';
          else if (normKom === 'jagung') sheetName = 'Target_Desa_Jagung';
          else if (normKom === 'ubikayu') sheetName = 'Target_Desa_UbiKayu';

          if (sheetName) {
            var sheet = ss.getSheetByName(sheetName);
            if (sheet && sheet.getLastRow() > 1) {
              var data = sheet.getDataRange().getValues();
              for (var i = data.length - 1; i >= 1; i--) {
                var rBulan = parseInt(data[i][0]);
                var rDesa = String(data[i][2]).trim().toLowerCase();
                var cleanGeo = geografi.toLowerCase();
                if (rBulan === bulan && cleanGeo.indexOf(rDesa) !== -1) {
                  sheet.deleteRow(i + 1);
                  deleted = true;
                  break;
                }
              }
            }
          }
          if (deleted) {
            rebuildTargetKecamatan(ss);
            cacheDeleteTarget('target_desa_' + normKom + '_' + bulan);
          }
        } else if (level === 'Kabupaten') {
          var sheet = ss.getSheetByName('Target_Kabupaten');
          if (sheet && sheet.getLastRow() > 1) {
            var data = sheet.getDataRange().getValues();
            for (var i = data.length - 1; i >= 1; i--) {
              var rBulan = parseInt(data[i][0]);
              var rKom = String(data[i][1]).trim().toLowerCase();
              if (rBulan === bulan && rKom === komoditas.toLowerCase()) {
                sheet.deleteRow(i + 1);
                deleted = true;
                break;
              }
            }
          }
          if (deleted) {
            var normKom = komoditas.toLowerCase().replace(/\s+/g, '');
            cacheDeleteTarget('target_kabupaten_' + normKom + '_' + bulan);
          }
        }
      }
    }

    clearAllAppCaches();
    return { status: 'success' };
  } catch (e) {
    console.error('Error hapusTargetBulanan: ' + e.toString());
    return { status: 'error', message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function importTargetEpusluh(bulan, komoditas, dataArray, pembuat) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    var normKom = komoditas.toLowerCase().replace(/\s+/g, '');
    var sheetName = '';
    if (normKom === 'padi') {
      sheetName = 'Target_Desa_Padi';
    } else if (normKom === 'jagung') {
      sheetName = 'Target_Desa_Jagung';
    } else if (normKom === 'ubikayu') {
      sheetName = 'Target_Desa_UbiKayu';
    } else {
      return {
        status: 'error',
        message: 'Komoditas tidak dikenal: ' + komoditas,
      };
    }

    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return {
        status: 'error',
        message: 'Sheet tidak ditemukan: ' + sheetName,
      };
    }

    var shGeo = ss.getSheetByName('Data_Geografi');
    if (!shGeo) {
      return {
        status: 'error',
        message: 'Sheet Data_Geografi tidak ditemukan',
      };
    }

    var pembuatStr = pembuat || 'ePusluh Import';
    var waktu = new Date();

    var dataGeo = shGeo.getDataRange().getValues();
    var values = sheet.getDataRange().getValues();
    var headers = values[0];
    var colCount = headers.length;

    // Build lookup map from dataArray scraping results: key = "kecamatan|desa" -> targetHa
    var epusluhMap = {};
    for (var j = 0; j < dataArray.length; j++) {
      var item = dataArray[j];
      var desa = String(item.namaDesa || '')
        .trim()
        .toLowerCase();
      var kec = String(item.namaKecamatan || '')
        .trim()
        .toLowerCase();
      var targetHa = parseFloat(item.targetHa) || 0;
      if (!desa) continue;
      if (!kec) {
        kec = lookupKecamatanFromDesa_(ss, item.namaDesa).toLowerCase();
      }
      if (!kec) continue;
      var key = kec + '|' + desa;
      epusluhMap[key] = targetHa;
    }

    // Build row index map from existing target sheet
    var rowMap = {};
    for (var i = 1; i < values.length; i++) {
      var rBulan = parseInt(values[i][0]);
      var rKec = String(values[i][1]).trim().toLowerCase();
      var rDesa = String(values[i][2]).trim().toLowerCase();
      var key = rBulan + '|' + rKec + '|' + rDesa;
      rowMap[key] = i;
    }

    var updatedCount = 0;
    var insertedCount = 0;
    var processedDesas = {};

    // For every village in Data_Geografi list
    for (var i = 1; i < dataGeo.length; i++) {
      var kecMaster = String(dataGeo[i][1]).trim();
      var desaMaster = String(dataGeo[i][3]).trim();
      if (!kecMaster || !desaMaster) continue;

      var matchKey = kecMaster.toLowerCase() + '|' + desaMaster.toLowerCase();
      if (processedDesas.hasOwnProperty(matchKey)) continue;
      processedDesas[matchKey] = true;

      var targetHa = epusluhMap.hasOwnProperty(matchKey)
        ? epusluhMap[matchKey]
        : 0;
      var sheetKey =
        bulan + '|' + kecMaster.toLowerCase() + '|' + desaMaster.toLowerCase();
      var isPadi = normKom === 'padi';

      if (rowMap.hasOwnProperty(sheetKey)) {
        var idx = rowMap[sheetKey];
        if (isPadi) {
          values[idx][3] = targetHa; // LTT_Reguler
          values[idx][4] = 0; // Padi_Gogo
          values[idx][5] = 0; // Oplah_2024
          values[idx][6] = 0; // Oplah_2025
          values[idx][7] = 0; // CSR
          values[idx][8] = 0; // Rehab_Bencana
          values[idx][9] = targetHa; // Total_Target_Tanam
          values[idx][10] = 0; // Panen_Reguler
          values[idx][11] = 0; // Panen_Padi_Gogo
          values[idx][12] = 0; // Panen_Oplah_2024
          values[idx][13] = 0; // Panen_Oplah_2025
          values[idx][14] = 0; // Panen_CSR
          values[idx][15] = 0; // Panen_Rehab_Bencana
          values[idx][16] = 0; // Total_Target_Panen
          values[idx][17] = 0; // IP_Eksisting
          values[idx][18] = 0; // Luas_Baku_Sawah
          values[idx][19] = 0; // Luas_Standing_Crop
          values[idx][20] = pembuatStr;
          values[idx][21] = waktu;
        } else {
          values[idx][3] = targetHa; // Total_Target_Tanam
          values[idx][4] = 0; // Total_Target_Panen
          values[idx][5] = 0; // IP_Eksisting
          values[idx][6] = 0; // Luas_Baku
          values[idx][7] = pembuatStr;
          values[idx][8] = waktu;
        }
        updatedCount++;
      } else {
        var newRow = [];
        if (isPadi) {
          newRow = [
            bulan,
            kecMaster,
            desaMaster,
            targetHa, // LTT_Reguler
            0, // Padi_Gogo
            0, // Oplah_2024
            0, // Oplah_2025
            0, // CSR
            0, // Rehab_Bencana
            targetHa, // Total_Target_Tanam
            0, // Panen_Reguler
            0, // Panen_Padi_Gogo
            0, // Panen_Oplah_2024
            0, // Panen_Oplah_2025
            0, // Panen_CSR
            0, // Panen_Rehab_Bencana
            0, // Total_Target_Panen
            0, // IP_Eksisting
            0, // Luas_Baku_Sawah
            0, // Luas_Standing_Crop
            pembuatStr,
            waktu,
          ];
        } else {
          newRow = [
            bulan,
            kecMaster,
            desaMaster,
            targetHa, // Total_Target_Tanam
            0, // Total_Target_Panen
            0, // IP_Eksisting
            0, // Luas_Baku
            pembuatStr,
            waktu,
          ];
        }
        values.push(newRow);
        rowMap[sheetKey] = values.length - 1;
        insertedCount++;
      }
    }

    colCount = values[0].length;
    sheet.getRange(1, 1, values.length, colCount).setValues(values);

    rebuildTargetKecamatan(ss);

    // Invalidate cache
    var normKom = komoditas.toLowerCase().replace(/\s+/g, '');
    cacheDeleteTarget('target_desa_' + normKom + '_' + bulan);

    clearAllAppCaches();
    return {
      status: 'success',
      imported: dataArray.length,
      updated: updatedCount,
      inserted: insertedCount,
    };
  } catch (e) {
    console.error('importTargetEpusluh: ' + e.toString());
    return { status: 'error', message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function rebuildTargetKecamatan(ss) {
  if (!ss) ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var shKec = ss.getSheetByName('Target_Kecamatan');
  if (!shKec) return;

  var groups = {};
  var nowStr = Utilities.formatDate(
    new Date(),
    'Asia/Jakarta',
    'yyyy-MM-dd HH:mm:ss',
  );

  var shPadi = ss.getSheetByName('Target_Desa_Padi');
  if (shPadi && shPadi.getLastRow() > 1) {
    var data = shPadi.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var bul = parseInt(data[i][0]);
      var kec = String(data[i][1]).trim();
      var totTanam = parseFloat(data[i][9]) || 0;
      var totPanen = parseFloat(data[i][16]) || 0;
      if (!kec || isNaN(bul)) continue;

      var key = bul + '|Padi|' + kec;
      if (!groups[key]) groups[key] = { tanam: 0, panen: 0 };
      groups[key].tanam += totTanam;
      groups[key].panen += totPanen;
    }
  }

  var shJagung = ss.getSheetByName('Target_Desa_Jagung');
  if (shJagung && shJagung.getLastRow() > 1) {
    var data = shJagung.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var bul = parseInt(data[i][0]);
      var kec = String(data[i][1]).trim();
      var totTanam = parseFloat(data[i][3]) || 0;
      var totPanen = parseFloat(data[i][4]) || 0;
      if (!kec || isNaN(bul)) continue;

      var key = bul + '|Jagung|' + kec;
      if (!groups[key]) groups[key] = { tanam: 0, panen: 0 };
      groups[key].tanam += totTanam;
      groups[key].panen += totPanen;
    }
  }

  var shUbi = ss.getSheetByName('Target_Desa_UbiKayu');
  if (shUbi && shUbi.getLastRow() > 1) {
    var data = shUbi.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var bul = parseInt(data[i][0]);
      var kec = String(data[i][1]).trim();
      var totTanam = parseFloat(data[i][3]) || 0;
      var totPanen = parseFloat(data[i][4]) || 0;
      if (!kec || isNaN(bul)) continue;

      var key = bul + '|Ubi Kayu|' + kec;
      if (!groups[key]) groups[key] = { tanam: 0, panen: 0 };
      groups[key].tanam += totTanam;
      groups[key].panen += totPanen;
    }
  }

  if (shKec.getLastRow() > 1) {
    shKec.getRange(2, 1, shKec.getLastRow() - 1, 6).clearContent();
  }

  var rows = [];
  for (var key in groups) {
    var parts = key.split('|');
    var bul = parseInt(parts[0]);
    var kom = parts[1];
    var kec = parts[2];
    var tanam = groups[key].tanam;
    var panen = groups[key].panen;
    rows.push([bul, kom, kec, tanam, panen, nowStr]);
  }

  if (rows.length > 0) {
    shKec.getRange(2, 1, rows.length, 6).setValues(rows);
  }
  invalidateAllKecamatanCache();
}

function lookupKecamatanFromDesa_(ss, desaName) {
  try {
    var shGeo = ss.getSheetByName('Data_Geografi');
    if (!shGeo) return '';
    var data = shGeo.getDataRange().getValues();
    var cleanDesa = desaName.trim().toLowerCase();
    for (var i = 1; i < data.length; i++) {
      var rDesa = String(data[i][3]).trim().toLowerCase();
      if (rDesa === cleanDesa) {
        return String(data[i][1]).trim();
      }
    }
  } catch (e) {
    console.error('Error lookupKecamatanFromDesa_: ' + e.toString());
  }
  return '';
}

function findTargetRowIndex_(sheet, id, currentKeys, level) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return -1;

  if (id && id.indexOf('|') !== -1) {
    var parts = id.split('|');
    if (parts[0] === 'Desa' && level === 'Desa') {
      var oldBulan = parseInt(parts[1]);
      var oldKec = parts[2].trim().toLowerCase();
      var oldDesa = parts[3].trim().toLowerCase();

      for (var i = 1; i < data.length; i++) {
        var rBulan = parseInt(data[i][0]);
        var rKec = String(data[i][1]).trim().toLowerCase();
        var rDesa = String(data[i][2]).trim().toLowerCase();
        if (rBulan === oldBulan && rKec === oldKec && rDesa === oldDesa) {
          return i + 1;
        }
      }
    } else if (parts[0] === 'Kabupaten' && level === 'Kabupaten') {
      var oldBulan = parseInt(parts[1]);
      var oldKom = parts[2].trim().toLowerCase();

      for (var i = 1; i < data.length; i++) {
        var rBulan = parseInt(data[i][0]);
        var rKom = String(data[i][1]).trim().toLowerCase();
        if (rBulan === oldBulan && rKom === oldKom) {
          return i + 1;
        }
      }
    }
  }

  if (level === 'Desa') {
    var curBulan = parseInt(currentKeys.bulan);
    var curKec = currentKeys.kecamatan.trim().toLowerCase();
    var curDesa = currentKeys.namaGeografi.trim().toLowerCase();

    for (var i = 1; i < data.length; i++) {
      var rBulan = parseInt(data[i][0]);
      var rKec = String(data[i][1]).trim().toLowerCase();
      var rDesa = String(data[i][2]).trim().toLowerCase();
      if (rBulan === curBulan && rKec === curKec && rDesa === curDesa) {
        return i + 1;
      }
    }
  } else if (level === 'Kabupaten') {
    var curBulan = parseInt(currentKeys.bulan);
    var curKom = currentKeys.komoditas.trim().toLowerCase();

    for (var i = 1; i < data.length; i++) {
      var rBulan = parseInt(data[i][0]);
      var rKom = String(data[i][1]).trim().toLowerCase();
      if (rBulan === curBulan && rKom === curKom) {
        return i + 1;
      }
    }
  }

  return -1;
}

function getPadiColumnIndex_(lttType) {
  var normalized = String(lttType).trim().replace(/\s+/g, ' ').toLowerCase();
  if (normalized === 'ltt reguler') return 3;
  if (normalized === 'ltt padi gogo' || normalized === 'padi gogo') return 4;
  if (normalized === 'ltt oplah 2024' || normalized === 'oplah 2024') return 5;
  if (normalized === 'ltt oplah 2025' || normalized === 'oplah 2025') return 6;
  if (normalized === 'ltt csr' || normalized === 'csr') return 7;
  if (
    normalized === 'ltt rehap bencana' ||
    normalized === 'ltt rehab bencana' ||
    normalized === 'rehab bencana'
  )
    return 8;
  return -1;
}

function migrasiTargetKeV2() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  var shBulanan = ss.getSheetByName('Target_Bulanan');
  var shDetail = ss.getSheetByName('Target_Detail_Jenis');

  if (!shBulanan) {
    Logger.log('Sheet Target_Bulanan tidak ditemukan. Migrasi dibatalkan.');
    return 'Error: Target_Bulanan tidak ditemukan.';
  }

  var dataBulanan = shBulanan.getDataRange().getValues();
  var detailsMap = {};

  if (shDetail && shDetail.getLastRow() > 1) {
    var dataDetail = shDetail.getDataRange().getValues();
    for (var j = 1; j < dataDetail.length; j++) {
      var idTargetRef = String(dataDetail[j][1]).trim();
      var jenisLtt = String(dataDetail[j][2]).trim();
      var luas = parseFloat(dataDetail[j][3]) || 0;

      if (!detailsMap[idTargetRef]) {
        detailsMap[idTargetRef] = [];
      }
      detailsMap[idTargetRef].push({ jenisLtt: jenisLtt, luas: luas });
    }
  }

  var padiRows = [];
  var jagungRows = [];
  var ubiRows = [];
  var kabRows = [];

  for (var i = 1; i < dataBulanan.length; i++) {
    var idTarget = String(dataBulanan[i][0]).trim();
    var bulan = parseInt(dataBulanan[i][1]);
    var level = String(dataBulanan[i][2]).trim();
    var kodeGeografi = String(dataBulanan[i][3]).trim();
    var namaGeografi = String(dataBulanan[i][4]).trim();
    var komoditas = String(dataBulanan[i][5]).trim();
    var totalTarget = parseFloat(dataBulanan[i][6]) || 0;
    var ipEksisting = parseFloat(dataBulanan[i][7]) || 0;
    var luasBakuSawah = parseFloat(dataBulanan[i][8]) || 0;
    var luasStandingCrop = parseFloat(dataBulanan[i][9]) || 0;
    var pembuat = String(dataBulanan[i][10] || 'System');
    var waktu =
      dataBulanan[i][11] instanceof Date ? dataBulanan[i][11] : new Date();

    if (isNaN(bulan) || !komoditas) continue;

    var normKom = komoditas.toLowerCase().replace(/\s+/g, '');

    if (level === 'Desa') {
      var kec = '';
      if (
        kodeGeografi &&
        kodeGeografi !== idTarget &&
        kodeGeografi.toLowerCase().indexOf('desa') === -1
      ) {
        kec = kodeGeografi;
      } else {
        kec = lookupKecamatanFromDesa_(ss, namaGeografi);
      }
      if (!kec) {
        kec = 'Lainnya';
      }

      if (normKom === 'padi') {
        var lttReguler = 0;
        var padiGogo = 0;
        var oplah2024 = 0;
        var oplah2025 = 0;
        var csr = 0;
        var rehabBencana = 0;

        var details = detailsMap[idTarget] || [];
        if (details.length > 0) {
          for (var d = 0; d < details.length; d++) {
            var det = details[d];
            var val = det.luas;
            var idx = getPadiColumnIndex_(det.jenisLtt);
            if (idx === 3) lttReguler = val;
            else if (idx === 4) padiGogo = val;
            else if (idx === 5) oplah2024 = val;
            else if (idx === 6) oplah2025 = val;
            else if (idx === 7) csr = val;
            else if (idx === 8) rehabBencana = val;
          }
        } else {
          lttReguler = totalTarget;
        }

        padiRows.push([
          bulan,
          kec,
          namaGeografi,
          lttReguler,
          padiGogo,
          oplah2024,
          oplah2025,
          csr,
          rehabBencana,
          totalTarget,
          ipEksisting,
          luasBakuSawah,
          luasStandingCrop,
          pembuat,
          waktu,
        ]);
      } else if (normKom === 'jagung') {
        jagungRows.push([
          bulan,
          kec,
          namaGeografi,
          totalTarget,
          pembuat,
          waktu,
        ]);
      } else if (normKom === 'ubikayu') {
        ubiRows.push([bulan, kec, namaGeografi, totalTarget, pembuat, waktu]);
      }
    } else if (level === 'Kabupaten') {
      kabRows.push([bulan, komoditas, totalTarget, pembuat, waktu]);
    }
  }

  var shPadi = ss.getSheetByName('Target_Desa_Padi');
  if (shPadi && padiRows.length > 0) {
    if (shPadi.getLastRow() > 1) {
      shPadi.getRange(2, 1, shPadi.getLastRow() - 1, 15).clearContent();
    }
    shPadi.getRange(2, 1, padiRows.length, 15).setValues(padiRows);
    Logger.log(
      'Migrasi Target_Desa_Padi sukses: ' + padiRows.length + ' baris.',
    );
  }

  var shJagung = ss.getSheetByName('Target_Desa_Jagung');
  if (shJagung && jagungRows.length > 0) {
    if (shJagung.getLastRow() > 1) {
      shJagung.getRange(2, 1, shJagung.getLastRow() - 1, 6).clearContent();
    }
    shJagung.getRange(2, 1, jagungRows.length, 6).setValues(jagungRows);
    Logger.log(
      'Migrasi Target_Desa_Jagung sukses: ' + jagungRows.length + ' baris.',
    );
  }

  var shUbi = ss.getSheetByName('Target_Desa_UbiKayu');
  if (shUbi && ubiRows.length > 0) {
    if (shUbi.getLastRow() > 1) {
      shUbi.getRange(2, 1, shUbi.getLastRow() - 1, 6).clearContent();
    }
    shUbi.getRange(2, 1, ubiRows.length, 6).setValues(ubiRows);
    Logger.log(
      'Migrasi Target_Desa_UbiKayu sukses: ' + ubiRows.length + ' baris.',
    );
  }

  var shKab = ss.getSheetByName('Target_Kabupaten');
  if (shKab && kabRows.length > 0) {
    if (shKab.getLastRow() > 1) {
      shKab.getRange(2, 1, shKab.getLastRow() - 1, 5).clearContent();
    }
    shKab.getRange(2, 1, kabRows.length, 5).setValues(kabRows);
    Logger.log(
      'Migrasi Target_Kabupaten sukses: ' + kabRows.length + ' baris.',
    );
  }

  rebuildTargetKecamatan(ss);
  invalidateAllTargetCaches();
  clearAllAppCaches();

  Logger.log('Migrasi target selesai dengan sukses.');
  return (
    'Sukses memigrasikan ' +
    (padiRows.length + jagungRows.length + ubiRows.length + kabRows.length) +
    ' data target.'
  );
}

function migrasiTargetKeV3() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Jalankan inisialisasi database dulu untuk memastikan header diperbarui
  inisialisasiDatabase_();

  var migrasiCount = 0;

  // 2. Migrasi Target_Desa_Padi
  var shPadi = ss.getSheetByName('Target_Desa_Padi');
  if (shPadi && shPadi.getLastRow() > 1) {
    var values = shPadi.getDataRange().getValues();
    var padiRows = [];
    var isMigrated = false;

    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      // Jika kolom ke-22 (indeks 21, Waktu_Update) kosong, artinya data ini masih format V2 (15 kolom)
      if (
        row.length < 22 ||
        row[21] === '' ||
        row[21] === null ||
        row[21] === undefined
      ) {
        var newRow = [
          row[0], // Bulan
          row[1], // Nama_Kecamatan
          row[2], // Nama_Desa
          row[3], // LTT_Reguler
          row[4], // Padi_Gogo
          row[5], // Oplah_2024
          row[6], // Oplah_2025
          row[7], // CSR
          row[8], // Rehab_Bencana
          row[9], // Total_Target_Tanam
          0, // Panen_Reguler
          0, // Panen_Padi_Gogo
          0, // Panen_Oplah_2024
          0, // Panen_Oplah_2025
          0, // Panen_CSR
          0, // Panen_Rehab_Bencana
          0, // Total_Target_Panen
          parseFloat(row[10]) || 0, // IP_Eksisting (dari kolom ke-11 V2)
          parseFloat(row[11]) || 0, // Luas_Baku_Sawah (dari kolom ke-12 V2)
          0, // Luas_Standing_Crop (di-default ke 0)
          row[13] || 'System', // Pembuat (dari kolom ke-14 V2)
          row[14] || new Date(), // Waktu_Update (dari kolom ke-15 V2)
        ];
        padiRows.push(newRow);
        isMigrated = true;
      } else {
        padiRows.push(row);
      }
    }

    if (isMigrated && padiRows.length > 0) {
      shPadi
        .getRange(2, 1, shPadi.getLastRow() - 1, shPadi.getLastColumn())
        .clearContent();
      shPadi.getRange(2, 1, padiRows.length, 22).setValues(padiRows);
      migrasiCount += padiRows.length;
      Logger.log('Target_Desa_Padi berhasil dimigrasikan ke V3.');
    }
  }

  // 3. Migrasi Target_Desa_Jagung
  var shJagung = ss.getSheetByName('Target_Desa_Jagung');
  if (shJagung && shJagung.getLastRow() > 1) {
    var values = shJagung.getDataRange().getValues();
    var jagungRows = [];
    var isMigrated = false;

    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      // Jika kolom ke-9 (indeks 8, Waktu_Update) kosong, artinya data ini masih format V2 (6 kolom)
      if (
        row.length < 9 ||
        row[8] === '' ||
        row[8] === null ||
        row[8] === undefined
      ) {
        var newRow = [
          row[0], // Bulan
          row[1], // Nama_Kecamatan
          row[2], // Nama_Desa
          row[3], // Total_Target_Tanam
          0, // Total_Target_Panen
          0, // IP_Eksisting
          0, // Luas_Baku
          row[4] || 'System', // Pembuat (dari kolom ke-5 V2)
          row[5] || new Date(), // Waktu_Update (dari kolom ke-6 V2)
        ];
        jagungRows.push(newRow);
        isMigrated = true;
      } else {
        jagungRows.push(row);
      }
    }

    if (isMigrated && jagungRows.length > 0) {
      shJagung
        .getRange(2, 1, shJagung.getLastRow() - 1, shJagung.getLastColumn())
        .clearContent();
      shJagung.getRange(2, 1, jagungRows.length, 9).setValues(jagungRows);
      migrasiCount += jagungRows.length;
      Logger.log('Target_Desa_Jagung berhasil dimigrasikan ke V3.');
    }
  }

  // 4. Migrasi Target_Desa_UbiKayu
  var shUbi = ss.getSheetByName('Target_Desa_UbiKayu');
  if (shUbi && shUbi.getLastRow() > 1) {
    var values = shUbi.getDataRange().getValues();
    var ubiRows = [];
    var isMigrated = false;

    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      // Jika kolom ke-9 (indeks 8, Waktu_Update) kosong, artinya data ini masih format V2 (6 kolom)
      if (
        row.length < 9 ||
        row[8] === '' ||
        row[8] === null ||
        row[8] === undefined
      ) {
        var newRow = [
          row[0], // Bulan
          row[1], // Nama_Kecamatan
          row[2], // Nama_Desa
          row[3], // Total_Target_Tanam
          0, // Total_Target_Panen
          0, // IP_Eksisting
          0, // Luas_Baku
          row[4] || 'System', // Pembuat
          row[5] || new Date(), // Waktu_Update
        ];
        ubiRows.push(newRow);
        isMigrated = true;
      } else {
        ubiRows.push(row);
      }
    }

    if (isMigrated && ubiRows.length > 0) {
      shUbi
        .getRange(2, 1, shUbi.getLastRow() - 1, shUbi.getLastColumn())
        .clearContent();
      shUbi.getRange(2, 1, ubiRows.length, 9).setValues(ubiRows);
      migrasiCount += ubiRows.length;
      Logger.log('Target_Desa_UbiKayu berhasil dimigrasikan ke V3.');
    }
  }

  // 5. Migrasi Target_Kabupaten
  var shKab = ss.getSheetByName('Target_Kabupaten');
  if (shKab && shKab.getLastRow() > 1) {
    var values = shKab.getDataRange().getValues();
    var kabRows = [];
    var isMigrated = false;

    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      // Jika kolom ke-6 (indeks 5, Waktu_Update) kosong, artinya data ini masih format V2 (5 kolom)
      if (
        row.length < 6 ||
        row[5] === '' ||
        row[5] === null ||
        row[5] === undefined
      ) {
        var newRow = [
          row[0], // Bulan
          row[1], // Komoditas
          row[2], // Total_Target_Tanam
          0, // Total_Target_Panen
          row[3] || 'System', // Pembuat
          row[4] || new Date(), // Waktu_Update
        ];
        kabRows.push(newRow);
        isMigrated = true;
      } else {
        kabRows.push(row);
      }
    }

    if (isMigrated && kabRows.length > 0) {
      shKab
        .getRange(2, 1, shKab.getLastRow() - 1, shKab.getLastColumn())
        .clearContent();
      shKab.getRange(2, 1, kabRows.length, 6).setValues(kabRows);
      migrasiCount += kabRows.length;
      Logger.log('Target_Kabupaten berhasil dimigrasikan ke V3.');
    }
  }

  // 6. Rebuild Target_Kecamatan secara otomatis
  rebuildTargetKecamatan(ss);

  invalidateAllTargetCaches();
  clearAllAppCaches();

  Logger.log('Migrasi V3 selesai.');
  return (
    'Sukses memigrasikan ' + migrasiCount + ' data target ke struktur V3 baru.'
  );
}

// =========================================================================
// FUNGSI LAPORAN LTT — DETAIL LENGKAP (ADMIN)
// =========================================================================

/**
 * Mengambil data laporan LTT lengkap dari Data_LTT (Jagung & Ubi Kayu)
 * dan Data_LTT_Padi (Padi), digabung menjadi satu array.
 *
 * @param {Object} params - { tanggal, kecamatan, desa, komoditas }
 *   - tanggal  : string "yyyy-MM-dd" atau null (default: 30 hari terakhir)
 *   - kecamatan: string atau null (semua)
 *   - desa     : string atau null (semua)
 *   - komoditas: "Padi" | "Jagung" | "Ubi Kayu" | null (semua)
 * @returns {Object} { status, data: [...], total }
 */
function getLaporanLTT(params) {
  try {
    var cache = CacheService.getScriptCache();
    var version = cache.get('DB_VERSION') || '1';
    var paramStr = JSON.stringify(params || {});
    var cacheKey =
      'laporan_ltt_v' + version + '_' + Utilities.base64Encode(paramStr);
    var cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var now = new Date();

    // Parse params
    var filterTglMulai =
      params && params.tanggalMulai
        ? params.tanggalMulai.toString().trim()
        : null;
    var filterTglSelesai =
      params && params.tanggalSelesai
        ? params.tanggalSelesai.toString().trim()
        : null;
    var filterKec =
      params && params.kecamatan
        ? params.kecamatan.toString().trim().toLowerCase()
        : null;
    var filterDesa =
      params && params.desa
        ? params.desa.toString().trim().toLowerCase()
        : null;
    var filterKom =
      params && params.komoditas ? params.komoditas.toString().trim() : null;

    // Default: 30 hari terakhir jika tidak ada filter tanggal sama sekali
    var tglMulai = null;
    var tglAkhir = null;
    if (!filterTglMulai && !filterTglSelesai) {
      var tglAkhirDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      var tglMulaiDate = new Date(
        tglAkhirDate.getTime() - 29 * 24 * 60 * 60 * 1000,
      );
      tglMulai = Utilities.formatDate(
        tglMulaiDate,
        'Asia/Jakarta',
        'yyyy-MM-dd',
      );
      tglAkhir = Utilities.formatDate(
        tglAkhirDate,
        'Asia/Jakarta',
        'yyyy-MM-dd',
      );
    }

    var hasil = [];

    // Helper: proses satu sheet
    function prosesSheet(namaSheet, komoditasDefault) {
      var sheet = ss.getSheetByName(namaSheet);
      if (!sheet || sheet.getLastRow() <= 1) return;
      var rows = sheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        if (!row[1]) continue;

        var tglObj = parseTanggalEPusluh_(row[1]);
        if (!tglObj) continue;
        var tglStr = Utilities.formatDate(tglObj, 'Asia/Jakarta', 'yyyy-MM-dd');

        // Filter rentang tanggal
        if (filterTglMulai && filterTglSelesai) {
          if (tglStr < filterTglMulai || tglStr > filterTglSelesai) continue;
        } else if (filterTglMulai) {
          if (tglStr < filterTglMulai) continue;
        } else if (filterTglSelesai) {
          if (tglStr > filterTglSelesai) continue;
        } else {
          if (tglStr < tglMulai || tglStr > tglAkhir) continue;
        }

        // Tentukan komoditas
        var kom = komoditasDefault
          ? komoditasDefault
          : (row[5] || '').toString().trim();

        // Filter komoditas
        if (filterKom) {
          if (kom.toLowerCase() !== filterKom.toLowerCase()) continue;
        }

        // Filter kecamatan
        var kec = (row[3] || '').toString().trim();
        if (filterKec && kec.toLowerCase() !== filterKec) continue;

        // Filter desa
        var desa = (row[4] || '').toString().trim();
        if (filterDesa && desa.toLowerCase() !== filterDesa) continue;

        var jenisLTT =
          kom.toLowerCase() === 'padi' ? (row[6] || '').toString() : '';

        hasil.push({
          id: (row[0] || '').toString(),
          timestamp:
            tglStr +
            ' ' +
            Utilities.formatDate(tglObj, 'Asia/Jakarta', 'HH:mm'),
          pelapor: (row[2] || '').toString(),
          kecamatan: kec,
          desa: desa,
          komoditas: kom,
          jenis_ltt: jenisLTT,
          target_tanam: parseFloat(row[7]) || 0,
          target_panen: parseFloat(row[8]) || 0,
          luas_bera: parseFloat(row[9]) || 0,
          olah_lahan: parseFloat(row[10]) || 0,
          luas_tanam: parseFloat(row[11]) || 0,
          luas_panen: parseFloat(row[12]) || 0,
          keterangan: (row[13] || '').toString(),
          status: (row[14] || 'Menunggu').toString(),
        });
      }
    }

    // Tentukan sheet sumber berdasarkan bulan filter
    function getSheetSumber_(prefix) {
      var refStr = filterTglMulai || filterTglSelesai; // format "YYYY-MM-DD"
      if (refStr && refStr.match(/^\d{4}-\d{2}/)) {
        var p = refStr.split('-');
        var y = parseInt(p[0]), m = parseInt(p[1]) - 1; // 0-indexed
        if (m !== now.getMonth() || y !== now.getFullYear()) {
          return [prefix + '_' + Utilities.formatDate(new Date(y, m, 1), 'Asia/Jakarta', 'yyyy_MM')];
        }
      }
      return [prefix];
    }

    var komLower = filterKom ? filterKom.toLowerCase() : null;
    if (!komLower || komLower === 'jagung' || komLower === 'ubi kayu') {
      getSheetSumber_('Data_LTT').forEach(function (n) { prosesSheet(n, null); });
    }
    if (!komLower || komLower === 'padi') {
      getSheetSumber_('Data_LTT_Padi').forEach(function (n) { prosesSheet(n, 'Padi'); });
    }

    // Sort terbaru dulu berdasarkan timestamp
    hasil.sort(function (a, b) {
      return b.timestamp.localeCompare(a.timestamp);
    });

    var result = { status: 'success', data: hasil, total: hasil.length };

    // Cache 5 menit
    try {
      cache.put(cacheKey, JSON.stringify(result), 300);
    } catch (cacheErr) {
      // Abaikan jika data terlalu besar untuk cache
    }

    return result;
  } catch (e) {
    Logger.log('getLaporanLTT error: ' + e.toString());
    return { status: 'error', message: e.toString() };
  }
}

/**
 * Mengambil daftar kecamatan unik dari Data_LTT dan Data_LTT_Padi
 * untuk dropdown filter Laporan LTT.
 */
function getKecamatanLaporan() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var kecSet = {};

    function scan(namaSheet) {
      var sh = ss.getSheetByName(namaSheet);
      if (!sh || sh.getLastRow() <= 1) return;
      var rows = sh.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        var kec = (rows[i][3] || '').toString().trim();
        if (kec) kecSet[kec] = true;
      }
    }

    scan('Data_LTT');
    scan('Data_LTT_Padi');

    return Object.keys(kecSet).sort();
  } catch (e) {
    return [];
  }
}

function getDesaLaporan(kecamatan) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var desaSet = {};
    var kecLower = (kecamatan || '').toString().trim().toLowerCase();

    function scan(namaSheet) {
      var sh = ss.getSheetByName(namaSheet);
      if (!sh || sh.getLastRow() <= 1) return;
      var rows = sh.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        var kec = (rows[i][3] || '').toString().trim().toLowerCase();
        if (kecLower && kec !== kecLower) continue;
        var desa = (rows[i][4] || '').toString().trim();
        if (desa) desaSet[desa] = true;
      }
    }

    scan('Data_LTT');
    scan('Data_LTT_Padi');

    return Object.keys(desaSet).sort();
  } catch (e) {
    return [];
  }
}

/**
 * Mengambil rekap target dan realisasi bulanan untuk PPL tertentu berdasarkan NIP,
 * bulan-bulan (1-indexed), dan tahun.
 */
function getRekapBulananPPL(nip, bulanList, tahun) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // 1. Dapatkan data user dari NIP untuk mengambil nama, kecamatan, dan desa binaan
    var sheetUser = ss.getSheetByName('Data_User');
    var users = sheetUser.getDataRange().getValues();
    var userObj = null;
    for (var i = 1; i < users.length; i++) {
      if (users[i][2].toString() === nip.toString()) {
        userObj = {
          nama: users[i][1],
          nip: users[i][2].toString(),
          role: users[i][4],
          kecamatan: users[i][5],
          desa: users[i][6],
        };
        break;
      }
    }

    if (!userObj) {
      throw new Error('Pengguna dengan NIP ' + nip + ' tidak ditemukan.');
    }

    var cleanKec = (userObj.kecamatan || '').toString().trim().toLowerCase();
    var desaList = [];

    if (userObj.role === 'Admin_BPP') {
      // Admin_BPP: ambil semua desa di kecamatan dari Data_Geografi
      var shGeo = ss.getSheetByName('Data_Geografi');
      if (shGeo && shGeo.getLastRow() > 1) {
        var geoData = shGeo.getDataRange().getValues();
        for (var g = 1; g < geoData.length; g++) {
          var gKec = (geoData[g][1] || '').toString().toLowerCase().trim();
          if (gKec === cleanKec && geoData[g][3]) {
            desaList.push(geoData[g][3].toString().trim());
          }
        }
        desaList = Array.from(new Set(desaList)).sort();
      }
    } else {
      // Penyuluh: hanya desa binaan sendiri
      var desaStr = (userObj.desa || '').toString();
      desaList = desaStr
        .split(',')
        .map(function (d) {
          return d.trim();
        })
        .filter(Boolean);
    }

    var cleanDesaList = desaList.map(function (d) {
      return d.toLowerCase();
    });

    var resultTargets = [];
    var resultReports = [];

    var commodities = ['Padi', 'Jagung', 'Ubi Kayu'];

    // 2. Ambil data target
    commodities.forEach(function (kom) {
      var normKom = kom.toLowerCase().replace(/\s+/g, '');
      var sheetName = '';
      if (normKom === 'padi') {
        sheetName = 'Target_Desa_Padi';
      } else if (normKom === 'jagung') {
        sheetName = 'Target_Desa_Jagung';
      } else if (normKom === 'ubikayu') {
        sheetName = 'Target_Desa_UbiKayu';
      }

      var sh = ss.getSheetByName(sheetName);
      if (sh && sh.getLastRow() > 1) {
        var data = sh.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          var rBulan = parseInt(data[i][0]);
          if (bulanList.indexOf(rBulan) === -1) continue;

          var rKec = String(data[i][1]).trim().toLowerCase();
          var rDesa = String(data[i][2]).trim().toLowerCase();

          if (rKec === cleanKec && cleanDesaList.indexOf(rDesa) !== -1) {
            var origDesaIdx = cleanDesaList.indexOf(rDesa);
            var origDesaName = desaList[origDesaIdx];

            var targetObj = {
              bulan: rBulan,
              desa: origDesaName,
              komoditas: kom,
              totalTarget: 0,
              luasBakuSawah: 0,
              luasStandingCrop: 0,
            };

            if (normKom === 'padi') {
              targetObj.totalTarget = parseFloat(data[i][9]) || 0;
              targetObj.luasBakuSawah = parseFloat(data[i][11]) || 0;
              targetObj.luasStandingCrop = parseFloat(data[i][12]) || 0;
            } else {
              targetObj.totalTarget = parseFloat(data[i][3]) || 0;
            }

            resultTargets.push(targetObj);
          }
        }
      }
    });

    // 3. Ambil data laporan/realisasi
    var now = new Date();
    var currentMonth0 = now.getMonth();
    var currentYear = now.getFullYear();

    bulanList.forEach(function (bulanVal) {
      var bulan0 = bulanVal - 1;
      var isPast = bulan0 !== currentMonth0 || tahun !== currentYear;
      var namaLTT, namaPadi;

      if (isPast) {
        var monthStr = (bulanVal < 10 ? '0' : '') + bulanVal;
        var sfx = tahun + '_' + monthStr;
        namaLTT = 'Data_LTT_' + sfx;
        namaPadi = 'Data_LTT_Padi_' + sfx;
      } else {
        namaLTT = 'Data_LTT';
        namaPadi = 'Data_LTT_Padi';
      }

      // Ambil laporan Jagung & Ubi Kayu
      var shLTT = ss.getSheetByName(namaLTT);
      if (shLTT && shLTT.getLastRow() > 1) {
        var rows = shLTT.getDataRange().getValues();
        for (var i = 1; i < rows.length; i++) {
          if (!rows[i][1]) continue;
          var tgl = parseTanggalEPusluh_(rows[i][1]);
          if (!tgl) continue;

          var tglM = tgl.getMonth();
          var tglY = tgl.getFullYear();
          if (tglM !== bulan0 || tglY !== tahun) continue;

          var rKec = String(rows[i][3]).trim().toLowerCase();
          var rDesa = String(rows[i][4]).trim().toLowerCase();
          var komoditas = String(rows[i][5]).trim();
          var normKom = komoditas.toLowerCase().replace(/\s+/g, ' ');

          if (rKec === cleanKec && cleanDesaList.indexOf(rDesa) !== -1) {
            var origDesaIdx = cleanDesaList.indexOf(rDesa);
            var origDesaName = desaList[origDesaIdx];

            var mapKom = '';
            if (normKom === 'jagung') mapKom = 'Jagung';
            else if (normKom === 'ubi kayu' || normKom === 'ubikayu')
              mapKom = 'Ubi Kayu';
            else continue;

            resultReports.push({
              bulan: bulanVal,
              desa: origDesaName,
              komoditas: mapKom,
              tanam: parseFloat(rows[i][11]) || 0,
              panen: parseFloat(rows[i][12]) || 0,
            });
          }
        }
      }

      // Ambil laporan Padi
      var shPadi = ss.getSheetByName(namaPadi);
      if (shPadi && shPadi.getLastRow() > 1) {
        var rows = shPadi.getDataRange().getValues();
        for (var i = 1; i < rows.length; i++) {
          if (!rows[i][1]) continue;
          var tgl = parseTanggalEPusluh_(rows[i][1]);
          if (!tgl) continue;

          var tglM = tgl.getMonth();
          var tglY = tgl.getFullYear();
          if (tglM !== bulan0 || tglY !== tahun) continue;

          var rKec = String(rows[i][3]).trim().toLowerCase();
          var rDesa = String(rows[i][4]).trim().toLowerCase();

          if (rKec === cleanKec && cleanDesaList.indexOf(rDesa) !== -1) {
            var origDesaIdx = cleanDesaList.indexOf(rDesa);
            var origDesaName = desaList[origDesaIdx];

            resultReports.push({
              bulan: bulanVal,
              desa: origDesaName,
              komoditas: 'Padi',
              tanam: parseFloat(rows[i][11]) || 0,
              panen: parseFloat(rows[i][12]) || 0,
            });
          }
        }
      }
    });

    return {
      status: 'success',
      desaList: desaList,
      targets: resultTargets,
      reports: resultReports,
    };
  } catch (e) {
    console.error('Error getRekapBulananPPL: ' + e.toString());
    return {
      status: 'error',
      message: e.toString(),
    };
  }
}

/**
 * Mengambil realisasi tanam dan panen untuk PPL tertentu pada satu tanggal spesifik.
 * @param {string} nip
 * @param {string} tanggal - format 'YYYY-MM-DD'
 */
function getRekapHarianPPL(nip, tanggal) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // 1. Ambil data user
    var sheetUser = ss.getSheetByName('Data_User');
    var users = sheetUser.getDataRange().getValues();
    var userObj = null;
    for (var i = 1; i < users.length; i++) {
      if (users[i][2].toString() === nip.toString()) {
        userObj = {
          nip: users[i][2].toString(),
          role: users[i][4],
          kecamatan: users[i][5],
          desa: users[i][6],
        };
        break;
      }
    }
    if (!userObj) throw new Error('Pengguna dengan NIP ' + nip + ' tidak ditemukan.');

    var cleanKec = (userObj.kecamatan || '').toString().trim().toLowerCase();
    var desaList = [];

    if (userObj.role === 'Admin_BPP') {
      var shGeo = ss.getSheetByName('Data_Geografi');
      if (shGeo && shGeo.getLastRow() > 1) {
        var geoData = shGeo.getDataRange().getValues();
        for (var g = 1; g < geoData.length; g++) {
          var gKec = (geoData[g][1] || '').toString().toLowerCase().trim();
          if (gKec === cleanKec && geoData[g][3]) {
            desaList.push(geoData[g][3].toString().trim());
          }
        }
        desaList = Array.from(new Set(desaList)).sort();
      }
    } else {
      desaList = (userObj.desa || '').toString().split(',').map(function(d) { return d.trim(); }).filter(Boolean);
    }

    var cleanDesaList = desaList.map(function(d) { return d.toLowerCase(); });

    // 2. Parse tanggal target
    var parts = tanggal.split('-');
    var tglYear  = parseInt(parts[0]);
    var tglMonth0 = parseInt(parts[1]) - 1;
    var tglDay   = parseInt(parts[2]);

    // 3. Tentukan nama sheet
    var now = new Date();
    var isPast = (tglMonth0 !== now.getMonth() || tglYear !== now.getFullYear());
    var namaLTT, namaPadi;
    if (isPast) {
      var monthStr = (tglMonth0 + 1 < 10 ? '0' : '') + (tglMonth0 + 1);
      var sfx = tglYear + '_' + monthStr;
      namaLTT  = 'Data_LTT_' + sfx;
      namaPadi = 'Data_LTT_Padi_' + sfx;
    } else {
      namaLTT  = 'Data_LTT';
      namaPadi = 'Data_LTT_Padi';
    }

    var resultReports = [];

    // 4. Jagung & Ubi Kayu
    var shLTT = ss.getSheetByName(namaLTT);
    if (shLTT && shLTT.getLastRow() > 1) {
      var rows = shLTT.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (!rows[i][1]) continue;
        var tgl = parseTanggalEPusluh_(rows[i][1]);
        if (!tgl) continue;
        if (tgl.getFullYear() !== tglYear || tgl.getMonth() !== tglMonth0 || tgl.getDate() !== tglDay) continue;

        var rKec  = String(rows[i][3]).trim().toLowerCase();
        var rDesa = String(rows[i][4]).trim().toLowerCase();
        if (rKec !== cleanKec) continue;
        var dIdx = cleanDesaList.indexOf(rDesa);
        if (dIdx === -1) continue;

        var normKom = String(rows[i][5]).trim().toLowerCase().replace(/\s+/g, ' ');
        var mapKom = '';
        if (normKom === 'jagung') mapKom = 'Jagung';
        else if (normKom === 'ubi kayu' || normKom === 'ubikayu') mapKom = 'Ubi Kayu';
        else continue;

        resultReports.push({
          desa: desaList[dIdx],
          komoditas: mapKom,
          tanam: parseFloat(rows[i][11]) || 0,
          panen: parseFloat(rows[i][12]) || 0,
        });
      }
    }

    // 5. Padi
    var shPadi = ss.getSheetByName(namaPadi);
    if (shPadi && shPadi.getLastRow() > 1) {
      var rows = shPadi.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (!rows[i][1]) continue;
        var tgl = parseTanggalEPusluh_(rows[i][1]);
        if (!tgl) continue;
        if (tgl.getFullYear() !== tglYear || tgl.getMonth() !== tglMonth0 || tgl.getDate() !== tglDay) continue;

        var rKec  = String(rows[i][3]).trim().toLowerCase();
        var rDesa = String(rows[i][4]).trim().toLowerCase();
        if (rKec !== cleanKec) continue;
        var dIdx = cleanDesaList.indexOf(rDesa);
        if (dIdx === -1) continue;

        resultReports.push({
          desa: desaList[dIdx],
          komoditas: 'Padi',
          tanam: parseFloat(rows[i][11]) || 0,
          panen: parseFloat(rows[i][12]) || 0,
        });
      }
    }

    return {
      status: 'success',
      desaList: desaList,
      reports: resultReports,
    };
  } catch (e) {
    console.error('Error getRekapHarianPPL: ' + e.toString());
    return { status: 'error', message: e.toString() };
  }
}
