import { NextRequest, NextResponse } from 'next/server';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import * as XLSX from 'xlsx';
import { serverError } from '@/lib/server-log';

// Flatten DETAIL_SECTIONS for header mapping (same as export)
const ALL_FIELDS = [
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
  { label: 'Kondisi Gigi', key: 'kondisiGigi' },
  { label: 'Kondisi Badan/Fisik', key: 'kondisiFisik' },
  { label: 'Nama RS/Dokter', key: 'instansiKesehatanNama' },
  { label: 'Alamat RS/Dokter', key: 'instansiKesehatanAlamat' },
  { label: 'No HP RS/Dokter', key: 'instansiKesehatanHP' },
  { label: 'Penyakit Dalam (Pernah/Sedang)', key: 'penyakitDalam' },
  { label: 'Rawat Jalan & Kambuh', key: 'rawatJalan' },
  { label: 'Riwayat Sakit (Sudah Sembuh)', key: 'riwayatSakit' },
  { label: 'Alergi Makanan/Pantangan', key: 'alergiMakanan' },
  { label: 'Alergi Obat/Pantangan', key: 'alergiObat' },
  { label: 'Konsumsi Obat Rutin', key: 'konsumsiObatRutin' },
  { label: 'Pernah Operasi?', key: 'pernahOperasi' },
  { label: 'Penyakit Kronis?', key: 'penyakitKronis' },
  { label: 'Alergi Zat/Makanan Tertentu?', key: 'alergiZat' },
  { label: 'Gejala/Keluhan Selama 1 Tahun?', key: 'gejalaSatuTahun' },
  { label: 'Kebutuhan Khusus Kesehatan?', key: 'kebutuhanKhusus' },
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
  { label: 'Sumber Pembiayaan', key: 'sumberPembiayaan' },
  { label: 'Detail Pembiayaan', key: 'detailPembiayaan' },
  { label: 'Nominal Bantuan/Beasiswa', key: 'nominalBantuan' },
  { label: 'Periode Bantuan', key: 'periodeBantuan' },
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
  { label: 'TK A/B (Tahun)', key: 'pendidikanTK' },
  { label: 'PAUD (Tahun)', key: 'pendidikanPAUD' },
  { label: 'SD/MI (Tahun)', key: 'pendidikanSD' },
  { label: 'SMP/MTS (Tahun)', key: 'pendidikanSMP' },
  { label: 'SMA/MA (Tahun)', key: 'pendidikanSMA' },
  { label: 'Riwayat Kelas', key: 'riwayatKelas' },
  { label: 'Riwayat Kamar', key: 'riwayatKamar' },
  { label: 'Kamar Paling Berkesan', key: 'kamarBerkesan' },
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
  { label: 'Prestasi', key: 'prestasi' },
  { label: 'Kegiatan Organisasi', key: 'kegiatanOrganisasi' },
  { label: 'Kegiatan Ekskul', key: 'kegiatanEkskul' },
  { label: 'Subjek Digemari', key: 'subjekDigemari' },
  { label: 'Bahasa Disukai', key: 'preferensiBahasa' },
  { label: 'Jenis Pelajaran Disukai', key: 'preferensiPelajaran' },
  { label: 'Pelajaran B. Arab Disukai', key: 'pelajaranArabDisukai' },
  { label: 'Pelajaran B. Inggris Disukai', key: 'pelajaranInggrisDisukai' },
  { label: 'Pelajaran Eksakta Disukai', key: 'pelajaranEksaktaDisukai' },
  { label: 'Pelajaran Tidak Disukai', key: 'pelajaranTidakDisukai' },
  { label: 'Ekskul Disukai', key: 'ekskulDisukai' },
  { label: 'Ekskul Tidak Disukai', key: 'ekskulTidakDisukai' },
  { label: 'Kegiatan Besar Disukai', key: 'kegiatanBesarDisukai' },
  { label: 'Kegiatan Besar Tidak Disukai', key: 'kegiatanBesarTidakDisukai' },
  { label: 'Rencana MA/SMA', key: 'rencanaMA' },
  { label: 'Rencana Kuliah', key: 'rencanaKuliah' },
  { label: 'Rencana Karier', key: 'rencanaKarier' },
  { label: 'Tempat Kerja Diinginkan', key: 'tempatKerjaDiinginkan' },
  { label: 'Profesi Cita-cita', key: 'profesiCitaCita' },
  { label: 'Skill Ingin Dipelajari', key: 'skillDipelajari' },
  { label: 'Target 10 Tahun', key: 'target10Tahun' },
  { label: 'Di-input Oleh', key: 'diInputOleh' },
  { label: 'Tanggal Input', key: 'tanggalInput', type: 'date' },
  { label: 'Catatan Sekpim', key: 'catatanSekpim' },
];

async function requireSantriTemplateAccess(req: NextRequest) {
  return requireMenuAccess(req, '/admin/santri', ['ADMIN', 'PRINCIPAL']);
}

/**
 * GET /api/admin/santri/template
 * Download Excel template for santri import
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireSantriTemplateAccess(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Sample data row
    const sampleRow: Record<string, string> = {};
    for (const field of ALL_FIELDS) {
      sampleRow[field.label] = '';
    }
    sampleRow['Nama Lengkap'] = 'Ahmad Fauzi';
    sampleRow['No Stambuk'] = '2024001';
    sampleRow['Jenis Kelamin'] = 'MALE';
    sampleRow['Tahun Daftar'] = '2024';
    sampleRow['Tempat Lahir'] = 'Lahat';
    sampleRow['Tanggal Lahir'] = '2010-05-15';
    sampleRow['NIK'] = '1234567890123456';
    sampleRow['NISN'] = '0012345678';
    sampleRow['Asal Sekolah'] = 'SDN 1 Lahat';
    sampleRow['Telepon Santri'] = '081234567890';
    sampleRow['Nama Ayah'] = 'Budi Santoso';
    sampleRow['Nama Ibu'] = 'Siti Aminah';

    // Create workbook with data sheet
    const ws = XLSX.utils.json_to_sheet([sampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Santri');

    ws['!cols'] = ALL_FIELDS.map(f => ({
      wch: Math.max(f.label.length + 2, 18),
    }));

    // Instructions sheet
    const instructionData = [
      ['PANDUAN IMPOR DATA SANTRI'],
      [''],
      ['Kolom yang Wajib Diisi:'],
      ['1. Nama Lengkap - Nama lengkap santri'],
      ['2. No Stambuk - Nomor stambuk unik santri'],
      [''],
      ['Format Pengisian:'],
      ['1. Jenis Kelamin - Isi dengan MALE atau FEMALE'],
      ['2. Tanggal Lahir - Format: YYYY-MM-DD (contoh: 2010-05-15)'],
      ['3. Tanggal Input - Format: YYYY-MM-DD (contoh: 2024-01-01)'],
      ['4. Anak Ke / Dari Anak - Isi dengan angka (contoh: 2)'],
      [''],
      ['Catatan Penting:'],
      ['- Jangan menghapus baris header (baris pertama)'],
      ['- Jika No Stambuk sudah ada di database, data akan diupdate (bukan duplikasi)'],
      ['- Jika No Stambuk belum ada, data baru akan dibuat'],
      ['- Baris tanpa Nama Lengkap dan No Stambuk akan dilewati'],
      ['- Kolom boleh kosong jika tidak ada data'],
      ['- Urutan kolom harus sesuai template ini'],
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionData);
    wsInstructions['!cols'] = [{ wch: 70 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Panduan');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template-santri.xlsx"',
      },
    });
  } catch (error: unknown) {
    serverError('Download santri template error:', error);
    return new NextResponse('Failed to download template', { status: 500 });
  }
}
