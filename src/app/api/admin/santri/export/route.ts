import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminOrPrincipal } from '@/lib/auth/admin-access';
import * as XLSX from 'xlsx';
import { serverError } from '@/lib/server-log';

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
    { label: 'Status Ayah', key: 'ayahStatus' },
    { label: 'Tempat/Tgl Lahir Ayah', key: 'ayahTempatTglLahir' },
    { label: 'Kebangsaan Ayah', key: 'ayahKebangsaan' },
    { label: 'NIK Ayah', key: 'ayahNIK' },
    { label: 'No KK Ayah', key: 'ayahNoKK' },
    { label: 'Agama Ayah', key: 'ayahAgama' },
    { label: 'Pendidikan Ayah', key: 'ayahPendidikan' },
    { label: 'Pekerjaan Ayah', key: 'ayahPekerjaan' },
    { label: 'Penghasilan Ayah', key: 'ayahPenghasilan' },
    { label: 'Alamat Ayah', key: 'ayahAlamat' },
    { label: 'Telepon Ayah', key: 'ayahTelepon' },
    { label: 'Email Ayah', key: 'ayahEmail' },
  ]},
  { title: 'Data Ibu Kandung', fields: [
    { label: 'Nama Ibu', key: 'ibuNama' },
    { label: 'Status Ibu', key: 'ibuStatus' },
    { label: 'Tempat/Tgl Lahir Ibu', key: 'ibuTempatTglLahir' },
    { label: 'Kebangsaan Ibu', key: 'ibuKebangsaan' },
    { label: 'NIK Ibu', key: 'ibuNIK' },
    { label: 'No KK Ibu', key: 'ibuNoKK' },
    { label: 'Agama Ibu', key: 'ibuAgama' },
    { label: 'Pendidikan Ibu', key: 'ibuPendidikan' },
    { label: 'Pekerjaan Ibu', key: 'ibuPekerjaan' },
    { label: 'Penghasilan Ibu', key: 'ibuPenghasilan' },
    { label: 'Alamat Ibu', key: 'ibuAlamat' },
    { label: 'Telepon Ibu', key: 'ibuTelepon' },
    { label: 'Email Ibu', key: 'ibuEmail' },
  ]},
  { title: 'Pembiayaan', fields: [
    { label: 'Sumber Pembiayaan', key: 'sumberPembiayaan' },
    { label: 'Detail Pembiayaan', key: 'detailPembiayaan' },
    { label: 'Nominal Bantuan/Beasiswa', key: 'nominalBantuan' },
    { label: 'Periode Bantuan', key: 'periodeBantuan' },
  ]},
  { title: 'Data Wali / Wakil Wali', fields: [
    { label: 'Status Hubungan Wali', key: 'waliStatus' },
    { label: 'Nama Wali', key: 'waliNama' },
    { label: 'Tempat/Tgl Lahir Wali', key: 'waliTempatTglLahir' },
    { label: 'NIK Wali', key: 'waliNIK' },
    { label: 'No KK Wali', key: 'waliNoKK' },
    { label: 'Agama Wali', key: 'waliAgama' },
    { label: 'Pendidikan Wali', key: 'waliPendidikan' },
    { label: 'Pekerjaan Wali', key: 'waliPekerjaan' },
    { label: 'Penghasilan Wali', key: 'waliPenghasilan' },
    { label: 'Alamat Wali', key: 'waliAlamat' },
    { label: 'Kondisi Wali', key: 'waliKondisi' },
  ]},
  { title: 'Riwayat Pendidikan', fields: [
    { label: 'TK A/B (Tahun)', key: 'pendidikanTK' },
    { label: 'PAUD (Tahun)', key: 'pendidikanPAUD' },
    { label: 'SD/MI (Tahun)', key: 'pendidikanSD' },
    { label: 'SMP/MTS (Tahun)', key: 'pendidikanSMP' },
    { label: 'SMA/MA (Tahun)', key: 'pendidikanSMA' },
  ]},
  { title: 'Riwayat Kelas & Kamar', fields: [
    { label: 'Riwayat Kelas', key: 'riwayatKelas' },
    { label: 'Riwayat Kamar', key: 'riwayatKamar' },
    { label: 'Kamar Paling Berkesan', key: 'kamarBerkesan' },
  ]},
  { title: 'Motivasi', fields: [
    { label: 'Motivasi Masuk Pondok', key: 'motivasiMasuk' },
    { label: 'Ikut Orangtua/Sendiri', key: 'ikutOrangtuaAtauSendiri' },
    { label: 'Betah di Pondok?', key: 'betahDiPondok' },
    { label: 'Alasan Betah', key: 'alasanBetah' },
    { label: 'Alasan Tidak Betah', key: 'alasanTidakBetah' },
    { label: 'Janji Orangtua', key: 'janjiOrangtua' },
    { label: 'Inspirasi di Pondok', key: 'inspirasiDiPondok' },
    { label: 'Sosok Teladan', key: 'sosokTeladan' },
    { label: 'Kapan Sadar Dewasa', key: 'sadarDewasa' },
    { label: 'Dari Mana Tahu PPMDL', key: 'dariManaTahuPPMDL' },
  ]},
  { title: 'Lingkungan', fields: [
    { label: 'Suku Mayoritas', key: 'lingkunganSuku' },
    { label: 'Bahasa Masyarakat', key: 'lingkunganBahasa' },
    { label: 'Interaksi Sosial', key: 'lingkunganInteraksi' },
    { label: 'Tradisi/Adat', key: 'lingkunganTradisi' },
    { label: 'Gotong Royong', key: 'lingkunganGotongRoyong' },
    { label: 'Politik', key: 'lingkunganPolitik' },
    { label: 'Ormas Masyarakat', key: 'lingkunganOrmasMasyarakat' },
    { label: 'Ormas Keagamaan', key: 'lingkunganOrmasKeagamaan' },
    { label: 'Kehidupan Beragama', key: 'lingkunganBeragama' },
    { label: 'Jarak ke Masjid', key: 'lingkunganJarakMasjid' },
    { label: 'Kegiatan Keagamaan', key: 'lingkunganKeagamaan' },
    { label: 'Jumlah Masjid', key: 'lingkunganJumlahMasjid' },
    { label: 'Shalat Berjamaah', key: 'lingkunganShalatJamaah' },
    { label: 'Pendidikan Mayoritas', key: 'lingkunganPendidikanMayoritas' },
    { label: 'Lembaga Pendidikan', key: 'lingkunganLembagaPendidikan' },
    { label: 'Budaya Belajar', key: 'lingkunganBudayaBelajar' },
    { label: 'Akses Internet', key: 'lingkunganAksesInternet' },
    { label: 'Penggunaan Gadget', key: 'lingkunganGadget' },
    { label: 'Media Sosial', key: 'lingkunganMedsos' },
    { label: 'Organisasi Aktif', key: 'lingkunganOrganisasi' },
    { label: 'Kegiatan Kepemudaan', key: 'lingkunganKepemudaan' },
    { label: 'Keamanan', key: 'lingkunganKeamanan' },
    { label: 'Ronda/Siskamling', key: 'lingkunganRonda' },
    { label: 'Pergaulan Remaja', key: 'lingkunganPergaulanRemaja' },
  ]},
  { title: 'Prestasi & Minat', fields: [
    { label: 'Prestasi', key: 'prestasi' },
    { label: 'Kegiatan Organisasi', key: 'kegiatanOrganisasi' },
    { label: 'Kegiatan Ekskul', key: 'kegiatanEkskul' },
    { label: 'Subjek Digemari', key: 'subjekDigemari' },
  ]},
  { title: 'Preferensi Pelajaran', fields: [
    { label: 'Bahasa Disukai', key: 'preferensiBahasa' },
    { label: 'Jenis Pelajaran Disukai', key: 'preferensiPelajaran' },
    { label: 'Pelajaran B. Arab Disukai', key: 'pelajaranArabDisukai' },
    { label: 'Pelajaran B. Inggris Disukai', key: 'pelajaranInggrisDisukai' },
    { label: 'Pelajaran Eksakta Disukai', key: 'pelajaranEksaktaDisukai' },
    { label: 'Pelajaran Tidak Disukai', key: 'pelajaranTidakDisukai' },
  ]},
  { title: 'Ekskul & Kegiatan Besar', fields: [
    { label: 'Ekskul Disukai', key: 'ekskulDisukai' },
    { label: 'Ekskul Tidak Disukai', key: 'ekskulTidakDisukai' },
    { label: 'Kegiatan Besar Disukai', key: 'kegiatanBesarDisukai' },
    { label: 'Kegiatan Besar Tidak Disukai', key: 'kegiatanBesarTidakDisukai' },
  ]},
  { title: 'Rencana Masa Depan', fields: [
    { label: 'Rencana MA/SMA', key: 'rencanaMA' },
    { label: 'Rencana Kuliah', key: 'rencanaKuliah' },
    { label: 'Rencana Karier', key: 'rencanaKarier' },
    { label: 'Tempat Kerja Diinginkan', key: 'tempatKerjaDiinginkan' },
    { label: 'Profesi Cita-cita', key: 'profesiCitaCita' },
    { label: 'Skill Ingin Dipelajari', key: 'skillDipelajari' },
    { label: 'Target 10 Tahun', key: 'target10Tahun' },
  ]},
  { title: 'Administrasi', fields: [
    { label: 'Di-input Oleh', key: 'diInputOleh' },
    { label: 'Tanggal Input', key: 'tanggalInput', type: 'date' },
    { label: 'Catatan Sekpim', key: 'catatanSekpim' },
  ]},
];

// Flatten all fields for column mapping
const ALL_FIELDS = DETAIL_SECTIONS.flatMap(s => s.fields);

async function requireSantriExportAccess(req: NextRequest) {
  return requireAdminOrPrincipal(req);
}

function formatValue(value: unknown, field: { key: string; type?: string }): string {
  if (value === null || value === undefined) return '';
  if (field.key === 'gender') {
    return value === 'MALE' ? 'Laki-laki' : value === 'FEMALE' ? 'Perempuan' : String(value);
  }
  if (field.type === 'date' && value) {
    try {
      return new Date(String(value)).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch { return String(value); }
  }
  return String(value);
}

/**
 * GET /api/admin/santri/export
 * Export all santri data as Excel
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireSantriExportAccess(request);
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const santriList = await prisma.santri.findMany({
      orderBy: { studentNo: 'asc' },
    });

    // Map data to Excel rows using DETAIL_SECTIONS headers
    const exportData = santriList.map((santri) => {
      const row: Record<string, string> = {};
      const santriRecord = santri as unknown as Record<string, unknown>;
      for (const field of ALL_FIELDS) {
        row[field.label] = formatValue(santriRecord[field.key], field);
      }
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Santri');

    // Set column widths
    ws['!cols'] = ALL_FIELDS.map(f => ({
      wch: Math.max(f.label.length + 2, 18),
    }));

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    const fileName = `data-santri-${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: unknown) {
    serverError('Export santri error:', error);
    return new NextResponse('Failed to export santri', { status: 500 });
  }
}
