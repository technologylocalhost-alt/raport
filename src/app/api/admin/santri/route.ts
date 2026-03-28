import { NextRequest } from 'next/server';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';

// All allowed string fields for Santri (excluding id, createdAt, updatedAt)
const SANTRI_STRING_FIELDS = [
  'tahunDaftar', 'noPendaftaranPSB', 'studentNo', 'tingkatSebelumnya', 'gender',
  'name', 'namaPanggilan', 'birthPlace', 'nik', 'nisn', 'asalSekolah', 'nsmNpsn',
  'statusDomisili', 'alamatKK', 'kodePos', 'domisiliLuar', 'penanggungJawab', 'penanggungJawabHP',
  'ukuranPakaian', 'bahasaSehariHari', 'golonganDarah', 'tinggiBadan', 'beratBadan', 'noBPJS',
  'phone', 'address', 'parentPhoneNo',
  'kondisiGigi', 'kondisiFisik', 'instansiKesehatanNama', 'instansiKesehatanAlamat', 'instansiKesehatanHP',
  'penyakitDalam', 'rawatJalan', 'riwayatSakit', 'alergiMakanan', 'alergiObat', 'konsumsiObatRutin',
  'ayahNama', 'ayahStatus', 'ayahTempatTglLahir', 'ayahKebangsaan', 'ayahNIK', 'ayahNoKK', 'ayahAgama',
  'ayahPendidikan', 'ayahPekerjaan', 'ayahPenghasilan', 'ayahAlamat', 'ayahTelepon', 'ayahEmail',
  'ibuNama', 'ibuStatus', 'ibuTempatTglLahir', 'ibuKebangsaan', 'ibuNIK', 'ibuNoKK', 'ibuAgama',
  'ibuPendidikan', 'ibuPekerjaan', 'ibuPenghasilan', 'ibuAlamat', 'ibuTelepon', 'ibuEmail',
  'sumberPembiayaan', 'detailPembiayaan', 'nominalBantuan', 'periodeBantuan',
  'waliStatus', 'waliNama', 'waliTempatTglLahir', 'waliNIK', 'waliNoKK', 'waliAgama',
  'waliPendidikan', 'waliPekerjaan', 'waliPenghasilan', 'waliAlamat', 'waliKondisi',
  'pendidikanTK', 'pendidikanPAUD', 'pendidikanSD', 'pendidikanSMP', 'pendidikanSMA',
  'riwayatKelas', 'riwayatKamar', 'kamarBerkesan',
  'motivasiMasuk', 'ikutOrangtuaAtauSendiri', 'betahDiPondok', 'alasanBetah', 'alasanTidakBetah',
  'janjiOrangtua', 'inspirasiDiPondok', 'sosokTeladan', 'sadarDewasa', 'dariManaTahuPPMDL',
  'lingkunganSuku', 'lingkunganBahasa', 'lingkunganInteraksi', 'lingkunganTradisi',
  'lingkunganGotongRoyong', 'lingkunganPolitik', 'lingkunganOrmasMasyarakat', 'lingkunganOrmasKeagamaan',
  'lingkunganBeragama', 'lingkunganJarakMasjid', 'lingkunganKeagamaan', 'lingkunganJumlahMasjid',
  'lingkunganShalatJamaah', 'lingkunganPendidikanMayoritas', 'lingkunganLembagaPendidikan',
  'lingkunganBudayaBelajar', 'lingkunganAksesInternet', 'lingkunganGadget', 'lingkunganMedsos',
  'lingkunganOrganisasi', 'lingkunganKepemudaan', 'lingkunganKeamanan', 'lingkunganRonda',
  'lingkunganPergaulanRemaja',
  'prestasi', 'kegiatanOrganisasi', 'kegiatanEkskul', 'subjekDigemari',
  'pernahOperasi', 'penyakitKronis', 'alergiZat', 'gejalaSatuTahun', 'kebutuhanKhusus',
  'preferensiBahasa', 'preferensiPelajaran', 'pelajaranArabDisukai', 'pelajaranInggrisDisukai',
  'pelajaranEksaktaDisukai', 'pelajaranTidakDisukai', 'ekskulDisukai', 'ekskulTidakDisukai',
  'kegiatanBesarDisukai', 'kegiatanBesarTidakDisukai', 'rencanaMA', 'rencanaKuliah', 'rencanaKarier',
  'tempatKerjaDiinginkan', 'profesiCitaCita', 'skillDipelajari', 'target10Tahun',
  'diInputOleh', 'catatanSekpim',
];

const SANTRI_INT_FIELDS = ['anakKe', 'dariAnak'];
const SANTRI_DATE_FIELDS = ['birthDate', 'tanggalInput'];

function buildSantriData(body: any) {
  const data: any = {};
  for (const field of SANTRI_STRING_FIELDS) {
    if (body[field] !== undefined) {
      data[field] = body[field] || null;
    }
  }
  for (const field of SANTRI_INT_FIELDS) {
    if (body[field] !== undefined) {
      data[field] = body[field] ? parseInt(body[field]) : null;
    }
  }
  for (const field of SANTRI_DATE_FIELDS) {
    if (body[field] !== undefined) {
      data[field] = body[field] ? new Date(body[field]) : null;
    }
  }
  // Ensure required fields are not null
  if (data.name === null) delete data.name;
  if (data.studentNo === null) delete data.studentNo;
  if (data.gender === null) data.gender = 'MALE';
  return data;
}

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (user && (user.role === 'ADMIN' || user.role === 'PRINCIPAL')) {
    return user;
  }
  return null;
}

/**
 * GET /api/admin/santri
 * Get all santri with pagination and search
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const gender = searchParams.get('gender') || '';

    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { studentNo: { contains: search, mode: 'insensitive' } },
        { nisn: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (gender) {
      where.gender = gender;
    }

    const [santriList, total] = await Promise.all([
      prisma.santri.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ studentNo: 'asc' }],
      }),
      prisma.santri.count({ where }),
    ]);

    return paginatedResponse(santriList, total, page, limit);
  } catch (error) {
    console.error('Error fetching santri:', error);
    return errorResponse('Failed to fetch santri', 500);
  }
}

/**
 * POST /api/admin/santri
 * Create a new santri
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAdmin(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();

    if (!body.name || !body.studentNo) {
      return errorResponse('Nama dan No Stambuk wajib diisi', 400);
    }

    const existing = await prisma.santri.findUnique({
      where: { studentNo: body.studentNo },
    });

    if (existing) {
      return errorResponse('No Stambuk sudah terdaftar', 409);
    }

    const data = buildSantriData(body);
    const santri = await prisma.santri.create({ data });

    await logActivity({
      userId: user.id,
      action: 'CREATE',
      resourceType: 'Santri',
      resourceId: santri.id,
      resourceName: `${santri.name} (${santri.studentNo})`,
      description: `Created santri: ${santri.name} with no stambuk ${santri.studentNo}`,
      newValue: { name: santri.name, studentNo: santri.studentNo },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(santri);
  } catch (error) {
    console.error('Error creating santri:', error);
    return errorResponse('Gagal menambah data santri', 500);
  }
}
