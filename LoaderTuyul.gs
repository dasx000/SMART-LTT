// ==========================================
// KODE TUYUL TARGET DESA (v4 - Excel Opsional)
// ==========================================
function getKodeTuyulTarget() {
  return `(function(){
if(!document.getElementById('tuyul-loading-modal')){const d=document.createElement('div');d.id='tuyul-loading-modal';d.style='position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:99999999;font-family:-apple-system,BlinkMacSystemFont,sans-serif;';d.innerHTML='<div style="background:#fff;border-radius:16px;padding:32px;width:340px;box-shadow:0 20px 25px rgba(0,0,0,0.1);text-align:center;"><div style="width:50px;height:50px;border:4px solid #f3f3f3;border-top:4px solid #16a34a;border-radius:50%;animation:ts 1s linear infinite;margin:0 auto 20px;"></div><h2 style="margin:0 0 8px;font-size:20px;color:#1e293b;">Menyiapkan Target...</h2><p id="tuyul-status" style="margin:0;font-size:14px;color:#64748b;">Memulai...</p></div><style>@keyframes ts{100%{transform:rotate(360deg)}}</style>';document.body.appendChild(d);}
let l=0;
const init=()=>{l++;if(l===2){startTarget();}};
if(typeof ExcelJS==='undefined'){let s=document.createElement('script');s.src='https://unpkg.com/exceljs@4.3.0/dist/exceljs.min.js';s.onload=init;document.body.appendChild(s);}else init();
if(typeof Swal==='undefined'){let s=document.createElement('script');s.src='https://unpkg.com/sweetalert2@11';s.onload=init;document.body.appendChild(s);}else init();

function startTarget(){
  const ld=document.getElementById('tuyul-loading-modal');if(ld)ld.remove();
  
  const style=document.createElement('style');
  style.innerHTML='button.swal2-confirm{background:#16a34a !important;color:#ffffff !important;border:none !important;border-radius:8px !important;} button.swal2-confirm:hover{background:#15803d !important;} button.swal2-cancel{background:#f3f4f6 !important;color:#111827 !important;border:1px solid #d1d5db !important;border-radius:8px !important;}';
  document.head.appendChild(style);

  const GAS_URL='https://script.google.com/macros/s/AKfycbxQZAgRQcykQ96aaB0CsvYLjXUnZ4VF6iHXd3D6MZoDaPVb0EmvJ8SuovlU6818i2M9ag/exec';
  
  let blnInt=0,nmBln='';
  const BM={'januari':1,'februari':2,'maret':3,'april':4,'mei':5,'juni':6,'juli':7,'agustus':8,'september':9,'oktober':10,'november':11,'desember':12};
  const namaEl=document.querySelector('input[id="data.nama"]');
  if(namaEl&&namaEl.value){nmBln=namaEl.value.trim();blnInt=BM[nmBln.toLowerCase()]||0;}
  if(!blnInt){const pn=document.querySelector('.fi-resource-bulan-ltts');if(pn){const cl=Array.from(pn.classList).find(c=>c.startsWith('fi-resource-record-'));if(cl)blnInt=parseInt(cl.replace('fi-resource-record-',''));}}
  const NM=['','JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
  if(!nmBln)nmBln=blnInt>=1&&blnInt<=12?NM[blnInt]:'?';
  
  const rows=document.querySelectorAll('tbody tr.fi-ta-row');
  if(!rows.length){Swal.fire('Data Kosong','Tidak ada data di tabel.','warning');return;}

  // Deteksi kolom dari header text (lebih robust dari class selector)
  const hEls=document.querySelectorAll('th.fi-ta-header-cell,[role="columnheader"]');
  const hs=Array.from(hEls).map(e=>e.innerText.trim().toLowerCase());
  const fc=(kws)=>{for(const k of kws){const i=hs.findIndex(h=>h.includes(k));if(i!==-1)return i;}return -1;};
  const C={desa:fc(['nama desa','nama_desa','desa']),kec:fc(['kecamatan']),target:fc(['target'])};
  const gTxt=(r,i)=>{if(i===-1)return'-';const td=r.querySelectorAll('td')[i];if(!td)return'-';const el=td.querySelector('.fi-ta-text-item-label');const raw=el?(el.innerText||el.textContent||''):(td.innerText||td.textContent||'');return raw.trim()||'-';};

  let rekap={},dataRows=[],skippedRows=0;
  rows.forEach(r=>{
    const desa=gTxt(r,C.desa);
    const kec=gTxt(r,C.kec);
    const tStr=gTxt(r,C.target);
    if(desa==='-'&&kec==='-'){skippedRows++;return;}
    const tNum=parseFloat(tStr.replace(/,/g,''))||0;
    const desaL=desa!=='-'?desa:'(tanpa nama)';
    const kecL=kec!=='-'?kec:'(tanpa kecamatan)';
    if(!rekap[kecL])rekap[kecL]={total:0,desa:[]};
    rekap[kecL].total+=tNum;
    rekap[kecL].desa.push({nama:desaL,target:tNum});
    dataRows.push({namaDesa:desaL,namaKecamatan:kecL,targetHa:tNum});
  });

  // Debug info: sample row 0 to verify column detection
  const r0=rows[0];
  const dbg='<details style="margin-top:10px;text-align:left;font-size:11px;color:#64748b"><summary style="cursor:pointer;color:#3b82f6">🔍 Info Debug (klik untuk lihat)</summary>'
    +'<br>DOM rows: '+rows.length+' | Captured: '+dataRows.length+' | Skipped: '+skippedRows
    +'<br>Idx → Desa:'+C.desa+' Kec:'+C.kec+' Target:'+C.target
    +'<br>Headers: '+hs.slice(0,Math.min(hs.length,8)).map((h,i)=>i+':'+h).join(' | ')
    +'<br>Baris-1 → desa="'+gTxt(r0,C.desa)+'" kec="'+gTxt(r0,C.kec)+'" target="'+gTxt(r0,C.target)+'"'
    +'</details>';

  Swal.fire({
    title:'📥 Sinkronisasi Target Padi',
    html:'<b>Total Data:</b> '+dataRows.length+' desa'+(skippedRows>0?'<br><span style="color:#f59e0b">⚠️ Dilewati: '+skippedRows+' baris (kolom tidak terbaca)</span>':'')+'<br><b>Total Target:</b> '+dataRows.reduce((a,b)=>a+b.targetHa,0).toLocaleString("id-ID")+' Ha'+dbg,
    icon:'question',showCancelButton:true,confirmButtonText:'Sinkron ke Server',cancelButtonText:'Batal'
  }).then(async res=>{
    if(!res.isConfirmed)return;
    Swal.fire({title:'Mengirim ke Server...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});
    try{
        await fetch(GAS_URL,{method:'POST',mode:'no-cors',body:JSON.stringify({aksi:'import_target_epusluh',bulan:blnInt,komoditas:'Padi',pembuat:'ePusluh Import',data:dataRows})});
        
        Swal.fire({
            title:'Sinkronisasi Berhasil!',
            text:'Data telah tersimpan di server. Ingin mengunduh rekap Excel?',
            icon:'success',
            showCancelButton:true,
            confirmButtonText:'Unduh Excel',
            cancelButtonText:'Selesai'
        }).then(resExcel=>{
            if(resExcel.isConfirmed){
                Swal.fire({title:'Membuat Excel...',allowOutsideClick:false,didOpen:()=>Swal.showLoading()});
                setTimeout(()=>buatExcel(rekap,Object.keys(rekap).sort(),dataRows.reduce((a,b)=>a+b.targetHa,0),nmBln,blnInt,dataRows.length), 500);
            }
        });
    }catch(e){Swal.fire('Error','Sync gagal: '+e,'error');}
  });
}

function buatExcel(rekap,sortedKec,grandTotal,nmBln,blnInt,jumlahDesa){
  const txtBln=nmBln?' - '+nmBln:'',fBln=blnInt>=1&&blnInt<=12?'_BULAN_'+blnInt:'';
  const wb=new ExcelJS.Workbook();
  // ... (kode buatexcel sama persis dengan sebelumnya) ...
  const sh=(c)=>{c.font={bold:true,color:{argb:'FFFFFFFF'},name:'Arial',size:11};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF046A38'}};c.alignment={vertical:'middle',horizontal:'center'};c.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};};
  const st=(c)=>{c.font={bold:true,name:'Arial',size:11};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE8F5E9'}};c.alignment={vertical:'middle'};c.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};};
  const ws1=wb.addWorksheet('1. Rekap Kecamatan');
  ws1.columns=[{width:5},{width:25},{width:20}];
  ws1.addRow(['REKAPITULASI TARGET LTT PADI PER KECAMATAN'+txtBln]).font={bold:true,size:14};
  ws1.addRow([]);
  const hr1=ws1.addRow(['NO','KECAMATAN','TOTAL TARGET (HA)']);hr1.eachCell(sh);
  let n1=1;sortedKec.forEach(k=>{const t=rekap[k].total;const r=ws1.addRow([n1++,k,t]);r.getCell(1).alignment={horizontal:'center'};r.getCell(3).numFmt='#,##0.00';});
  const rt1=ws1.addRow(['JUMLAH TOTAL','',grandTotal]);ws1.mergeCells('A'+rt1.number+':B'+rt1.number);rt1.eachCell(st);rt1.getCell(3).numFmt='#,##0.00';
  wb.xlsx.writeBuffer().then(b=>{
    const bl=new Blob([b],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const u=URL.createObjectURL(bl);const a=document.createElement('a');a.href=u;a.download='TARGET_LTT_PADI_WAY_KANAN'+fBln+'.xlsx';a.click();
    Swal.close();
  });
}
})();`;
}

// ==========================================
// KODE TUYUL REALISASI ELTT (SINKRON PADI)
// ==========================================
function getKodeTuyulEltt() {
  return `(function(){
    // 1. TAMPILKAN LOADING MODAL
    if(!document.getElementById('tuyul-loading-modal')){
      const d=document.createElement('div');
      d.id='tuyul-loading-modal';
      d.style='position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:99999999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
      d.innerHTML='<div style="background:#fff;border-radius:16px;padding:32px;width:340px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);text-align:center;box-sizing:border-box;"><div style="width:50px;height:50px;border:4px solid #f3f3f3;border-top:4px solid #16a34a;border-radius:50%;animation:tuyul-spin 1s linear infinite;margin:0 auto 20px;"></div><h2 style="margin:0 0 8px;font-size:20px;color:#1e293b;font-weight:600;">Menyiapkan Sistem...</h2><p id="tuyul-status-teks" style="margin:0;font-size:14px;color:#64748b;line-height:1.5;">Mengunduh library Excel & antarmuka. Mohon tunggu...</p></div><style>@keyframes tuyul-spin { 100% { transform: rotate(360deg); } }</style>';
      document.body.appendChild(d);
    }

    // 2. MUAT LIBRARY
    let l=0;
    const init=()=>{
      l++;
      if(l===2){
        const ld=document.getElementById('tuyul-loading-modal');
        if(ld) ld.remove();
        startELTT();
      }
    };

    if(typeof ExcelJS==='undefined'){
      let s1=document.createElement('script');
      s1.src='https://unpkg.com/exceljs@4.3.0/dist/exceljs.min.js';
      s1.onload=init;document.body.appendChild(s1);
    }else{init();}

    if(typeof Swal==='undefined'){
      let s2=document.createElement('script');
      s2.src='https://unpkg.com/sweetalert2@11';
      s2.onload=init;document.body.appendChild(s2);
    }else{init();}

    // ---------------------------------------------------------
    // 3. LOGIKA UTAMA EKSEKUSI DATA
    // ---------------------------------------------------------
    function startELTT(){
      const style=document.createElement('style');
      style.innerHTML='.swal2-confirm{color:#fff !important;background-color:#16a34a !important;padding:10px 24px !important;font-weight:bold !important;margin:5px !important;} .swal2-cancel{color:#4b5563 !important;background-color:#f3f4f6 !important;border:1px solid #d1d5db !important;padding:10px 24px !important;font-weight:bold !important;margin:5px !important;display:inline-block !important;}';
      document.head.appendChild(style);
      
      const URL_GAS='https://script.google.com/macros/s/AKfycbxQZAgRQcykQ96aaB0CsvYLjXUnZ4VF6iHXd3D6MZoDaPVb0EmvJ8SuovlU6818i2M9ag/exec';
      const hEls=document.querySelectorAll('th.fi-ta-header-cell,[role="columnheader"]');
      const hs=Array.from(hEls).map(e=>e.innerText.trim().toLowerCase());
      
      const fc=(kws)=>{for(const k of kws){const i=hs.findIndex(h=>h.includes(k));if(i!==-1)return i}return -1};
      const C={wl:fc(['waktu lapor','waktu']),p:fc(['pelapor','penyuluh','ppl']),k:fc(['kecamatan']),d:fc(['desa']),j:fc(['jenis ltt','jenis']),t:fc(['tambah tanam','tanam']),pn:fc(['luas panen','panen']),b:fc(['lahan bera','bera']),o:fc(['olah lahan','olah']),kt:fc(['keterangan']),s:fc(['status'])};
      
      const rows=document.querySelectorAll('.fi-ta-row');
      if(!rows.length){Swal.fire('Data Kosong','Tidak ada data tabel!','warning');return;}
      
      const gTxt=(r,i)=>{if(i===-1)return'-';const td=r.querySelectorAll('td')[i+1];if(!td)return'-';const el=td.querySelector('.fi-ta-text-item-label');return el&&el.innerText.trim()?el.innerText.trim():'-'};
      const gNum=(r,i)=>{if(i===-1)return 0;const td=r.querySelectorAll('td')[i+1];if(!td)return 0;const el=td.querySelector('.fi-ta-text-item-label');return el?parseFloat(el.innerText.trim().replace(',','.'))||0:0};
      
      const ts=new Date();const idSync='SYNC-'+ts.getTime();
      
      // DUA KERANJANG DATA
      const allData=[]; 
      const dataVPS=[]; // Keranjang khusus VPS
      
      let skipCount=0;let totalTarik=0;let tglLapor='';
      let countTanamPanen=0;let countBeraOlahSaja=0;

      rows.forEach(r=>{
        if(!r.querySelectorAll('td').length)return;
        totalTarik++;
        
        const currentKec = gTxt(r,C.k);
        const currentDesa = gTxt(r,C.d);
        const currentJenis = gTxt(r,C.j);
        const currentTgl = gTxt(r,C.wl);
        
        // 1. MASUKKAN KE KERANJANG VPS (Sebelum kena filter nihil)
        if(currentJenis.toLowerCase() === 'ltt reguler') {
            dataVPS.push({
                kecamatan: currentKec,
                desa: currentDesa,
                jenisLTT: 'LTT Reguler'
            });
        }

        const t=gNum(r,C.t);const pn=gNum(r,C.pn);
        const b=gNum(r,C.b);const o=gNum(r,C.o);
        if(!tglLapor&&currentTgl!=='-')tglLapor=currentTgl;
        
        // 2. KODE ASLI ANDA (Filter data nihil untuk Excel/Sheet)
        if(t===0&&pn===0&&b===0&&o===0){skipCount++;return;}
        
        if(t>0||pn>0) countTanamPanen++; else countBeraOlahSaja++;
        
        // 3. MASUKKAN KE KERANJANG UTAMA (GAS/Excel)
        allData.push([idSync+'-'+Math.random().toString(36).substr(2,5),currentTgl,gTxt(r,C.p),currentKec,currentDesa,'Padi',currentJenis,0,0,b,o,t,pn,gTxt(r,C.kt),gTxt(r,C.s),ts,ts]);
      });
      
      let htmlText=\`<div style="text-align:left;font-size:14px;"><p>Sistem <b>ELTT</b> akan menjalankan 2 proses otomatis:</p><p style="color:#2563eb"><b>1️⃣ Sinkronisasi Data (Padi) ke Server & WA</b></p><p style="color:#16a34a"><b>2️⃣ Mengunduh Rekap Excel Lengkap</b></p><hr><p><b>📅 Tanggal Laporan:</b> \${tglLapor}</p><p><b>📊 Total Baris DOM:</b> \${totalTarik} baris</p><hr style="border-color:#e5e7eb"><p style="font-weight:bold;margin-bottom:4px">📦 Data yang akan dikirim (\${allData.length} baris):</p><p style="margin:2px 0;color:#16a34a">✅ Ada Tanam / Panen: <b>\${countTanamPanen} baris</b></p><p style="margin:2px 0;color:#f59e0b">🟡 Hanya Bera / Olah Lahan: <b>\${countBeraOlahSaja} baris</b></p><p style="margin:2px 0;color:#ef4444">❌ Laporan Nihil (Dilewati dari Excel): <b>\${skipCount} baris</b></p><p style="margin:2px 0;color:#8b5cf6">🤖 Terdeteksi LTT Reguler (Utk VPS): <b>\${dataVPS.length} desa</b></p></div>\`;
      
      Swal.fire({title:'Konfirmasi Eksekusi ELTT',html:htmlText,icon:'question',showCancelButton:true,confirmButtonText:'Jalankan Proses!',cancelButtonText:'Batal'}).then(async(res)=>{
        if(res.isConfirmed){
          Swal.fire({title:'Tahap 1: Sinkronisasi...',text:'Mengirim data ke server ELTT & Bot WA, mohon tunggu.',allowOutsideClick:false,didOpen:()=>{Swal.showLoading()}});
          
          if(allData.length > 0 || dataVPS.length > 0){
            try{
              // PAYLOAD GABUNGAN UNTUK GAS
              const payload = {
                  aksi: 'sinkron_padi',
                  data: allData,         // Data bersih untuk di-save ke Sheet
                  dataVPS: dataVPS,      // Data mentah "LTT Reguler" untuk diteruskan ke VPS
                  logData: {idSync:idSync, waktuSinkron:ts, totalTarik:totalTarik, dataBerisi:allData.length, dataNihil:skipCount, tanggalLaporan:tglLapor}
              };
              
              await fetch(URL_GAS,{method:'POST',mode:'no-cors',body:JSON.stringify(payload)});
              
              Swal.fire({title:'Tahap 2: Menyiapkan Excel...',text:'Sinkronisasi Sukses! Memproses file unduhan...',allowOutsideClick:false,didOpen:()=>{Swal.showLoading()}});
              // MODIFIKASI: Kirim payload.logData dan dataVPS ke fungsi Exporter
              setTimeout(() => { runExcelExporter(payload.logData, dataVPS); }, 1000);
            }catch(e){
              Swal.fire('Gagal Sinkronisasi!',e.message,'error');
            }
          }else{
            Swal.fire({title:'Tahap 2: Menyiapkan Excel...',text:'Tidak ada data sama sekali, langsung memproses Excel...',allowOutsideClick:false,didOpen:()=>{Swal.showLoading()}});
            setTimeout(() => { runExcelExporter(null, dataVPS); }, 1000);
          }
        }
      });
    }

    // ---------------------------------------------------------
    // 5. EXPORT EXCEL (DENGAN SHEET 5 KONTROL & DETEKSI MANUAL)
    // ---------------------------------------------------------
    function runExcelExporter(metaLog, vpsData){
      const t=document.querySelector('table.fi-ta-table');
      if(!t){Swal.fire('Oops!','Tabel LTT tidak ditemukan.','error');return;}
      const th=Array.from(t.querySelectorAll('thead th'));
      const g=(n)=>th.findIndex(x=>x.innerText.toLowerCase().includes(n.toLowerCase()));
      const idx={kec:g('kecamatan'),des:g('desa'),pel:g('pelapor'),jen:g('jenis ltt'),tgl:g('waktu lapor'),tmb:g('realisasi'),ber:g('bera'),olh:g('olah'),pan:g('panen'),ket:g('keterangan'),sta:g('status')};
      
      const pn=(txt)=>{let cl=txt.trim().replace(/[^\\d,.-]/g,'');if(!cl)return 0;if(cl.includes(',')&&cl.includes('.'))cl=cl.replace(/\\./g,'');cl=cl.replace(',','.');return parseFloat(cl)||0;};
      const ed=(txt)=>{const pt=txt.trim().split(' ');if(pt.length>=3)return \`\${pt[1].replace(',','')} \${pt[0]} \${pt[2]}\`;return txt;};
      
      let rk={},dm=[],rkKec={},count=0,tf="";
      
      t.querySelectorAll('tbody tr.fi-ta-row').forEach(tr=>{
        const td=tr.querySelectorAll('td');
        if(td.length>5){
          count++;
          const tglRaw=td[idx.tgl]?.innerText||"N/A";
          const tgl=ed(tglRaw);if(!tf&&tgl!=="N/A")tf=tgl;
          const kec=td[idx.kec]?.innerText.trim()||"N/A";
          const des=td[idx.des]?.innerText.trim()||"-";
          const pel=td[idx.pel]?.innerText.trim()||"-";
          const jen=td[idx.jen]?.innerText.trim()||"-";
          const ket=td[idx.ket]?.innerText.trim()||"-";
          const sta=td[idx.sta]?.innerText.trim()||"-";
          const tmb=pn(td[idx.tmb]?.innerText);
          const ber=pn(td[idx.ber]?.innerText);
          const olh=pn(td[idx.olh]?.innerText);
          const pan=pn(td[idx.pan]?.innerText);
          
          dm.push([tgl,kec,des,pel,jen,tmb,ber,olh,pan,ket,sta]);
          const k=\`\${tgl}|\${kec}|\${jen}\`;
          
          if(!rk[k])rk[k]={tgl,kec,jen,tmb:0,ber:0,olh:0,pan:0};
          rk[k].tmb+=tmb;rk[k].ber+=ber;rk[k].olh+=olh;rk[k].pan+=pan;
          
          if(!rkKec[kec])rkKec[kec]={tmb:0,ber:0,olh:0,pan:0};
          rkKec[kec].tmb+=tmb;rkKec[kec].ber+=ber;rkKec[kec].olh+=olh;rkKec[kec].pan+=pan;
        }
      });
      
      if(count===0){Swal.fire('Nihil','Tidak ada data di tabel ini.','info');return;}
      
      let ds1=[],ds2=[],ds4=[];
      Object.keys(rk).sort().forEach(k=>{const r=rk[k];const row=[r.tgl,r.kec,r.jen,r.tmb,r.ber,r.olh,r.pan];ds1.push(row);if(r.jen!=="-"&&r.jen!=="N/A"&&r.jen!==""&&(r.tmb>0||r.ber>0||r.olh>0||r.pan>0)){ds2.push(row);}});
      Object.keys(rkKec).sort().forEach(k=>{const r=rkKec[k];ds4.push([k,r.tmb,r.ber,r.olh,r.pan]);});
      
      const wb=new ExcelJS.Workbook();
      const cs=(sn,dr,ttl,hdrs)=>{
        const ws=wb.addWorksheet(sn);
        ws.columns=hdrs.map((h)=>({width:18}));
        if(hdrs.length===11){ws.columns[2].width=20;ws.columns[3].width=25;ws.columns[9].width=30;ws.columns[10].width=20;}
        if(hdrs.length>5)ws.columns[idx.tgl?1:0].width=22;
        const lCol=String.fromCharCode(64+hdrs.length);
        ws.mergeCells(\`A1:\${lCol}1\`);
        const tc=ws.getCell('A1');tc.value=ttl;tc.font={name:'Arial',size:14,bold:true,color:{argb:'FFFFFFFF'}};tc.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF059669'}};tc.alignment={vertical:'middle',horizontal:'center'};
        ws.mergeCells(\`A2:\${lCol}2\`);
        const sc=ws.getCell('A2');sc.value='Diunduh pada: '+new Date().toLocaleString('id-ID');sc.font={name:'Arial',size:10,italic:true};sc.alignment={horizontal:'center'};
        ws.addRow([]);const hr=ws.addRow(hdrs);
        hr.eachCell((c)=>{c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF10B981'}};c.alignment={vertical:'middle',horizontal:'center'};c.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};});
        dr.forEach((r,i)=>{const row=ws.addRow(r);const iz=i%2===1;row.eachCell((c)=>{c.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};c.alignment={vertical:'middle'};if(iz){c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0FDF4'}};}if(typeof c.value==='number'){c.alignment={horizontal:'right'};c.numFmt='#,##0.00';}});});
      };
      
      const h7=["Tanggal Lapor","Kecamatan","Jenis LTT","Tambah Tanam","Lahan Bera","Olah Lahan","Panen"];
      const h11=["Tanggal Lapor","Kecamatan","Desa","Pelapor","Jenis LTT","Tambah Tanam","Lahan Bera","Olah Lahan","Panen","Keterangan","Status"];
      cs("1. Rekap Semua",ds1,"REKAPITULASI SEMUA DATA LTT",h7);
      cs("2. Rekap Ada Nilai",ds2,"REKAPITULASI DATA LTT BERISI",h7);
      cs("3. Data Mentah",dm,"DATA ASLI PER BARIS (LENGKAP)",h11);
      
      const csDinas=()=>{
        const ws=wb.addWorksheet("4. Rekap Dinas");
        ws.columns=[{width:5},{width:20},{width:15},{width:15},{width:15},{width:15},{width:15},{width:15},{width:15},{width:15},{width:15},{width:15}];
        ws.mergeCells('A1:L1');const tc=ws.getCell('A1');tc.value='REKAPITULASI LUAS TAMBAH TANAM (LTT) HARIAN';tc.font={name:'Arial',size:14,bold:true};tc.alignment={horizontal:'center',vertical:'middle'};
        ws.getCell('A3').value='NO';ws.getCell('B3').value='KECAMATAN';ws.getCell('C3').value='PADI SAWAH';ws.getCell('E3').value='PADI GOGO';ws.getCell('G3').value='JAGUNG';ws.getCell('I3').value='KEDELAI';ws.getCell('K3').value='UBI KAYU';
        ws.mergeCells('A3:A4');ws.mergeCells('B3:B4');ws.mergeCells('C3:D3');ws.mergeCells('E3:F3');ws.mergeCells('G3:H3');ws.mergeCells('I3:J3');ws.mergeCells('K3:L3');
        ['C4','E4','G4','I4','K4'].forEach(c=>ws.getCell(c).value='TAMBAH TANAM (HA)');['D4','F4','H4','J4','L4'].forEach(c=>ws.getCell(c).value='PANEN (HA)');
        for(let r=3;r<=4;r++){ws.getRow(r).eachCell(c=>{c.font={bold:true};c.alignment={vertical:'middle',horizontal:'center',wrapText:true};c.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD3D3D3'}}});}
        const kecs=["Banjit","Baradatu","Gunung Labuhan","Kasui","Rebang Tangkas","Blambangan Umpu","Umpu Semenguk","Way Tuba","Bumi Agung","Buay Bahuga","Bahuga","Pakuan Ratu","Negara Batin","Negeri Agung","Negeri Besar"].sort();
        let rD={};kecs.forEach(k=>rD[k]=[0,0,0,0,0,0,0,0,0,0]);
        dm.forEach(r=>{
          const kr=(r[1]||'').toLowerCase();const jen=(r[4]||'').toLowerCase();const tmb=parseFloat(r[5])||0;const pan=parseFloat(r[8])||0;
          let mk=kecs.find(k=>kr.includes(k.toLowerCase()));
          if(mk){if(jen==='ltt reguler'){rD[mk][0]+=tmb;rD[mk][1]+=pan;}else if(jen==='ltt padi gogo'){rD[mk][2]+=tmb;rD[mk][3]+=pan;}}
        });
        let tot=[0,0,0,0,0,0,0,0,0,0];
        kecs.forEach((k,i)=>{let rv=[i+1,k,...rD[k]];for(let j=0;j<10;j++)tot[j]+=rD[k][j];let rw=ws.addRow(rv);rw.eachCell((c,ci)=>{c.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};if(ci>2){c.numFmt='#,##0.00';c.alignment={horizontal:'right'};}});});
        let rTot=ws.addRow(['JUMLAH','',...tot]);ws.mergeCells(\`A\${rTot.number}:B\${rTot.number}\`);
        rTot.eachCell((c,ci)=>{c.font={bold:true};c.border={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFFF00'}};if(ci>2){c.numFmt='#,##0.00';c.alignment={horizontal:'right'};}else{c.alignment={horizontal:'center'};}});
      };
      
      csDinas();

      // ====================================================================
      // 🔥 NEW: SHEET 5 (DASHBOARD KONTROL WILAYAH & DETEKSI MANUAL)
      // ====================================================================
      const csBuktiLog = () => {
        const ws = wb.addWorksheet("5. Kontrol & Deteksi Manual");
        ws.columns = [{ width: 6 }, { width: 36 }, { width: 22 }, { width: 5 }];
        
        // Header Utama
        ws.mergeCells('A1:D1');
        const tc = ws.getCell('A1');
        tc.value = 'DASHBOARD KONTROL WILAYAH (DETEKSI MANUAL)';
        tc.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Navy Blue
        tc.alignment = { vertical: 'middle', horizontal: 'center' };
        
        // 1. FILTER UNIK & SORTING DATA LAPORAN (Kecamatan -> Desa)
        // Pakai dm (sudah benar, baca td.innerText langsung) bukan vpsData dari startELTT
        // dm = [tgl,kec,des,pel,jen,tmb,ber,olh,pan,ket,sta] → jen[4], kec[1], des[2]
        const seen = new Set();
        const uDesa = [];
        const sourceData = dm
          .filter(r => (r[4] || '').toLowerCase().includes('reguler'))
          .map(r => ({ kecamatan: r[1], desa: r[2], jenisLTT: r[4] }));

        sourceData.forEach(item => {
            const key = \`\${item.kecamatan.toLowerCase().trim()}_\${item.desa.toLowerCase().trim()}\`;
            if(!seen.has(key)) {
                seen.add(key);
                uDesa.push(item);
            }
        });

        // Sorting Alfabetis (Kecamatan -> Desa)
        uDesa.sort((a, b) => {
            const kecComp = a.kecamatan.localeCompare(b.kecamatan);
            if(kecComp !== 0) return kecComp;
            return a.desa.localeCompare(b.desa);
        });

        const jlhSudahLapor = uDesa.length;
        const jlhBelumLapor = 227 - jlhSudahLapor; // Kalkulator Sisa Desa

        // 2. CETAK BLOK MATEMATIKA KALKULATOR DI ATAS
        ws.getCell('A3').value = '📊 STATUS REAL-TIME KABUPATEN:';
        ws.getCell('A3').font = { bold: true };

        ws.getCell('A4').value = 'TOTAL DESA MASTER';
        ws.getCell('B4').value = 227;
        ws.getCell('B4').font = { bold: true };
        ws.getCell('B4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

        ws.getCell('A5').value = 'SUDAH LAPOR (UNIK)';
        ws.getCell('B5').value = jlhSudahLapor;
        ws.getCell('B5').font = { bold: true, color: { argb: 'FF15803D' } };
        ws.getCell('B5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };

        ws.getCell('A6').value = 'BELUM LAPOR (SISA)';
        ws.getCell('B6').value = jlhBelumLapor;
        ws.getCell('B6').font = { bold: true, color: { argb: 'FFB91C1C' } };
        ws.getCell('B6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };

        ['A4','A5','A6'].forEach(cell => ws.getCell(cell).font = { bold: true });

        // Metadata Tambahan di Samping Kanan Kartu
        ws.getCell('C4').value = '⏱️ Waktu Eksekusi:';
        ws.getCell('D4').value = new Date().toLocaleString('id-ID') + ' WIB';
        ws.getCell('C5').value = '📅 Tanggal Laporan:';
        ws.getCell('D5').value = tf || 'N/A';
        ['C4','C5'].forEach(cell => ws.getCell(cell).font = { italic: true });

        // 3. CETAK TABEL RINCIAN DESA - DIKELOMPOKKAN PER KECAMATAN
        ws.addRow([]);
        ws.mergeCells('A8:D8');
        const listTitle = ws.getCell('A8');
        listTitle.value = '📍 TABEL URUT DATA YANG SUDAH MASUK (MEMPERMUDAH CEK MANUAL)';
        listTitle.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        listTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };

        const hrTable = ws.addRow(["NO", "NAMA DESA", "STATUS SINKRON", ""]);
        hrTable.eachCell(c => {
          c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
          c.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // Kelompokkan uDesa per kecamatan (sudah sorted)
        const groups = {};
        uDesa.forEach(item => {
          if (!groups[item.kecamatan]) groups[item.kecamatan] = [];
          groups[item.kecamatan].push(item.desa);
        });

        // Warna rotasi untuk tiap kecamatan
        const kecClr = ['FF1D4ED8','FF7C3AED','FF0F766E','FFB45309','FF9F1239','FF1E40AF','FF065F46','FF78350F','FF831843','FF14532D','FF92400E','FF1E3A5F','FF4D7C0F','FF6B21A8','FF0E7490'];

        Object.keys(groups).sort().forEach((kec, ki) => {
          const desaList = groups[kec];
          const clr = kecClr[ki % kecClr.length];

          // --- BARIS PEMBATAS / HEADER KECAMATAN ---
          const sepRow = ws.addRow([\`📌 \${kec.toUpperCase()}\`, '', \`\${desaList.length} desa lapor\`, '']);
          const rn = sepRow.number;
          ws.mergeCells(\`A\${rn}:B\${rn}\`);
          sepRow.height = 20;
          sepRow.eachCell(c => {
            c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: clr } };
            c.border = { top:{style:'medium'}, bottom:{style:'medium'}, left:{style:'thin'}, right:{style:'thin'} };
            c.alignment = { vertical: 'middle' };
          });
          sepRow.getCell(2).alignment = { vertical: 'middle', indent: 1 };
          sepRow.getCell(3).font = { bold: true, color: { argb: 'FFFFFFAA' }, italic: true };
          sepRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

          // --- BARIS DESA DALAM KECAMATAN INI ---
          desaList.forEach((desa, i) => {
            const row = ws.addRow([i + 1, desa, "✔️ Sudah Lapor", ""]);
            row.eachCell((c, ci) => {
              c.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
              c.alignment = { vertical: 'middle' };
              if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
              if (ci === 1) c.alignment = { horizontal: 'center', vertical: 'middle' };
              if (ci === 3) { c.font = { bold: true, color: { argb: 'FF16A34A' } }; c.alignment = { horizontal: 'center', vertical: 'middle' }; }
            });
          });
        });
      };
      
      csBuktiLog();
      // ====================================================================

      wb.xlsx.writeBuffer().then(b=>{
        const bl=new Blob([b],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
        const u=URL.createObjectURL(bl);
        const a=document.createElement('a');a.href=u;
        let sf=tf?tf.replace(/ /g,'_'):new Date().toLocaleDateString('id-ID').replace(/\\//g,'-');
        a.download=\`LAPORAN_ELTT_\${sf}_LENGKAP.xlsx\`;a.click();
        URL.revokeObjectURL(u);
        Swal.fire({title:'Proses ELTT Selesai! 🎉',html:\`<div style="text-align:left;font-size:14px;"><p style="color:#2563eb"><b>☁️ Sinkronisasi Server:</b> Sukses</p><p style="color:#16a34a"><b>📊 File Excel:</b> Berhasil Diunduh</p><hr><p><b>📑 Rekap Semua:</b> \${ds1.length} baris</p><p><b>✅ Rekap Ada Nilai:</b> \${ds2.length} baris</p><p><b>🗄️ Data Mentah:</b> \${dm.length} baris</p><p><b>📋 Sheet 5 (Kontrol):</b> Aktif Hitung Otomatis</p></div>\`,icon:'success',confirmButtonText:'Tutup'});
      }).catch(e=>Swal.fire('Error!','Gagal membuat Excel: '+e,'error'));
    }
  })();`;
}
