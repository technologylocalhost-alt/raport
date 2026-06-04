import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminOrPrincipal } from '@/lib/auth/admin-access';
import * as XLSX from 'xlsx';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { AuthenticatedUser } from '@/lib/auth/access';
import { serverError } from '@/lib/server-log';

// Label → key mapping (must match export/template headers)
const LABEL_TO_KEY: Record<string, { key: string; type?: string }> = {
  'nama lengkap': { key: 'name' },
  'nama panggilan': { key: 'namaPanggilan' },
  'no stambuk': { key: 'studentNo' },
  'jenis kelamin': { key: 'gender' },
  'tahun daftar': { key: 'tahunDaftar' },
  'no pendaftaran psb': { key: 'noPendaftaranPSB' },
  'tingkat pendidikan sebelumnya': { key: 'tingkatSebelumnya' },
  'nik': { key: 'nik' },
  'nisn': { key: 'nisn' },
  'asal sekolah': { key: 'asalSekolah' },
  'nsm/npsn asal sekolah': { key: 'nsmNpsn' },
  'tempat lahir': { key: 'birthPlace' },
  'tanggal lahir': { key: 'birthDate', type: 'date' },
  'anak ke': { key: 'anakKe', type: 'int' },
  'dari anak': { key: 'dariAnak', type: 'int' },
  'status domisili': { key: 'statusDomisili' },
  'telepon santri': { key: 'phone' },
  'alamat sesuai kk': { key: 'alamatKK' },
  'kode pos': { key: 'kodePos' },
  'domisili di luar kk': { key: 'domisiliLuar' },
  'penanggung jawab (nama)': { key: 'penanggungJawab' },
  'hp penanggung jawab': { key: 'penanggungJawabHP' },
  'telepon wali/orang tua': { key: 'parentPhoneNo' },
  'ukuran pakaian': { key: 'ukuranPakaian' },
  'bahasa sehari-hari': { key: 'bahasaSehariHari' },
  'golongan darah': { key: 'golonganDarah' },
  'tinggi badan (cm)': { key: 'tinggiBadan' },
  'berat badan (kg)': { key: 'beratBadan' },
  'no bpjs': { key: 'noBPJS' },
  'alamat lengkap': { key: 'address' },
  'kondisi gigi': { key: 'kondisiGigi' },
  'kondisi badan/fisik': { key: 'kondisiFisik' },
  'nama rs/dokter': { key: 'instansiKesehatanNama' },
  'alamat rs/dokter': { key: 'instansiKesehatanAlamat' },
  'no hp rs/dokter': { key: 'instansiKesehatanHP' },
  'penyakit dalam (pernah/sedang)': { key: 'penyakitDalam' },
  'rawat jalan & kambuh': { key: 'rawatJalan' },
  'riwayat sakit (sudah sembuh)': { key: 'riwayatSakit' },
  'alergi makanan/pantangan': { key: 'alergiMakanan' },
  'alergi obat/pantangan': { key: 'alergiObat' },
  'konsumsi obat rutin': { key: 'konsumsiObatRutin' },
  'pernah operasi?': { key: 'pernahOperasi' },
  'penyakit kronis?': { key: 'penyakitKronis' },
  'alergi zat/makanan tertentu?': { key: 'alergiZat' },
  'gejala/keluhan selama 1 tahun?': { key: 'gejalaSatuTahun' },
  'kebutuhan khusus kesehatan?': { key: 'kebutuhanKhusus' },
  'nama ayah': { key: 'ayahNama' },
  'status ayah': { key: 'ayahStatus' },
  'tempat/tgl lahir ayah': { key: 'ayahTempatTglLahir' },
  'kebangsaan ayah': { key: 'ayahKebangsaan' },
  'nik ayah': { key: 'ayahNIK' },
  'no kk ayah': { key: 'ayahNoKK' },
  'agama ayah': { key: 'ayahAgama' },
  'pendidikan ayah': { key: 'ayahPendidikan' },
  'pekerjaan ayah': { key: 'ayahPekerjaan' },
  'penghasilan ayah': { key: 'ayahPenghasilan' },
  'alamat ayah': { key: 'ayahAlamat' },
  'telepon ayah': { key: 'ayahTelepon' },
  'email ayah': { key: 'ayahEmail' },
  'nama ibu': { key: 'ibuNama' },
  'status ibu': { key: 'ibuStatus' },
  'tempat/tgl lahir ibu': { key: 'ibuTempatTglLahir' },
  'kebangsaan ibu': { key: 'ibuKebangsaan' },
  'nik ibu': { key: 'ibuNIK' },
  'no kk ibu': { key: 'ibuNoKK' },
  'agama ibu': { key: 'ibuAgama' },
  'pendidikan ibu': { key: 'ibuPendidikan' },
  'pekerjaan ibu': { key: 'ibuPekerjaan' },
  'penghasilan ibu': { key: 'ibuPenghasilan' },
  'alamat ibu': { key: 'ibuAlamat' },
  'telepon ibu': { key: 'ibuTelepon' },
  'email ibu': { key: 'ibuEmail' },
  'sumber pembiayaan': { key: 'sumberPembiayaan' },
  'detail pembiayaan': { key: 'detailPembiayaan' },
  'nominal bantuan/beasiswa': { key: 'nominalBantuan' },
  'periode bantuan': { key: 'periodeBantuan' },
  'status hubungan wali': { key: 'waliStatus' },
  'nama wali': { key: 'waliNama' },
  'tempat/tgl lahir wali': { key: 'waliTempatTglLahir' },
  'nik wali': { key: 'waliNIK' },
  'no kk wali': { key: 'waliNoKK' },
  'agama wali': { key: 'waliAgama' },
  'pendidikan wali': { key: 'waliPendidikan' },
  'pekerjaan wali': { key: 'waliPekerjaan' },
  'penghasilan wali': { key: 'waliPenghasilan' },
  'alamat wali': { key: 'waliAlamat' },
  'kondisi wali': { key: 'waliKondisi' },
  'tk a/b (tahun)': { key: 'pendidikanTK' },
  'paud (tahun)': { key: 'pendidikanPAUD' },
  'sd/mi (tahun)': { key: 'pendidikanSD' },
  'smp/mts (tahun)': { key: 'pendidikanSMP' },
  'sma/ma (tahun)': { key: 'pendidikanSMA' },
  'riwayat kelas': { key: 'riwayatKelas' },
  'riwayat kamar': { key: 'riwayatKamar' },
  'kamar paling berkesan': { key: 'kamarBerkesan' },
  'motivasi masuk pondok': { key: 'motivasiMasuk' },
  'ikut orangtua/sendiri': { key: 'ikutOrangtuaAtauSendiri' },
  'betah di pondok?': { key: 'betahDiPondok' },
  'alasan betah': { key: 'alasanBetah' },
  'alasan tidak betah': { key: 'alasanTidakBetah' },
  'janji orangtua': { key: 'janjiOrangtua' },
  'inspirasi di pondok': { key: 'inspirasiDiPondok' },
  'sosok teladan': { key: 'sosokTeladan' },
  'kapan sadar dewasa': { key: 'sadarDewasa' },
  'dari mana tahu ppmdl': { key: 'dariManaTahuPPMDL' },
  'suku mayoritas': { key: 'lingkunganSuku' },
  'bahasa masyarakat': { key: 'lingkunganBahasa' },
  'interaksi sosial': { key: 'lingkunganInteraksi' },
  'tradisi/adat': { key: 'lingkunganTradisi' },
  'gotong royong': { key: 'lingkunganGotongRoyong' },
  'politik': { key: 'lingkunganPolitik' },
  'ormas masyarakat': { key: 'lingkunganOrmasMasyarakat' },
  'ormas keagamaan': { key: 'lingkunganOrmasKeagamaan' },
  'kehidupan beragama': { key: 'lingkunganBeragama' },
  'jarak ke masjid': { key: 'lingkunganJarakMasjid' },
  'kegiatan keagamaan': { key: 'lingkunganKeagamaan' },
  'jumlah masjid': { key: 'lingkunganJumlahMasjid' },
  'shalat berjamaah': { key: 'lingkunganShalatJamaah' },
  'pendidikan mayoritas': { key: 'lingkunganPendidikanMayoritas' },
  'lembaga pendidikan': { key: 'lingkunganLembagaPendidikan' },
  'budaya belajar': { key: 'lingkunganBudayaBelajar' },
  'akses internet': { key: 'lingkunganAksesInternet' },
  'penggunaan gadget': { key: 'lingkunganGadget' },
  'media sosial': { key: 'lingkunganMedsos' },
  'organisasi aktif': { key: 'lingkunganOrganisasi' },
  'kegiatan kepemudaan': { key: 'lingkunganKepemudaan' },
  'keamanan': { key: 'lingkunganKeamanan' },
  'ronda/siskamling': { key: 'lingkunganRonda' },
  'pergaulan remaja': { key: 'lingkunganPergaulanRemaja' },
  'prestasi': { key: 'prestasi' },
  'kegiatan organisasi': { key: 'kegiatanOrganisasi' },
  'kegiatan ekskul': { key: 'kegiatanEkskul' },
  'subjek digemari': { key: 'subjekDigemari' },
  'bahasa disukai': { key: 'preferensiBahasa' },
  'jenis pelajaran disukai': { key: 'preferensiPelajaran' },
  'pelajaran b. arab disukai': { key: 'pelajaranArabDisukai' },
  'pelajaran b. inggris disukai': { key: 'pelajaranInggrisDisukai' },
  'pelajaran eksakta disukai': { key: 'pelajaranEksaktaDisukai' },
  'pelajaran tidak disukai': { key: 'pelajaranTidakDisukai' },
  'ekskul disukai': { key: 'ekskulDisukai' },
  'ekskul tidak disukai': { key: 'ekskulTidakDisukai' },
  'kegiatan besar disukai': { key: 'kegiatanBesarDisukai' },
  'kegiatan besar tidak disukai': { key: 'kegiatanBesarTidakDisukai' },
  'rencana ma/sma': { key: 'rencanaMA' },
  'rencana kuliah': { key: 'rencanaKuliah' },
  'rencana karier': { key: 'rencanaKarier' },
  'tempat kerja diinginkan': { key: 'tempatKerjaDiinginkan' },
  'profesi cita-cita': { key: 'profesiCitaCita' },
  'skill ingin dipelajari': { key: 'skillDipelajari' },
  'target 10 tahun': { key: 'target10Tahun' },
  'di-input oleh': { key: 'diInputOleh' },
  'tanggal input': { key: 'tanggalInput', type: 'date' },
  'catatan sekpim': { key: 'catatanSekpim' },
};

const INT_KEYS = new Set(['anakKe', 'dariAnak']);
const DATE_KEYS = new Set(['birthDate', 'tanggalInput']);

async function requireSantriImportAccess(req: NextRequest) {
  return requireAdminOrPrincipal(req);
}

function parseValue(value: unknown, fieldKey: string): string | number | Date | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();
  if (!str) return null;

  if (INT_KEYS.has(fieldKey)) {
    const num = parseInt(str, 10);
    return isNaN(num) ? null : num;
  }

  if (DATE_KEYS.has(fieldKey)) {
    // Handle Excel serial date numbers
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return new Date(date.y, date.m - 1, date.d);
      }
    }
    const date = new Date(str);
    return isNaN(date.getTime()) ? null : date;
  }

  // Handle gender display values
  if (fieldKey === 'gender') {
    const upper = str.toUpperCase();
    if (upper === 'MALE' || upper === 'LAKI-LAKI' || upper === 'L') return 'MALE';
    if (upper === 'FEMALE' || upper === 'PEREMPUAN' || upper === 'P') return 'FEMALE';
    return str;
  }

  return str;
}

/**
 * POST /api/admin/santri/import
 * Import santri data from Excel file
 */
export async function POST(request: NextRequest) {
  let user: AuthenticatedUser | null = null;
  try {
    user = await requireSantriImportAccess(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ error: 'File Excel kosong' }, { status: 400 });
    }

    // Build header mapping from first row's keys
    const sampleRow = rawData[0] as Record<string, unknown>;
    const headerMap: Record<string, { key: string; type?: string }> = {};
    for (const header of Object.keys(sampleRow)) {
      const normalized = header.toLowerCase().trim();
      if (LABEL_TO_KEY[normalized]) {
        headerMap[header] = LABEL_TO_KEY[normalized];
      }
    }

    const results = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i] as Record<string, unknown>;

      try {
        if (!row || Object.keys(row).length === 0) continue;

        // Extract mapped data
        const data: Record<string, string | number | Date | null> = {};
        for (const [header, fieldInfo] of Object.entries(headerMap)) {
          const rawValue = row[header];
          data[fieldInfo.key] = parseValue(rawValue, fieldInfo.key);
        }

        const name = data.name;
        const studentNo = data.studentNo ? String(data.studentNo) : null;

        // Skip rows without required fields
        if (!name && !studentNo) {
          results.skipped++;
          continue;
        }

        if (!name) {
          results.errors.push(`Baris ${i + 2}: Nama Lengkap harus diisi`);
          results.skipped++;
          continue;
        }

        if (!studentNo) {
          results.errors.push(`Baris ${i + 2}: No Stambuk harus diisi`);
          results.skipped++;
          continue;
        }

        // Ensure studentNo is string
        data.studentNo = String(studentNo);

        // Set default gender
        if (!data.gender) {
          data.gender = 'MALE';
        }

        // Remove null values to avoid overwriting existing data with nulls on update
        const cleanData: Record<string, string | number | Date> = {};
        for (const [key, val] of Object.entries(data)) {
          if (val !== null) {
            cleanData[key] = val;
          }
        }

        // Upsert: check if studentNo exists
        const existing = await prisma.santri.findUnique({
          where: { studentNo: data.studentNo },
        });

        if (existing) {
          await prisma.santri.update({
            where: { studentNo: data.studentNo },
            data: cleanData as Prisma.SantriUpdateInput,
          });
          results.updated++;
        } else {
          await prisma.santri.create({
            data: cleanData as Prisma.SantriCreateInput,
          });
          results.imported++;
        }
      } catch (error: unknown) {
        results.errors.push(`Baris ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.skipped++;
      }
    }

    await logActivity({
      userId: user.id,
      action: 'IMPORT',
      resourceType: 'Santri',
      resourceId: '',
      resourceName: `Imported ${results.imported} santri, updated ${results.updated}`,
      description: 'Imported santri from Excel file',
      newValue: results,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return NextResponse.json({ success: true, data: results }, { status: 200 });
  } catch (error: unknown) {
    serverError('Import santri error:', error);
    if (user) {
      await logActivity({
        userId: user.id,
        action: 'IMPORT',
        resourceType: 'Santri',
        resourceId: '',
        description: 'Failed to import santri',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
      });
    }
    return NextResponse.json({ error: 'Failed to import santri' }, { status: 500 });
  }
}
