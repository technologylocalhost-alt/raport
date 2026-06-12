import type { Browser } from 'puppeteer';
import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import chromium from '@sparticuz/chromium';
import { prisma } from '@/lib/db';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import { serverError } from '@/lib/server-log';

async function requireSantriPdfAccess(req: NextRequest) {
  return requireMenuAccess(req, '/admin/santri', ['ADMIN', 'PRINCIPAL']);
}

type PdfField = { label: string; key: string; type?: 'date' };
type DetailSection = { title: string; fields: PdfField[] };
type ClassHistoryItem = {
  className: string;
  levelName: string;
  waliKelasName: string;
  schoolYear: string;
  semester: string;
};
type KamarHistoryItem = {
  kelas?: string;
  tahun?: string;
  smt1?: string;
  smt2?: string;
};
type SantriPdfData = Record<string, unknown> & {
  classHistory?: ClassHistoryItem[];
};

const DETAIL_SECTIONS: DetailSection[] = [
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

function formatValue(key: string, val: unknown): string {
  if (val === null || val === undefined || val === '') return '-';
  if (key === 'gender') return val === 'MALE' ? 'Laki-laki (Putra)' : 'Perempuan (Putri)';
  return String(val);
}

function formatDate(val: string | Date | null): string {
  if (!val) return '-';
  return new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(santri: SantriPdfData): string {
  const latestClass = santri.classHistory && santri.classHistory.length > 0
    ? santri.classHistory[santri.classHistory.length - 1]
    : null;

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
                  ${classHistory.map((ch: ClassHistoryItem, i: number) => `
                    <tr>
                      <td style="text-align:center;">${i + 1}</td>
                      <td>${escapeHtml(ch.schoolYear)}</td>
                      <td style="text-align:center;">${escapeHtml(ch.semester)}</td>
                      <td>${escapeHtml(ch.levelName || '-')}</td>
                      <td><strong>${escapeHtml(ch.className)}</strong></td>
                      <td>${escapeHtml(ch.waliKelasName || '-')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `;
          }
          return `<div class="full-field"><div class="field-label">${escapeHtml(f.label)}</div>${tableHtml}</div>`;
        }

        // Special rendering for Riwayat Kamar (from JSON string)
        if (f.key === 'riwayatKamar') {
          const rawKamar = santri[f.key];
          let tableHtml = '<div class="no-data">- Belum ada data -</div>';
          if (rawKamar) {
            try {
              const items = JSON.parse(String(rawKamar));
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
                      ${(items as KamarHistoryItem[]).map((it, i: number) => `
                        <tr>
                          <td style="text-align:center;">${i + 1}</td>
                          <td>${escapeHtml(it.kelas || '-')}</td>
                          <td>${escapeHtml(it.tahun || '-')}</td>
                          <td>${escapeHtml(it.smt1 || '-')}</td>
                          <td>${escapeHtml(it.smt2 || '-')}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                `;
              }
            } catch {}
          }
          return `<div class="full-field" style="margin-top:4mm;"><div class="field-label">${escapeHtml(f.label)}</div>${tableHtml}</div>`;
        }

        const raw = santri[f.key];
        const display = f.type === 'date' ? formatDate(raw as string | Date | null) : formatValue(f.key, raw);
        return `<div class="full-field mt-2"><div class="field-label">${escapeHtml(f.label)}</div><div class="field-value">${escapeHtml(display)}</div></div>`;
      }).join('');
    } else {
      // Standard sections: Use 2-column layout
      fieldsContent = `
        <div class="grid-container">
          ${section.fields.map(f => {
            const raw = santri[f.key];
            const display = f.type === 'date' ? formatDate(raw as string | Date | null) : formatValue(f.key, raw);
            const isLong = display.length > 50 || f.key.includes('Alamat') || f.key.includes('Catatan');
            
            return `
              <div class="grid-item ${isLong ? 'col-span-2' : ''}">
                <div class="field-label">${escapeHtml(f.label)}</div>
                <div class="field-value">${escapeHtml(display)}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    return `
      <div class="section">
        <div class="section-title">${escapeHtml(section.title)}</div>
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
    @page { margin: 14mm 14mm 16mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', 'Georgia', serif;
      font-size: 9.2px;
      color: #1f2937;
      line-height: 1.45;
      background: white;
    }
    .header-container {
      padding: 5mm 6mm 4mm;
      border: 1px solid #d1d5db;
      border-top: 4px solid #111827;
      border-radius: 4px;
      background: #ffffff;
      margin-bottom: 5mm;
      page-break-inside: avoid;
    }
    .header-top {
      text-align: center;
      margin-bottom: 4mm;
    }
    .header-top .institution {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #111827;
      margin-bottom: 0.8mm;
    }
    .header-top .subinstitution {
      font-size: 9px;
      color: #4b5563;
    }
    .header-top .document-title {
      margin-top: 2mm;
      font-size: 13.5px;
      font-weight: 700;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: #111827;
    }
    .header-top .document-subtitle {
      margin-top: 1mm;
      font-size: 8.5px;
      color: #6b7280;
      font-style: italic;
    }
    .header-divider {
      border-top: 1px solid #d1d5db;
      margin: 3.5mm 0;
    }
    .header-text h1 {
      font-family: 'Times New Roman', 'Georgia', serif;
      font-size: 12.4px;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      margin-bottom: 1mm;
      line-height: 1.15;
      font-weight: 700;
    }
    .header-text p {
      font-size: 8.7px;
      color: #4b5563;
      font-weight: 400;
    }
    .document-meta {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1mm;
      border: 1px solid #d1d5db;
    }
    .document-meta td {
      border: 1px solid #d1d5db;
      padding: 1.8mm 2.3mm;
      vertical-align: top;
      font-size: 8.6px;
    }
    .document-meta .label {
      width: 28%;
      color: #6b7280;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .document-meta .value {
      color: #111827;
      font-weight: 600;
    }
    .section {
      margin-bottom: 4mm;
      break-inside: avoid;
      page-break-inside: avoid;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      overflow: hidden;
      background: #fff;
    }
    .section-title {
      background: #f3f4f6;
      color: #111827;
      font-size: 8.6px;
      font-weight: 800;
      padding: 2.2mm 3.2mm;
      border-left: 4px solid #111827;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      border-bottom: 1px solid #d1d5db;
    }
    .section-body {
      padding: 3mm;
    }
    .grid-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 7mm;
      row-gap: 2.6mm;
    }
    .grid-item {
      display: flex;
      flex-direction: column;
      border-bottom: 0.2px solid #e5e7eb;
      padding-bottom: 1mm;
      min-width: 0;
    }
    .col-span-2 { grid-column: span 2; }
    
    .field-label {
      font-size: 7px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 0.8mm;
    }
    .field-value {
      font-size: 9px;
      font-weight: 500;
      color: #111827;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.45;
    }
    .full-field {
      width: 100%;
      margin-bottom: 3.2mm;
    }
    
    .inner-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1.8mm;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      overflow: hidden;
    }
    .inner-table th {
      background: #e5e7eb;
      color: #111827;
      font-weight: 700;
      font-size: 7.4px;
      padding: 1.4mm 1.8mm;
      text-align: left;
      border: 1px solid #d1d5db;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .inner-table td {
      padding: 1.5mm 1.8mm;
      font-size: 9px;
      border: 1px solid #e5e7eb;
      color: #1f2937;
      vertical-align: top;
    }
    .no-data {
      padding: 3.5mm;
      text-align: center;
      color: #9ca3af;
      font-style: italic;
      background: #f9fafb;
      border-radius: 5px;
      border: 1px dashed #e5e7eb;
    }
    .footer {
      position: fixed;
      bottom: 8mm;
      left: 14mm;
      right: 14mm;
      text-align: center;
      font-size: 7.2px;
      color: #9ca3af;
      border-top: 0.5px solid #e5e7eb;
      padding-top: 1.8mm;
    }
    .mt-2 { margin-top: 2mm; }
  </style>
</head>
<body>
  <div class="header-container">
    <div class="header-top">
      <div class="institution">Pondok Pesantren Modern Darussalam Lahat</div>
      <div class="subinstitution">Dokumen Administrasi Santri</div>
      <div class="document-title">Data Master Santri &amp; Santriwati</div>
      <div class="document-subtitle">Lembar arsip resmi untuk keperluan administrasi internal</div>
    </div>
    <div class="header-divider"></div>
    <table class="document-meta">
      <tr>
        <td class="label">Nama Santri</td>
        <td class="value">${escapeHtml(santri.name || '-')}</td>
        <td class="label">No. Stambuk</td>
        <td class="value">${escapeHtml(santri.studentNo || '-')}</td>
      </tr>
      <tr>
        <td class="label">Jenis Kelamin</td>
        <td class="value">${escapeHtml(formatValue('gender', santri.gender))}</td>
        <td class="label">Riwayat Kelas Terakhir</td>
        <td class="value">${escapeHtml(latestClass ? `${latestClass.className} · ${latestClass.schoolYear}` : '-')}</td>
      </tr>
      <tr>
        <td class="label">Jumlah Riwayat Kelas</td>
        <td class="value">${escapeHtml(String(santri.classHistory?.length || 0))} data</td>
        <td class="label">Tanggal Cetak</td>
        <td class="value">${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
      </tr>
    </table>
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
  let browser: Browser | null = null;
  try {
    const { id } = await params;
    const user = await requireSantriPdfAccess(request);
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
    let classHistory: ClassHistoryItem[] = [];
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
    serverError('[GenerateSantriPDF] Error:', error);
    if (browser) {
      try { await browser.close(); } catch {}
    }
    const errorMessage = error instanceof Error ? error.message : 'Gagal membuat PDF';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
