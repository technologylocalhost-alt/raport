import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import chromium from '@sparticuz/chromium';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL')) return user;
  return null;
}

const DETAIL_SECTIONS = [
  { title: 'Identitas Pendaftaran', fields: [
    { label: 'Nama Lengkap', key: 'name' },
    { label: 'Nama Panggilan', key: 'namaPanggilan' },
    { label: 'No Stambuk', key: 'studentNo' },
    { label: 'Jenis Kelamin', key: 'gender' },
    { label: 'Tahun Daftar', key: 'tahunDaftar' },
    { label: 'No Pendaftaran PSB', key: 'noPendaftaranPSB' },
    { label: 'Tingkat Pendidikan Sebelumnya', key: 'tingkatSebelumnya' },
    { label: 'NIK', key: 'nik' },
    { label: 'NISN', key: 'nisn' },
    { label: 'Asal Sekolah', key: 'asalSekolah' },
    { label: 'NSM/NPSN Asal Sekolah', key: 'nsmNpsn' },
  ]},
  { title: 'Data Diri', fields: [
    { label: 'Tempat Lahir', key: 'birthPlace' },
    { label: 'Tanggal Lahir', key: 'birthDate', type: 'date' },
    { label: 'Anak Ke', key: 'anakKe' },
    { label: 'Dari Anak', key: 'dariAnak' },
    { label: 'Status Domisili', key: 'statusDomisili' },
    { label: 'Telepon Santri', key: 'phone' },
    { label: 'Alamat Sesuai KK', key: 'alamatKK' },
    { label: 'Kode Pos', key: 'kodePos' },
    { label: 'Domisili di Luar KK', key: 'domisiliLuar' },
    { label: 'Penanggung Jawab (Nama)', key: 'penanggungJawab' },
    { label: 'HP Penanggung Jawab', key: 'penanggungJawabHP' },
    { label: 'Telepon Wali/Orang Tua', key: 'parentPhoneNo' },
    { label: 'Ukuran Pakaian', key: 'ukuranPakaian' },
    { label: 'Bahasa Sehari-hari', key: 'bahasaSehariHari' },
    { label: 'Golongan Darah', key: 'golonganDarah' },
    { label: 'Tinggi Badan (cm)', key: 'tinggiBadan' },
    { label: 'Berat Badan (kg)', key: 'beratBadan' },
    { label: 'No BPJS', key: 'noBPJS' },
    { label: 'Alamat Lengkap', key: 'address' },
  ]},
  { title: 'Kondisi Fisik', fields: [
    { label: 'Kondisi Gigi', key: 'kondisiGigi' },
    { label: 'Kondisi Badan/Fisik', key: 'kondisiFisik' },
  ]},
  { title: 'Instansi Kesehatan', fields: [
    { label: 'Nama RS/Dokter', key: 'instansiKesehatanNama' },
    { label: 'Alamat RS/Dokter', key: 'instansiKesehatanAlamat' },
    { label: 'No HP RS/Dokter', key: 'instansiKesehatanHP' },
  ]},
  { title: 'Riwayat Penyakit', fields: [
    { label: 'Penyakit Dalam (Pernah/Sedang)', key: 'penyakitDalam' },
    { label: 'Rawat Jalan & Kambuh', key: 'rawatJalan' },
    { label: 'Riwayat Sakit (Sudah Sembuh)', key: 'riwayatSakit' },
    { label: 'Alergi Makanan/Pantangan', key: 'alergiMakanan' },
    { label: 'Alergi Obat/Pantangan', key: 'alergiObat' },
    { label: 'Konsumsi Obat Rutin', key: 'konsumsiObatRutin' },
  ]},
  { title: 'Keterangan Tambahan Kesehatan', fields: [
    { label: 'Pernah Operasi?', key: 'pernahOperasi' },
    { label: 'Penyakit Kronis?', key: 'penyakitKronis' },
    { label: 'Alergi Zat/Makanan Tertentu?', key: 'alergiZat' },
    { label: 'Gejala/Keluhan Selama 1 Tahun?', key: 'gejalaSatuTahun' },
    { label: 'Kebutuhan Khusus Kesehatan?', key: 'kebutuhanKhusus' },
  ]},
  { title: 'Data Ayah Kandung', fields: [
    { label: 'Nama Ayah', key: 'ayahNama' },
    { label: 'Status', key: 'ayahStatus' },
    { label: 'Tempat/Tanggal Lahir', key: 'ayahTempatTglLahir' },
    { label: 'Kebangsaan', key: 'ayahKebangsaan' },
    { label: 'NIK', key: 'ayahNIK' },
    { label: 'No KK', key: 'ayahNoKK' },
    { label: 'Agama', key: 'ayahAgama' },
    { label: 'Pendidikan Terakhir', key: 'ayahPendidikan' },
    { label: 'Pekerjaan/Jabatan', key: 'ayahPekerjaan' },
    { label: 'Penghasilan Per Bulan', key: 'ayahPenghasilan' },
    { label: 'Alamat', key: 'ayahAlamat' },
    { label: 'Telepon/HP/WA', key: 'ayahTelepon' },
    { label: 'Email', key: 'ayahEmail' },
  ]},
  { title: 'Data Ibu Kandung', fields: [
    { label: 'Nama Ibu', key: 'ibuNama' },
    { label: 'Status', key: 'ibuStatus' },
    { label: 'Tempat/Tanggal Lahir', key: 'ibuTempatTglLahir' },
    { label: 'Kebangsaan', key: 'ibuKebangsaan' },
    { label: 'NIK', key: 'ibuNIK' },
    { label: 'No KK', key: 'ibuNoKK' },
    { label: 'Agama', key: 'ibuAgama' },
    { label: 'Pendidikan Terakhir', key: 'ibuPendidikan' },
    { label: 'Pekerjaan/Jabatan', key: 'ibuPekerjaan' },
    { label: 'Penghasilan Per Bulan', key: 'ibuPenghasilan' },
    { label: 'Alamat', key: 'ibuAlamat' },
    { label: 'Telepon/HP/WA', key: 'ibuTelepon' },
    { label: 'Email', key: 'ibuEmail' },
  ]},
  { title: 'Pembiayaan', fields: [
    { label: 'Sumber Pembiayaan', key: 'sumberPembiayaan' },
    { label: 'Detail Pembiayaan', key: 'detailPembiayaan' },
    { label: 'Nominal Bantuan/Beasiswa', key: 'nominalBantuan' },
    { label: 'Periode Bantuan', key: 'periodeBantuan' },
  ]},
  { title: 'Data Wali / Wakil Wali', fields: [
    { label: 'Status Hubungan', key: 'waliStatus' },
    { label: 'Nama Wali', key: 'waliNama' },
    { label: 'Tempat/Tanggal Lahir', key: 'waliTempatTglLahir' },
    { label: 'NIK', key: 'waliNIK' },
    { label: 'No KK', key: 'waliNoKK' },
    { label: 'Agama', key: 'waliAgama' },
    { label: 'Pendidikan Terakhir', key: 'waliPendidikan' },
    { label: 'Pekerjaan/Jabatan', key: 'waliPekerjaan' },
    { label: 'Penghasilan Per Bulan', key: 'waliPenghasilan' },
    { label: 'Alamat', key: 'waliAlamat' },
    { label: 'Kondisi (Pembiayaan/Pengasuhan)', key: 'waliKondisi' },
  ]},
  { title: 'Riwayat Pendidikan Sebelum PPMDL', fields: [
    { label: 'TK A/B (Tahun)', key: 'pendidikanTK' },
    { label: 'PAUD (Tahun)', key: 'pendidikanPAUD' },
    { label: 'SD/MI (Tahun)', key: 'pendidikanSD' },
    { label: 'SMP/MTS (Tahun)', key: 'pendidikanSMP' },
    { label: 'SMA/MA - Pindahan/Lanjut (Tahun)', key: 'pendidikanSMA' },
  ]},
  { title: 'Riwayat Kelas & Kamar di PPMDL', fields: [
    { label: 'Riwayat Kelas (Kelas, Wali Kelas, Tahun)', key: 'riwayatKelas' },
    { label: 'Riwayat Kamar (Kelas, Tahun, Semester 1, Semester 2)', key: 'riwayatKamar' },
    { label: 'Kamar yang Paling Berkesan', key: 'kamarBerkesan' },
  ]},
  { title: 'Alasan & Motivasi Masuk Pondok', fields: [
    { label: 'Siapa yang Memotivasi Masuk Pondok?', key: 'motivasiMasuk' },
    { label: 'Ikut Orang Tua atau Keinginan Sendiri?', key: 'ikutOrangtuaAtauSendiri' },
    { label: 'Betah di Pondok?', key: 'betahDiPondok' },
    { label: 'Apa yang Membuat Betah?', key: 'alasanBetah' },
    { label: 'Apa yang Tidak Membuat Betah?', key: 'alasanTidakBetah' },
    { label: 'Janji Orang Tua Saat Masuk/Setelah Lulus', key: 'janjiOrangtua' },
    { label: 'Inspirasi di Pondok', key: 'inspirasiDiPondok' },
    { label: 'Sosok Teladan', key: 'sosokTeladan' },
    { label: 'Kapan Sadar Harus Dewasa?', key: 'sadarDewasa' },
    { label: 'Dari Mana Tahu PPM Darussalam Lahat?', key: 'dariManaTahuPPMDL' },
  ]},
  { title: 'Profil Lingkungan Domisili Wali Santri', fields: [
    { label: 'Suku Mayoritas', key: 'lingkunganSuku' },
    { label: 'Bahasa Sehari-hari Masyarakat', key: 'lingkunganBahasa' },
    { label: 'Tingkat Interaksi Sosial', key: 'lingkunganInteraksi' },
    { label: 'Tradisi/Kegiatan Adat', key: 'lingkunganTradisi' },
    { label: 'Gotong Royong', key: 'lingkunganGotongRoyong' },
    { label: 'Pandangan Politik (Partai)', key: 'lingkunganPolitik' },
    { label: 'Organisasi Masyarakat (Umum)', key: 'lingkunganOrmasMasyarakat' },
    { label: 'Organisasi Keagamaan', key: 'lingkunganOrmasKeagamaan' },
    { label: 'Kehidupan Beragama', key: 'lingkunganBeragama' },
    { label: 'Jarak Rumah ke Masjid/Mushalla', key: 'lingkunganJarakMasjid' },
    { label: 'Kegiatan Keagamaan Rutin', key: 'lingkunganKeagamaan' },
    { label: 'Jumlah Masjid/Mushalla', key: 'lingkunganJumlahMasjid' },
    { label: 'Shalat Berjamaah', key: 'lingkunganShalatJamaah' },
    { label: 'Pendidikan Mayoritas', key: 'lingkunganPendidikanMayoritas' },
    { label: 'Lembaga Pendidikan di Sekitar', key: 'lingkunganLembagaPendidikan' },
    { label: 'Budaya Belajar Anak', key: 'lingkunganBudayaBelajar' },
    { label: 'Akses Internet', key: 'lingkunganAksesInternet' },
    { label: 'Penggunaan Gadget Remaja', key: 'lingkunganGadget' },
    { label: 'Media Sosial Dominan', key: 'lingkunganMedsos' },
    { label: 'Organisasi Aktif', key: 'lingkunganOrganisasi' },
    { label: 'Kegiatan Kepemudaan', key: 'lingkunganKepemudaan' },
    { label: 'Kondisi Keamanan', key: 'lingkunganKeamanan' },
    { label: 'Ronda/Siskamling', key: 'lingkunganRonda' },
    { label: 'Pengaruh Pergaulan Remaja', key: 'lingkunganPergaulanRemaja' },
  ]},
  { title: 'Prestasi, Kegiatan & Minat', fields: [
    { label: 'Prestasi', key: 'prestasi' },
    { label: 'Kegiatan Organisasi (Internal/Eksternal)', key: 'kegiatanOrganisasi' },
    { label: 'Kegiatan Ekstrakurikuler', key: 'kegiatanEkskul' },
    { label: 'Subjek yang Digemari', key: 'subjekDigemari' },
  ]},
  { title: 'Preferensi Pelajaran', fields: [
    { label: 'Bahasa yang Lebih Disukai', key: 'preferensiBahasa' },
    { label: 'Jenis Pelajaran yang Disukai', key: 'preferensiPelajaran' },
    { label: 'Pelajaran B. Arab Disukai', key: 'pelajaranArabDisukai' },
    { label: 'Pelajaran B. Inggris Disukai', key: 'pelajaranInggrisDisukai' },
    { label: 'Pelajaran Eksakta Disukai', key: 'pelajaranEksaktaDisukai' },
    { label: 'Pelajaran Tidak Disukai', key: 'pelajaranTidakDisukai' },
  ]},
  { title: 'Ekstrakurikuler & Kegiatan Besar', fields: [
    { label: 'Ekskul Disukai', key: 'ekskulDisukai' },
    { label: 'Ekskul Tidak Disukai', key: 'ekskulTidakDisukai' },
    { label: 'Kegiatan Besar Disukai', key: 'kegiatanBesarDisukai' },
    { label: 'Kegiatan Besar Tidak Disukai', key: 'kegiatanBesarTidakDisukai' },
  ]},
  { title: 'Rencana Masa Depan', fields: [
    { label: 'Rencana Lanjut MA/SMA', key: 'rencanaMA' },
    { label: 'Rencana Kuliah (Universitas & Jurusan)', key: 'rencanaKuliah' },
    { label: 'Rencana Karier', key: 'rencanaKarier' },
    { label: 'Tempat Kerja yang Diinginkan', key: 'tempatKerjaDiinginkan' },
    { label: 'Profesi Cita-cita', key: 'profesiCitaCita' },
    { label: 'Skill yang Ingin Dipelajari', key: 'skillDipelajari' },
    { label: 'Target 10 Tahun ke Depan', key: 'target10Tahun' },
  ]},
  { title: 'Administrasi', fields: [
    { label: 'Di-input Oleh', key: 'diInputOleh' },
    { label: 'Tanggal Input', key: 'tanggalInput', type: 'date' },
    { label: 'Catatan Sekpim', key: 'catatanSekpim' },
  ]},
];

function formatValue(key: string, val: any): string {
  if (val === null || val === undefined || val === '') return '-';
  if (key === 'gender') return val === 'MALE' ? 'Laki-laki (Putra)' : 'Perempuan (Putri)';
  return String(val);
}

function formatDate(val: string | Date | null): string {
  if (!val) return '-';
  return new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function buildHtml(santri: any): string {
  const sectionsHtml = DETAIL_SECTIONS.map(section => {
    // Determine which fields to show in 1 column vs 2 columns
    // History tables or long text fields should be 1 column
    const isHistorySection = section.title.includes('Riwayat');
    
    let fieldsContent = '';
    
    if (isHistorySection) {
      fieldsContent = section.fields.map(f => {
        // Special rendering for Riwayat Kelas (from database)
        if (f.key === 'riwayatKelas') {
          const classHistory = santri.classHistory || [];
          let tableHtml = '<div class="no-data">- Belum ada data -</div>';
          if (classHistory.length > 0) {
            tableHtml = `
              <table class="inner-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Tahun Ajaran</th>
                    <th>Smt</th>
                    <th>Tingkat</th>
                    <th>Kelas</th>
                    <th>Wali Kelas</th>
                  </tr>
                </thead>
                <tbody>
                  ${classHistory.map((ch: any, i: number) => `
                    <tr>
                      <td style="text-align:center;">${i + 1}</td>
                      <td>${ch.schoolYear}</td>
                      <td style="text-align:center;">${ch.semester}</td>
                      <td>${ch.levelName || '-'}</td>
                      <td><strong>${ch.className}</strong></td>
                      <td>${ch.waliKelasName || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `;
          }
          return `<div class="full-field"><div class="field-label">${f.label}</div>${tableHtml}</div>`;
        }

        // Special rendering for Riwayat Kamar (from JSON string)
        if (f.key === 'riwayatKamar') {
          const rawKamar = santri[f.key];
          let tableHtml = '<div class="no-data">- Belum ada data -</div>';
          if (rawKamar) {
            try {
              const items = JSON.parse(rawKamar);
              if (Array.isArray(items) && items.length > 0) {
                tableHtml = `
                  <table class="inner-table">
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Kelas</th>
                        <th>Tahun</th>
                        <th>Semester 1</th>
                        <th>Semester 2</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${items.map((it: any, i: number) => `
                        <tr>
                          <td style="text-align:center;">${i + 1}</td>
                          <td>${it.kelas || '-'}</td>
                          <td>${it.tahun || '-'}</td>
                          <td>${it.smt1 || '-'}</td>
                          <td>${it.smt2 || '-'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                `;
              }
            } catch (e) {}
          }
          return `<div class="full-field" style="margin-top:4mm;"><div class="field-label">${f.label}</div>${tableHtml}</div>`;
        }

        const raw = santri[f.key];
        const display = (f as any).type === 'date' ? formatDate(raw) : formatValue(f.key, raw);
        return `<div class="full-field mt-2"><div class="field-label">${f.label}</div><div class="field-value">${display}</div></div>`;
      }).join('');
    } else {
      // Standard sections: Use 2-column layout
      fieldsContent = `
        <div class="grid-container">
          ${section.fields.map(f => {
            const raw = santri[f.key];
            const display = (f as any).type === 'date' ? formatDate(raw) : formatValue(f.key, raw);
            const isLong = display.length > 50 || f.key.includes('Alamat') || f.key.includes('Catatan');
            
            return `
              <div class="grid-item ${isLong ? 'col-span-2' : ''}">
                <div class="field-label">${f.label}</div>
                <div class="field-value">${display}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    return `
      <div class="section">
        <div class="section-title">${section.title}</div>
        <div class="section-body">
          ${fieldsContent}
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica', 'Arial', sans-serif;
      font-size: 9px;
      color: #1f2937;
      line-height: 1.5;
      background: white;
    }
    .header-container {
      display: flex;
      align-items: center;
      justify-content: center;
      padding-bottom: 5mm;
      border-bottom: 3px double #059669;
      margin-bottom: 6mm;
      position: relative;
    }
    .header-text {
      text-align: center;
    }
    .header-text h1 {
      font-size: 16px;
      color: #065f46;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 1mm;
    }
    .header-text p {
      font-size: 10px;
      color: #4b5563;
      font-weight: 500;
    }
    .section {
      margin-bottom: 5mm;
      break-inside: avoid;
    }
    .section-title {
      background: #f0fdf4;
      color: #065f46;
      font-size: 9px;
      font-weight: 800;
      padding: 1.5mm 3mm;
      border-left: 4px solid #059669;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2mm;
    }
    .section-body {
      padding: 0 2mm;
    }
    .grid-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 8mm;
      row-gap: 2.5mm;
    }
    .grid-item {
      display: flex;
      flex-direction: column;
      border-bottom: 0.1px solid #f3f4f6;
      padding-bottom: 0.5mm;
    }
    .col-span-2 { grid-column: span 2; }
    
    .field-label {
      font-size: 8px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      margin-bottom: 0.5mm;
    }
    .field-value {
      font-size: 9.5px;
      font-weight: 500;
      color: #111827;
      white-space: pre-wrap;
    }
    .full-field {
      width: 100%;
      margin-bottom: 3mm;
    }
    
    .inner-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1.5mm;
      border: 1px solid #e5e7eb;
    }
    .inner-table th {
      background: #f9fafb;
      color: #374151;
      font-weight: 700;
      font-size: 8px;
      padding: 1.5mm 2mm;
      text-align: left;
      border: 1px solid #e5e7eb;
      text-transform: uppercase;
    }
    .inner-table td {
      padding: 1.5mm 2mm;
      font-size: 9px;
      border: 1px solid #e5e7eb;
      color: #1f2937;
    }
    .no-data {
      padding: 4mm;
      text-align: center;
      color: #9ca3af;
      font-style: italic;
      background: #f9fafb;
      border-radius: 4px;
      border: 1px dashed #e5e7eb;
    }
    .footer {
      position: fixed;
      bottom: 10mm;
      left: 15mm;
      right: 15mm;
      text-align: center;
      font-size: 7.5px;
      color: #9ca3af;
      border-top: 0.5px solid #e5e7eb;
      padding-top: 2mm;
    }
    .mt-2 { margin-top: 2mm; }
  </style>
</head>
<body>
  <div class="header-container">
    <div class="header-text">
      <h1>Data Master Santri &amp; Santriwati</h1>
      <p>Pondok Pesantren Modern Darussalam Lahat (PPMDL)</p>
    </div>
  </div>
  ${sectionsHtml}
  <div class="footer">
    Dicetak pada ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} • PPM Darussalam Lahat
  </div>
</body>
</html>`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let browser = null;
  try {
    const { id } = await params;
    const user = await verifyAdmin(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const santri = await prisma.santri.findUnique({
      where: { id }
    });
    if (!santri) {
      return NextResponse.json({ success: false, error: 'Data santri tidak ditemukan' }, { status: 404 });
    }

    // Fetch riwayat kelas manual (karena bukan relasi langsung di model Santri)
    let classHistory: any[] = [];
    if (santri.studentNo) {
      const students = await prisma.student.findMany({
        where: { studentNo: santri.studentNo },
        include: {
          class: {
            include: {
              waliKelas: { select: { name: true } },
              schoolYear: { select: { year: true } },
              semester: { select: { number: true, semesterLabel: true } },
              level: { select: { name: true } },
            },
          },
        },
        orderBy: { class: { schoolYear: { year: 'asc' } } },
      });

      classHistory = students.map(s => ({
        className: s.class.name,
        levelName: s.class.level.name,
        waliKelasName: s.class.waliKelas?.name || '-',
        schoolYear: s.class.schoolYear.year,
        semester: s.class.semester.semesterLabel || `Semester ${s.class.semester.number}`,
      }));
    }

    const htmlContent = buildHtml({ ...santri, classHistory });

    let executablePath = '';
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      executablePath = await chromium.executablePath();
    }

    const launchArgs = [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
    ];

    browser = await puppeteer.launch({
      args: launchArgs,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
      timeout: 60000,
      protocolTimeout: 60000,
    });

    const page = await browser.newPage();

    await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 60000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      printBackground: true,
    });

    await browser.close();
    browser = null;

    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
    const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;
    const safeName = santri.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '');

    return NextResponse.json({
      success: true,
      pdf: pdfDataUrl,
      fileName: `data-santri-${safeName}.pdf`,
    });
  } catch (error) {
    console.error('[GenerateSantriPDF] Error:', error);
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
    const errorMessage = error instanceof Error ? error.message : 'Gagal membuat PDF';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
