const SPREADSHEET_ID = '1woRRTrpDvxeZfIvNCpQL77ZaIGeabTiKm8IVhYxaDDk';

// =========================================================================
// FUNGSI AUTHENTICATION
// =========================================================================

function prosesLogin(nip, password) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'USER_' + nip;
  var cachedData = cache.get(cacheKey);

  if (cachedData) {
    var cached = JSON.parse(cachedData);
    var cachedPassword = (cached.password !== undefined ? cached.password : (cached.pin !== undefined ? cached.pin : "")).toString();
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
      message: 'Password Salah (Sistem telah menyegarkan data, silakan coba lagi)',
    };
  }

  var sheet =
    SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_User');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][2].toString() === nip.toString()) {
      if (data[i][3].toString() === password.toString() && data[i][7] === 'Aktif') {
        var userData = {
          id: data[i][0],
          nama: data[i][1],
          nip: data[i][2].toString(),
          role: data[i][4],
          kecamatan: data[i][5],
          desa: data[i][6],
        };
        var cacheEntry = { password: data[i][3].toString(), userData: userData };
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
    ]);
    CacheService.getScriptCache().remove(
      'DASH_KAB_' + timestamp.getFullYear() + '_' + timestamp.getMonth(),
    );
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

// =========================================================================
// FUNGSI ANTI-TYPO & DOUBLE CHECK (NAMA & DESA)
// =========================================================================

function bersihNama_(nama) {
  if (!nama) return "";
  // Normalisasi: huruf kecil, hapus gelar umum, hapus spasi/tanda baca/angka
  return nama.toString().toLowerCase()
    .replace(/(,\s*(s\.?p|s\.?st|s\.?t|m\.?si|h\.?|m\.?pd|se|sh|ak|pt|dr|drh|ir))|(\.(s\.?p|s\.?st|s\.?t|m\.?si|h\.?|m\.?pd|se|sh|ak|pt|dr|drh|ir))/gi, "") 
    .replace(/[^a-z]/gi, "") // Ambil hanya huruf a-z
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
    var komTarget  = komoditas.toString().toLowerCase().trim();
    
    // Pastikan daftarDesaUser adalah array yang sudah dibersihkan
    var listDesa = [];
    if (Array.isArray(daftarDesaUser)) {
      listDesa = daftarDesaUser.map(function(d) { return d.toString().toLowerCase().trim(); });
    } else {
      listDesa = (daftarDesaUser || "").toString().split(',').map(function(d) { return d.toLowerCase().trim(); });
    }

    var hasil = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[1]) continue; // Lewati jika tidak ada timestamp (Kolom B)
      
      // Ambil tanggal dari kolom Timestamp
      var tglObj = row[1] instanceof Date ? row[1] : new Date(row[1]);
      var tglRowStr = Utilities.formatDate(tglObj, 'Asia/Jakarta', 'yyyy-MM-dd');
      
      var namaRow = bersihNama_(row[2]);
      var desaRow = (row[4] || '').toString().toLowerCase().trim();
      var komRow  = (row[5] || '').toString().toLowerCase().trim();

      // Pengecekan ganda yang lebih toleran
      if (tglRowStr === todayStr && 
          namaRow === namaTarget && 
          listDesa.indexOf(desaRow) !== -1 && 
          komRow === komTarget) {
        
        var jam = Utilities.formatDate(tglObj, 'Asia/Jakarta', 'HH:mm');
        hasil.push({
          id:     row[0],
          desa:   row[4],
          tanam:  row[11] || 0,
          panen:  row[12] || 0,
          status: row[14] || 'Menunggu',
          jam:    jam
        });
      }
    }
    
    // Urutkan berdasarkan waktu terbaru (Jam)
    hasil.sort(function(a, b) {
      return b.jam.localeCompare(a.jam);
    });
    
    return { status: 'success', data: hasil };
  } catch(e) {
    console.error("Error getLaporanPPLHariIni: " + e.toString());
    return { status: 'error', message: e.toString() };
  }
}

// =========================================================================
// FUNGSI BACKUP
// =========================================================================

function backupDatabaseHarian() {
  var file = DriveApp.getFileById(SPREADSHEET_ID);
  var folder = DriveApp.getFoldersByName('Backup_eLTT').hasNext()
    ? DriveApp.getFoldersByName('Backup_eLTT').next()
    : DriveApp.createFolder('Backup_eLTT');

  var namaBackup =
    'Backup_eLTT_' +
    Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd_HHmm');
  file.makeCopy(namaBackup, folder);
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
      logSheet.appendRow(['ID_Sync', 'Waktu_Sinkron', 'Total_Tarik', 'Data_Berisi', 'Data_Nihil', 'Tanggal_Laporan', 'Status']);
      logSheet.getRange('A1:G1').setFontWeight('bold').setBackground('#fce5cd');
      logSheet.setFrozenRows(1);
    } else {
      // Validasi Header (Jika versi lama, paksa ganti ke versi baru 7 kolom)
      var currentHeader = logSheet.getRange(1, 1, 1, 7).getValues()[0];
      if (currentHeader[5] !== 'Tanggal_Laporan') {
         logSheet.getRange(1, 1, 1, 7).setValues([['ID_Sync', 'Waktu_Sinkron', 'Total_Tarik', 'Data_Berisi', 'Data_Nihil', 'Tanggal_Laporan', 'Status']]);
         logSheet.getRange('A1:G1').setFontWeight('bold').setBackground('#fce5cd');
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
        'Sukses (Injeksi)'
      ]);
    } else {
      logSheet.appendRow(['Manual/Unknown', new Date(), dataArray ? dataArray.length : 0, '?', '?', '-', 'Sukses (Tanpa LogData)']);
    }

    var sheet = ss.getSheetByName('Data_LTT_Padi');

    if (!sheet) {
      // (Logika pembuatan sheet baru tetap sama seperti sebelumnya)
      sheet = ss.insertSheet('Data_LTT_Padi');
      var header = [
        'ID_Laporan',
        'Waktu_Lapor',
        'Pelapor',
        'Kecamatan',
        'Desa',
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
      ];
      sheet.appendRow(header);
      sheet.setFrozenRows(1);
    }

    // 1. Identifikasi Tanggal Unik dari data yang baru ditarik
    // Mengambil bagian "Mei 7, 2026" dari string "Mei 7, 2026 11:20:00"
    var datesToReplace = dataArray.map(function (r) {
      return r[1].split(' ').slice(0, 3).join(' ');
    });
    var uniqueDatesToReplace = [...new Set(datesToReplace)];

    // 2. Ambil semua data yang ada di Sheet saat ini
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var allData = sheet.getRange(2, 1, lastRow - 1, 17).getValues();

      // 3. Filter: Buang data lama yang tanggalnya cocok dengan data baru
      var dataTetap = allData.filter(function (row) {
        var tglSheet = row[1].toString().split(' ').slice(0, 3).join(' ');
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
      sheet
        .getRange(2, 1, dataArray.length, dataArray[0].length)
        .setValues(dataArray);
    }

    rebuiltPadiRingkasan_(ss, dataArray);
    return { status: 'success', inserted: dataArray.length };
  } catch (e) {
    if (logData) {
       var logSheetErr = ss.getSheetByName('Logs_Sinkron');
       if(logSheetErr) logSheetErr.appendRow([logData.idSync, logData.waktuSinkron, logData.totalTarik, logData.dataBerisi, logData.dataNihil, logData.tanggalLaporan || '-', 'Error: ' + e.toString()]);
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
    logs.push({
      idSync: data[i][0],
      waktuSinkron: data[i][1],
      totalTarik: data[i][2],
      dataBerisi: data[i][3],
      dataNihil: data[i][4],
      tanggalLaporan: data[i][5],
      status: data[i][6]
    });
  }
  // Sort by waktuSinkron descending (newest first)
  logs.sort(function(a, b) {
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
    ? daftarDesaUser.map(function(d) { return d.toString().toLowerCase().trim(); })
    : (daftarDesaUser || '').toString().split(',').map(function(d) { return d.toLowerCase().trim(); });
  var data = sheet.getDataRange().getValues();
  var hariIni = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy');
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var dp = parseTanggalEPusluh_(data[i][1]);
    if (!dp) continue;
    var tgl = Utilities.formatDate(dp, 'Asia/Jakarta', 'dd/MM/yyyy');
    if (tgl === hariIni && listDesa.indexOf(data[i][4].toString().toLowerCase().trim()) !== -1) {
      rows.push({
        desa: data[i][4],
        jenis_ltt: data[i][6] || 'Padi',
        tanam: parseFloat(data[i][11]) || 0,
        panen: parseFloat(data[i][12]) || 0
      });
    }
  }
  return rows.length > 0 ? { status: 'sudah', rows: rows } : { status: 'belum', rows: [] };
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

    idLaporanArray.forEach(function (id) {
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === id) {
          sheet.getRange(i + 1, 15).setValue(statusBaru);
          sheet.getRange(i + 1, kolomWaktu + 1).setValue(timestamp);
          break;
        }
      }
    });

    CacheService.getScriptCache().remove(
      'DASH_KAB_' + timestamp.getFullYear() + '_' + timestamp.getMonth(),
    );
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
  var cacheKey = 'DASH_KAB_' + (filterTanggal ? filterTanggal : tahunFilter + '_' + bulanFilter);
  var cached = cache.get(cacheKey);
  if (cached && !params.forceRefresh) return JSON.parse(cached);

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

  // === PATH CEPAT: Ringkasan_Harian (~ratusan baris, tidak perlu scan ribuan raw) ===
  var sheetRK = ss.getSheetByName('Ringkasan_Harian');
  var rkAda = false;
  if (sheetRK && sheetRK.getLastRow() > 1) {
    var rkData = sheetRK.getDataRange().getValues();
    for (var i = 1; i < rkData.length; i++) {
      var tglStr = (rkData[i][0] || '').toString();
      if (!tglStr || tglStr.indexOf('-') < 0) continue;
      
      if (filterTanggal) {
        if (tglStr !== filterTanggal) continue;
      } else {
        var p = tglStr.split('-');
        if (parseInt(p[1]) - 1 !== bulanFilter || parseInt(p[0]) !== tahunFilter)
          continue;
      }
      rkAda = true;
      var kom = (rkData[i][1] || '').toString();
      var jen = (rkData[i][2] || '').toString();
      var tam = parseFloat(rkData[i][3]) || 0;
      var pan = parseFloat(rkData[i][4]) || 0;
      if (komposisiTanam.hasOwnProperty(kom)) {
        komposisiTanam[kom] += tam;
        komposisiPanen[kom] += pan;
        if (kom === 'Padi' && jen) {
          breakdownPadi.tanam[jen] = (breakdownPadi.tanam[jen] || 0) + tam;
          breakdownPadi.panen[jen] = (breakdownPadi.panen[jen] || 0) + pan;
        }
      }
      if (
        isoToLabel[tglStr] &&
        trenMap[isoToLabel[tglStr]].hasOwnProperty(kom)
      ) {
        trenMap[isoToLabel[tglStr]][kom] += tam;
      }
    }
  }

  // === FALLBACK: raw scan jika Ringkasan_Harian belum ada/belum diisi untuk bulan ini ===
  if (!rkAda) {
    var rawRows = getAllLTTRows_(bulanFilter, tahunFilter);
    for (var ri = 1; ri < rawRows.length; ri++) {
      if (!rawRows[ri][1]) continue;
      var tgl = parseTanggalEPusluh_(rawRows[ri][1]);
      if (
        !tgl ||
        tgl.getMonth() !== bulanFilter ||
        tgl.getFullYear() !== tahunFilter
      )
        continue;
      var rKom = (rawRows[ri][5] || '').toString();
      var rJen = (rawRows[ri][6] || '').toString();
      var rTam = parseFloat(rawRows[ri][11]) || 0;
      var rPan = parseFloat(rawRows[ri][12]) || 0;
      if (komposisiTanam.hasOwnProperty(rKom)) {
        komposisiTanam[rKom] += rTam;
        komposisiPanen[rKom] += rPan;
        if (rKom === 'Padi' && rJen) {
          breakdownPadi.tanam[rJen] = (breakdownPadi.tanam[rJen] || 0) + rTam;
          breakdownPadi.panen[rJen] = (breakdownPadi.panen[rJen] || 0) + rPan;
        }
      }
      var rkLabel = Utilities.formatDate(tgl, 'Asia/Jakarta', 'dd/MM');
      if (trenMap[rkLabel] && trenMap[rkLabel].hasOwnProperty(rKom)) {
        trenMap[rkLabel][rKom] += rTam;
      }
    }
  }

  // === STATUS COUNTS: hanya baca Data_LTT bulan tersebut (cepat setelah diarsip) ===
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
    komposisiTanam[k] = Math.round(komposisiTanam[k] * 10) / 10;
    komposisiPanen[k] = Math.round(komposisiPanen[k] * 10) / 10;
  });
  for (var bk in breakdownPadi.tanam) {
    breakdownPadi.tanam[bk] = Math.round(breakdownPadi.tanam[bk] * 10) / 10;
    breakdownPadi.panen[bk] = Math.round(breakdownPadi.panen[bk] * 10) / 10;
  }

  var result = {
    totalTanam:
      Math.round(
        (komposisiTanam['Padi'] +
          komposisiTanam['Jagung'] +
          komposisiTanam['Ubi Kayu']) *
          10,
      ) / 10,
    totalPanen:
      Math.round(
        (komposisiPanen['Padi'] +
          komposisiPanen['Jagung'] +
          komposisiPanen['Ubi Kayu']) *
          10,
      ) / 10,
    pctVerified:
      countTotal > 0 ? Math.round((countVerified / countTotal) * 100) : 0,
    countMenunggu: countMenunggu,
    trenLabels: trenLabels,
    trenPadi: trenLabels.map(function (l) {
      return Math.round(trenMap[l].Padi * 10) / 10;
    }),
    trenJagung: trenLabels.map(function (l) {
      return Math.round(trenMap[l].Jagung * 10) / 10;
    }),
    trenUbiKayu: trenLabels.map(function (l) {
      return Math.round(trenMap[l]['Ubi Kayu'] * 10) / 10;
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

function getAntreanKabupaten() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheetUser = ss.getSheetByName('Data_User');
  var users = sheetUser.getDataRange().getValues();
  var data = getAllLTTRows_();

  // Build map from all kecamatan in Data_User
  var kecMap = {};
  for (var j = 1; j < users.length; j++) {
    var kec = (users[j][5] || '').toString().trim();
    if (kec && !kecMap[kec]) {
      kecMap[kec] = {
        totalLaporan: 0,
        belumBPP: 0,
        siapVerif: 0,
        sudahKab: 0,
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
    var kec = (data[i][3] || '').toString().trim();
    var status = (data[i][14] || '').toString();
    var id = (data[i][0] || '').toString();
    if (status) countTotal++;
    if (status === 'Terverifikasi Kabupaten') countVerified++;
    if (!kecMap[kec]) continue;
    kecMap[kec].totalLaporan++;
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
      users[j][4] === 'Penyuluh' &&
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

    if (status === 'Menunggu') {
      laporanMenunggu.push([
        (data[i][0] || '').toString(),
        Utilities.formatDate(tgl, 'Asia/Jakarta', 'dd/MM/yyyy'),
        pelapor,
        (data[i][4] || '').toString(),
        komoditas,
        Math.round(tanam * 10) / 10,
        Math.round(panen * 10) / 10,
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
// FUNGSI REKAP PADI HARIAN (e-Pusluh)
// =========================================================================

// Parse tanggal dari e-Pusluh: "Mei 6, 2026 06:50:10" atau Date object
function parseTanggalEPusluh_(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  var d = new Date(val.toString());
  if (!isNaN(d.getTime())) return d;
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
  if (m && bulan.hasOwnProperty(m[1])) {
    return new Date(parseInt(m[3]), bulan[m[1]], parseInt(m[2]));
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
    listKecamatan = ['Bahuga', 'Banjit', 'Baradatu', 'Blambangan Umpu', 'Buay Bahuga', 'Bumi Agung', 'Gunung Labuhan', 'Kasui', 'Negara Batin', 'Negeri Agung', 'Negeri Besar', 'Pakuan Ratu', 'Rebang Tangkas', 'Umpu Semenguk', 'Way Tuba'].sort();
  }

  // Siapkan objek output harian
  var harian = {
    rows: [], count: 0, totalTanam: 0, totalPanen: 0, totalBera: 0, totalOlah: 0, jenisLTTList: [], breakdown: {}
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
      if (!harian.breakdown[jenis]) harian.breakdown[jenis] = { tanam: 0, panen: 0 };
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
        Math.round(bera * 10) / 10,
        Math.round(olah * 10) / 10,
        Math.round(tanam * 10) / 10,
        Math.round(panen * 10) / 10,
        (data[i][13] || '-').toString(),
      ]);

      // Kecamatan Accumulation
      var key = kec + '|' + jenis;
      if (!kecJenisMap[key]) kecJenisMap[key] = { kec: kec, jenis: jenis, tanam: 0, panen: 0 };
      kecJenisMap[key].tanam += tanam;
      kecJenisMap[key].panen += panen;
    }
  }

  // Format Harian output
  harian.rows.sort(function (a, b) {
    return a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]);
  });
  for (var key in harian.breakdown) {
    harian.breakdown[key].tanam = Math.round(harian.breakdown[key].tanam * 10) / 10;
    harian.breakdown[key].panen = Math.round(harian.breakdown[key].panen * 10) / 10;
  }
  harian.count = harian.rows.length;
  harian.totalTanam = Math.round(harian.totalTanam * 10) / 10;
  harian.totalPanen = Math.round(harian.totalPanen * 10) / 10;
  harian.totalBera = Math.round(harian.totalBera * 10) / 10;
  harian.totalOlah = Math.round(harian.totalOlah * 10) / 10;
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
      entries.sort(function (a, b) { return a.jenis.localeCompare(b.jenis); });
      entries.forEach(function (e) {
        kecRows.push([ e.kec, e.jenis, Math.round(e.tanam * 10) / 10, Math.round(e.panen * 10) / 10 ]);
        totalKecTanam += e.tanam;
        totalKecPanen += e.panen;
      });
    }
  });

  return {
    harian: harian,
    kecamatan: {
      rows: kecRows,
      totalTanam: Math.round(totalKecTanam * 10) / 10,
      totalPanen: Math.round(totalKecPanen * 10) / 10,
    }
  };
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
    su.appendRow(['ID_User', 'Nama_Penyuluh', 'NIP', 'Password', 'Role', 'Kecamatan', 'Desa_Binaan', 'Status_Aktif']);
    su.getRange('A1:H1').setFontWeight('bold').setBackground('#d9ead3');
    su.setFrozenRows(1);
  }

  // Sheet: Data_LTT
  if (!ss.getSheetByName('Data_LTT')) {
    var sl = ss.insertSheet('Data_LTT');
    sl.appendRow(['ID_Laporan', 'Waktu_Lapor', 'Pelapor', 'Kecamatan', 'Desa', 'Komoditas', 'Jenis_LTT',
      'Target_Tanam_Bln_Ini', 'Target_Panen_Bln_Ini', 'Luas_Lahan_Bera', 'Realisasi_Olah_Lahan',
      'Realisasi_Luas_Tanam', 'Realisasi_Luas_Panen', 'Keterangan', 'Status_Verifikasi',
      'Waktu_Verifikasi_BPP', 'Waktu_Verifikasi_Kab']);
    sl.getRange('A1:Q1').setFontWeight('bold').setBackground('#c9daf8');
    sl.setFrozenRows(1);
  }

  // Sheet: Data_LTT_Padi
  if (!ss.getSheetByName('Data_LTT_Padi')) {
    var sp = ss.insertSheet('Data_LTT_Padi');
    sp.appendRow(['ID_Laporan', 'Waktu_Lapor', 'Pelapor', 'Kecamatan', 'Desa', 'Komoditas', 'Jenis_LTT',
      'Target_Tanam_Bln_Ini', 'Target_Panen_Bln_Ini', 'Luas_Lahan_Bera', 'Realisasi_Olah_Lahan',
      'Realisasi_Luas_Tanam', 'Realisasi_Luas_Panen', 'Keterangan', 'Status_Verifikasi',
      'Waktu_Verifikasi_BPP', 'Waktu_Verifikasi_Kab']);
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

  // Sheet: Data_Target
  if (!ss.getSheetByName('Data_Target')) {
    var st = ss.insertSheet('Data_Target');
    st.appendRow(['ID_Target', 'BulanTahun', 'Kecamatan', 'LTTReguler_Tanam', 'LTTReguler_Panen',
      'PadiGogo_Tanam', 'PadiGogo_Panen', 'Oplah2025_Tanam', 'Oplah2025_Panen',
      'Jagung_Tanam', 'Jagung_Panen', 'UbiKayu_Tanam', 'UbiKayu_Panen']);
    st.getRange('A1:M1').setFontWeight('bold').setBackground('#d0e0ff');
    st.setFrozenRows(1);
  }

  // Sheet: Ringkasan_Harian
  if (!ss.getSheetByName('Ringkasan_Harian')) {
    var sr = ss.insertSheet('Ringkasan_Harian');
    sr.appendRow(['Tanggal', 'Komoditas', 'Jenis_LTT', 'Total_Tanam', 'Total_Panen']);
    sr.getRange('A1:E1').setFontWeight('bold').setBackground('#d0e0ff');
    sr.setFrozenRows(1);
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
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Data_User');
  var data = sheet.getDataRange().getValues();

  // Validasi NIP Duplikat jika User Baru
  if (!u.id) {
    for (var i = 1; i < data.length; i++) {
      if (data[i][2].toString() === u.nip.toString()) {
        return { status: 'error', message: 'NIP/Username sudah terdaftar' };
      }
    }
  }

  if (u.id) {
    // Update
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == u.id) {
        sheet
          .getRange(i + 1, 1, 1, 8)
          .setValues([
            [u.id, u.nama, u.nip, u.password, u.role, u.kecamatan, u.desa, u.status],
          ]);
        // Clear cache
        CacheService.getScriptCache().remove('USER_' + u.nip);
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
  return { status: 'error', message: 'Terjadi kesalahan sistem' };
}

function hapusDataUser(id, nip) {
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
}

// =========================================================================
// FUNGSI UPDATE PROFIL MANDIRI (PPL & BPP)
// =========================================================================

function updateProfilUser(id, namaBaru, passwordLama, passwordBaru) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_User');
    var data  = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0].toString() !== id.toString()) continue;

      var passwordDiDB = data[i][3].toString();
      var nip     = data[i][2].toString();

      if (passwordLama.toString() !== passwordDiDB) {
        return { status: 'error', message: 'Password Aktif yang Anda masukkan salah.' };
      }

      var passwordFinal = passwordDiDB;
      if (passwordBaru && passwordBaru.toString().trim() !== '') {
        if (passwordBaru.toString().trim().length < 4) {
          return { status: 'error', message: 'Password Baru minimal harus 4 karakter.' };
        }
        passwordFinal = passwordBaru.toString().trim();
      }

      sheet.getRange(i + 1, 2).setValue(namaBaru.trim());
      sheet.getRange(i + 1, 4).setValue(passwordFinal);

      var cache    = CacheService.getScriptCache();
      var cacheKey = 'USER_' + nip;
      cache.remove(cacheKey);
      var updatedUserData = {
        id: data[i][0], nama: namaBaru.trim(), nip: nip,
        role: data[i][4], kecamatan: data[i][5], desa: data[i][6]
      };
      cache.put(cacheKey, JSON.stringify({ password: passwordFinal, userData: updatedUserData }), 21600);

      return { status: 'success', message: 'Profil berhasil diperbarui!', data: updatedUserData };
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
  CacheService.getScriptCache().remove('DASH_KAB_' + thn + '_' + b0);
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
    var tglSheet = data[i][0] instanceof Date 
      ? Utilities.formatDate(data[i][0], "Asia/Jakarta", "yyyy-MM-dd") 
      : data[i][0].toString();
      
    if (
      tglSheet === tanggal &&
      data[i][1] === komoditas &&
      data[i][2] === jenisLTT
    ) {
      data[i][3] = Math.round((parseFloat(data[i][3] || 0) + addTanam) * 100) / 100;
      data[i][4] = Math.round((parseFloat(data[i][4] || 0) + addPanen) * 100) / 100;
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
  var header = ['Tanggal', 'Komoditas', 'Jenis_LTT', 'Total_Tanam', 'Total_Panen'];
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
      var tglEx = ex[i][0] instanceof Date 
        ? Utilities.formatDate(ex[i][0], "Asia/Jakarta", "yyyy-MM-dd") 
        : ex[i][0].toString();
        
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

// =========================================================================
// FUNGSI TARGET LTT
// =========================================================================

function simpanTarget(formData) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Data_Target');
  if (!sheet) {
    sheet = ss.insertSheet('Data_Target');
    sheet.appendRow([
      'ID_Target',
      'BulanTahun',
      'Kecamatan',
      'LTTReguler_Tanam',
      'LTTReguler_Panen',
      'PadiGogo_Tanam',
      'PadiGogo_Panen',
      'Oplah2025_Tanam',
      'Oplah2025_Panen',
      'Jagung_Tanam',
      'Jagung_Panen',
      'UbiKayu_Tanam',
      'UbiKayu_Panen',
    ]);
    sheet.getRange('A1:M1').setFontWeight('bold').setBackground('#d0e0ff');
    sheet.setFrozenRows(1);
  }
  var bulan = parseInt(formData.bulan);
  var tahun = parseInt(formData.tahun);
  var bulanStr = (bulan < 10 ? '0' : '') + bulan;
  var bulanTahun = tahun + '-' + bulanStr;
  var id = bulanTahun + '-' + formData.kecamatan;
  var baris = [
    id,
    bulanTahun,
    formData.kecamatan,
    parseFloat(formData.LTTReguler_Tanam) || 0,
    parseFloat(formData.LTTReguler_Panen) || 0,
    parseFloat(formData.PadiGogo_Tanam) || 0,
    parseFloat(formData.PadiGogo_Panen) || 0,
    parseFloat(formData.Oplah2025_Tanam) || 0,
    parseFloat(formData.Oplah2025_Panen) || 0,
    parseFloat(formData.Jagung_Tanam) || 0,
    parseFloat(formData.Jagung_Panen) || 0,
    parseFloat(formData.UbiKayu_Tanam) || 0,
    parseFloat(formData.UbiKayu_Panen) || 0,
  ];
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 1, 1, 13).setValues([baris]);
      return { status: 'success', action: 'update' };
    }
  }
  sheet.appendRow(baris);
  return { status: 'success', action: 'insert' };
}

function getTargetKecamatan(params) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Data_Target');
  if (!sheet || sheet.getLastRow() <= 1) return null;
  var bulan = parseInt(params.bulan);
  var tahun = parseInt(params.tahun);
  var bulanStr = (bulan < 10 ? '0' : '') + bulan;
  var id = tahun + '-' + bulanStr + '-' + params.kecamatan;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      return {
        LTTReguler_Tanam: data[i][3],
        LTTReguler_Panen: data[i][4],
        PadiGogo_Tanam: data[i][5],
        PadiGogo_Panen: data[i][6],
        Oplah2025_Tanam: data[i][7],
        Oplah2025_Panen: data[i][8],
        Jagung_Tanam: data[i][9],
        Jagung_Panen: data[i][10],
        UbiKayu_Tanam: data[i][11],
        UbiKayu_Panen: data[i][12],
      };
    }
  }
  return null;
}

function getDashboardTarget(params) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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

  // 1. Target dari Data_Target
  var targetMap = {};
  var shTarget = ss.getSheetByName('Data_Target');
  if (shTarget && shTarget.getLastRow() > 1) {
    var tData = shTarget.getDataRange().getValues();
    for (var i = 1; i < tData.length; i++) {
      var rawBln = tData[i][1];
      var rowBulanTahun = (rawBln instanceof Date)
        ? Utilities.formatDate(rawBln, 'Asia/Jakarta', 'yyyy-MM')
        : rawBln.toString().trim();
      if (rowBulanTahun !== bulanTahun) continue;
      var kec = tData[i][2];
      targetMap[kec] = {
        LTTReguler: { tanam: tData[i][3],  panen: tData[i][4]  },
        PadiGogo:   { tanam: tData[i][5],  panen: tData[i][6]  },
        Oplah2025:  { tanam: tData[i][7],  panen: tData[i][8]  },
        Jagung:     { tanam: tData[i][9],  panen: tData[i][10] },
        UbiKayu:    { tanam: tData[i][11], panen: tData[i][12] },
      };
    }
  }

  // 2. Realisasi Jagung + Ubi Kayu dari Data_LTT (manual PPL)
  var realisasiMap = {};
  var namaLTT = isPast ? 'Data_LTT_' + tahun + '_' + bulanStr : 'Data_LTT';
  var shLTT = ss.getSheetByName(namaLTT);
  if (shLTT && shLTT.getLastRow() > 1) {
    var rows = shLTT.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var tgl = new Date(rows[i][1]);
      if (filterTanggal) {
        var isoStr = Utilities.formatDate(tgl, 'Asia/Jakarta', 'yyyy-MM-dd');
        if (isoStr !== filterTanggal) continue;
      } else {
        if (tgl.getMonth() !== bulan0 || tgl.getFullYear() !== tahun) continue;
      }
      var kec = rows[i][3];
      var kom = (rows[i][5] || '').toString();
      var tam = parseFloat(rows[i][11]) || 0;
      var pan = parseFloat(rows[i][12]) || 0;
      if (!realisasiMap[kec]) realisasiMap[kec] = initRealisasi_();
      if (kom === 'Jagung') {
        realisasiMap[kec].Jagung.tanam += tam;
        realisasiMap[kec].Jagung.panen += pan;
      }
      if (kom === 'Ubi Kayu') {
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
        if (tgl.getMonth() !== bulan0 || tgl.getFullYear() !== tahun) continue;
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

  return { target: targetMap, realisasi: realisasiMap, bulanTahun: bulanTahun };
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
      'Bahuga', 'Banjit', 'Baradatu', 'Blambangan Umpu', 'Buay Bahuga',
      'Bumi Agung', 'Gunung Labuhan', 'Kasui', 'Negara Batin', 'Negeri Agung',
      'Negeri Besar', 'Pakuan Ratu', 'Rebang Tangkas', 'Umpu Semenguk', 'Way Tuba',
    ].sort();
  }

  var harianTotalTanam = 0, harianTotalPanen = 0;
  var kecMap = {};

  var sheet = ss.getSheetByName('Data_LTT');
  if (sheet && sheet.getLastRow() > 1) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var tglDate = new Date(data[i][1]);
      if (isNaN(tglDate)) continue;
      var tgl = Utilities.formatDate(tglDate, 'Asia/Jakarta', 'yyyy-MM-dd');
      if (tgl < tglMulai || tgl > tglAkhir) continue;

      var kom = (data[i][5] || '').toString();
      if (kom !== komoditas) continue;

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
      var t = Math.round(kecMap[kec].tanam * 10) / 10;
      var p = Math.round(kecMap[kec].panen * 10) / 10;
      kecRows.push([kec, '-', t, p]);
      totalKecTanam += t;
      totalKecPanen += p;
    }
  });

  return {
    harian: {
      totalTanam: Math.round(harianTotalTanam * 10) / 10,
      totalPanen: Math.round(harianTotalPanen * 10) / 10
    },
    kecamatan: {
      rows: kecRows,
      totalTanam: Math.round(totalKecTanam * 10) / 10,
      totalPanen: Math.round(totalKecPanen * 10) / 10
    }
  };
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
  var nipCall = (nipPemanggil || "").toString().trim();
  for (var i = 1; i < data.length; i++) {
    var role = data[i][4];
    var kec = data[i][5];
    var nipRow = data[i][2].toString().trim();
    if ((role === 'Penyuluh' || role === 'Admin_BPP') && kec === kecamatan) {
      if (nipRow === nipCall) continue; // Jangan masukkan diri sendiri
      pplList.push({
        id: data[i][0],
        nama: data[i][1],
        nip: data[i][2].toString(),
        role: data[i][4],
        kecamatan: data[i][5],
        desa: data[i][6],
        status: data[i][7]
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
          return { status: 'error', message: 'Hanya password Penyuluh yang bisa direset.' };
        }
        
        sheet.getRange(i + 1, 4).setValue(passwordBaru);
        
        // Hapus cache
        CacheService.getScriptCache().remove('USER_' + nip);
        return { status: 'success', message: 'Password Penyuluh berhasil direset.' };
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
          return { status: 'error', message: 'Hanya data Penyuluh yang dapat diubah.' };
        }
        
        // Update Nama_Penyuluh (kolom 2), Desa_Binaan (kolom 7), Status_Aktif (kolom 8)
        sheet.getRange(i + 1, 2).setValue(u.nama);
        sheet.getRange(i + 1, 7).setValue(u.desa);
        sheet.getRange(i + 1, 8).setValue(u.status);
        
        // Clear cache
        CacheService.getScriptCache().remove('USER_' + nip);
        return { status: 'success', message: 'Data Penyuluh berhasil diperbarui.' };
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
    var targetKec = (kecamatan || "").toString().toLowerCase().trim();
    
    for (var i = 1; i < data.length; i++) {
      var kecName = (data[i][1] || "").toString().toLowerCase().trim();
      if (kecName === targetKec && data[i][3]) {
        desaList.push(data[i][3].toString().trim());
      }
    }
    // Hapus duplikat & urutkan alfabetis
    return Array.from(new Set(desaList)).sort();
  } catch (e) {
    console.error("Error getDaftarDesabyKecamatan: " + e.toString());
    return [];
  }
}


