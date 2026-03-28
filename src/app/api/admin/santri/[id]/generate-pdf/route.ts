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
    const rowsHtml = section.fields.map(f => {
      const raw = santri[f.key];
      const display = (f as any).type === 'date' ? formatDate(raw) : formatValue(f.key, raw);
      return `<tr><td class="label">${f.label}</td><td class="sep">:</td><td class="value">${display}</td></tr>`;
    }).join('');

    return `
      <div class="section">
        <div class="section-header">${section.title}</div>
        <table class="section-table">
          ${rowsHtml}
        </table>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 10px;
      color: #1a1a1a;
      line-height: 1.4;
    }
    .header {
      text-align: center;
      padding: 8mm 0 5mm 0;
      border-bottom: 2px solid #047857;
      margin-bottom: 4mm;
    }
    .header h1 {
      font-size: 14px;
      font-weight: 700;
      color: #047857;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header .sub {
      font-size: 10px;
      color: #666;
      margin-top: 2px;
    }
    .section {
      margin-bottom: 3mm;
      break-inside: avoid;
    }
    .section-header {
      background: #ecfdf5;
      border-left: 3px solid #047857;
      padding: 2mm 3mm;
      font-size: 10px;
      font-weight: 700;
      color: #065f46;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 1mm;
    }
    .section-table {
      width: 100%;
      border-collapse: collapse;
    }
    .section-table tr {
      border-bottom: 0.5px solid #e5e7eb;
    }
    .section-table td {
      padding: 1.2mm 2mm;
      vertical-align: top;
    }
    .section-table .label {
      width: 35%;
      font-weight: 600;
      color: #374151;
      font-size: 9px;
    }
    .section-table .sep {
      width: 3%;
      text-align: center;
      color: #9ca3af;
    }
    .section-table .value {
      width: 62%;
      color: #1f2937;
      font-size: 9.5px;
      white-space: pre-wrap;
    }
    .footer {
      text-align: center;
      font-size: 8px;
      color: #9ca3af;
      margin-top: 5mm;
      padding-top: 2mm;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Form Data Diri Santri &amp; Santriwati</h1>
    <div class="sub">PPM Darussalam Lahat</div>
  </div>
  ${sectionsHtml}
  <div class="footer">
    Dicetak pada ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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

    const santri = await prisma.santri.findUnique({ where: { id } });
    if (!santri) {
      return NextResponse.json({ success: false, error: 'Data santri tidak ditemukan' }, { status: 404 });
    }

    const htmlContent = buildHtml(santri);

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
