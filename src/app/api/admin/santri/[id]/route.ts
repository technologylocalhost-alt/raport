import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { requireMenuAccess } from '@/lib/auth/verify-access';
import { logActivity, getClientIp, getUserAgent } from '@/lib/activity-logger';
import { AuthenticatedUser } from '@/lib/auth/access';
import { serverError } from '@/lib/server-log';

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
] as const;

const SANTRI_INT_FIELDS = ['anakKe', 'dariAnak'] as const;
const SANTRI_DATE_FIELDS = ['birthDate', 'tanggalInput'] as const;

function buildSantriData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const field of SANTRI_STRING_FIELDS) {
    if (body[field] !== undefined) {
      data[field] = body[field] || null;
    }
  }
  for (const field of SANTRI_INT_FIELDS) {
    if (body[field] !== undefined) {
      data[field] = body[field] ? parseInt(String(body[field]), 10) : null;
    }
  }
  for (const field of SANTRI_DATE_FIELDS) {
    if (body[field] !== undefined) {
      data[field] = body[field] ? new Date(String(body[field])) : null;
    }
  }
  if (data.name === null) delete data.name;
  if (data.studentNo === null) delete data.studentNo;
  if (data.gender === null) data.gender = 'MALE';
  return data;
}

async function requireSantriAccess(req: NextRequest) {
  return requireMenuAccess(req, '/admin/santri', ['ADMIN', 'PRINCIPAL']);
}

/**
 * GET /api/admin/santri/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = await requireSantriAccess(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const santri = await prisma.santri.findUnique({
      where: { id },
    });

    if (!santri) {
      return errorResponse('Data santri tidak ditemukan', 404);
    }

    let classHistory: Array<{ className: string; levelName: string; waliKelasName: string; schoolYear: string; semester: string }> = [];
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

      classHistory = students.map((s) => ({
        className: s.class.name,
        levelName: s.class.level.name,
        waliKelasName: s.class.waliKelas?.name || '-',
        schoolYear: s.class.schoolYear.year,
        semester: s.class.semester.semesterLabel || `Semester ${s.class.semester.number}`,
      }));
    }

    return successResponse({ ...santri, classHistory });
  } catch (error) {
    serverError('Error fetching santri:', error);
    return errorResponse('Gagal memuat data santri', 500);
  }
}

/**
 * PUT /api/admin/santri/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin: AuthenticatedUser | null = null;
  let id = '';
  try {
    const result = await params;
    id = result.id;
    admin = await requireSantriAccess(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const santri = await prisma.santri.findUnique({
      where: { id },
    });

    if (!santri) {
      return errorResponse('Data santri tidak ditemukan', 404);
    }

    const body = (await request.json()) as Record<string, unknown>;

    if (body.studentNo && body.studentNo !== santri.studentNo) {
      const existing = await prisma.santri.findUnique({
        where: { studentNo: String(body.studentNo) },
      });
      if (existing) {
        return errorResponse('No Stambuk sudah terdaftar', 409);
      }
    }

    const data = buildSantriData(body);
    const updated = await prisma.santri.update({
      where: { id },
      data,
    });

    await logActivity({
      userId: admin.id,
      action: 'UPDATE',
      resourceType: 'Santri',
      resourceId: id,
      resourceName: updated.name,
      description: `Updated santri ${updated.name}`,
      newValue: body,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(updated);
  } catch (error) {
    serverError('Error updating santri:', error);
    if (admin) {
      await logActivity({
        userId: admin.id,
        action: 'UPDATE',
        resourceType: 'Santri',
        resourceId: id,
        description: 'Failed to update santri',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
      });
    }
    return errorResponse('Gagal mengubah data santri', 500);
  }
}

/**
 * DELETE /api/admin/santri/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin: AuthenticatedUser | null = null;
  let id = '';
  try {
    const result = await params;
    id = result.id;
    admin = await requireSantriAccess(request);
    if (!admin) {
      return errorResponse('Unauthorized', 401);
    }

    const santri = await prisma.santri.findUnique({
      where: { id },
    });

    if (!santri) {
      return errorResponse('Data santri tidak ditemukan', 404);
    }

    await prisma.santri.delete({
      where: { id },
    });

    await logActivity({
      userId: admin.id,
      action: 'DELETE',
      resourceType: 'Santri',
      resourceId: id,
      resourceName: santri.name,
      description: `Deleted santri ${santri.name}`,
      oldValue: santri,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      status: 'SUCCESS',
    });

    return successResponse(null, 'Data santri berhasil dihapus');
  } catch (error) {
    serverError('Error deleting santri:', error);
    if (admin) {
      await logActivity({
        userId: admin.id,
        action: 'DELETE',
        resourceType: 'Santri',
        resourceId: id,
        description: 'Failed to delete santri',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        status: 'FAILED',
      });
    }
    return errorResponse('Gagal menghapus data santri', 500);
  }
}
