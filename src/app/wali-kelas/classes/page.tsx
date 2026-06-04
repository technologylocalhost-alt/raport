'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, BookOpen, Luggage, Eye } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { getCurrentUser } from '@/lib/auth/client';
import { devError } from '@/lib/dev-log';

interface Class {
  id: string;
  name: string;
  levelId: string;
  levelName?: string;
  levelCode?: string;
  semesterId: string;
  semesterNumber?: number | string;
  capacity: number;
  schoolYearId: string;
  schoolYear?: string;
  waliKelasId: string;
  isActive?: boolean;
  level?: { name?: string; code?: string };
  semester?: { number?: number };
  schoolYearData?: { year?: string };
  _count?: {
    students: number;
  };
  teachers?: Array<{
    id: string;
    teacherId: string;
    subjectId: string;
    teacher: {
      id: string;
      name: string;
      email: string;
    };
    subject: {
      id: string;
      name: string;
      code: string;
    };
  }>;
}

export default function WaliKelasClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const parsedUser = getCurrentUser() as { id: string } | null;
    if (parsedUser) {
      void fetchClasses(parsedUser.id);
    }
  }, []);

  async function fetchClasses(waliKelasId: string) {
    try {
      setIsLoading(true);

      const response = await apiFetch(
        `/api/admin/classes?limit=100&waliKelasId=${waliKelasId}&includeInactive=true`
      );

      const data = await response.json();

      if (response.ok) {
        const transformedClasses = (data.data || []).map((c: Class) => ({
          ...c,
          levelName: c.level?.name || '-',
          levelCode: c.level?.code || '-',
          semesterNumber: c.semester?.number || '-',
          schoolYear: c.schoolYearData?.year || c.schoolYear || '-',
        }));
        setClasses(transformedClasses);
      }
    } catch (error) {
      devError('Error fetching classes:', error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Memuat data kelas...</p>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Daftar Kelas Saya</h1>
          <p className="text-gray-600 mt-1">Kelola kelas yang Anda pimpin</p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-yellow-800">
            📌 Anda belum ditugaskan sebagai Wali Kelas di kelas manapun.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Daftar Kelas Saya</h1>
        <p className="text-gray-600 mt-1">
          {classes.length} kelas yang Anda pimpin sebagai Wali Kelas
        </p>
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Users className="text-blue-600" size={24} />
            <div>
              <p className="text-xs text-blue-600 font-semibold uppercase">Total Siswa</p>
              <p className="text-2xl font-bold text-blue-900">
                {classes.reduce((sum, c) => sum + (c._count?.students || 0), 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <BookOpen className="text-purple-600" size={24} />
            <div>
              <p className="text-xs text-purple-600 font-semibold uppercase">Total Guru Unik</p>
              <p className="text-2xl font-bold text-purple-900">
                {new Set(classes.flatMap(c => c.teachers?.map(t => t.teacher.id) || [])).size}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Luggage className="text-amber-600" size={24} />
            <div>
              <p className="text-xs text-amber-600 font-semibold uppercase">Total Kapasitas</p>
              <p className="text-2xl font-bold text-amber-900">
                {classes.reduce((sum, c) => sum + c.capacity, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Classes Table - Desktop View */}
      <div className="hidden md:block bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nama Kelas</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tingkat</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tahun Ajaran</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Siswa</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Guru</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Kapasitas</th>
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((classItem) => (
              <tr key={classItem.id} className={`border-b ${classItem.isActive !== false ? 'hover:bg-gray-50' : 'bg-gray-50'} ${classItem.isActive === false ? 'opacity-70' : ''}`}>
                <td className="px-6 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{classItem.name}</p>
                      {classItem.isActive === false && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                          Tidak Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">Semester {classItem.semesterNumber}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{classItem.levelName}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{classItem.schoolYear}</td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Users size={16} className="text-blue-600" />
                    <span className="font-semibold text-gray-900">{classItem._count?.students || 0}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <BookOpen size={16} className="text-purple-600" />
                    <span className="font-semibold text-gray-900">{classItem.teachers?.length || 0}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Luggage size={16} className="text-amber-600" />
                    <span className="font-semibold text-gray-900">{classItem.capacity}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => classItem.isActive !== false && router.push(`/wali-kelas/students?classId=${classItem.id}`)}
                      disabled={classItem.isActive === false}
                      className={`px-3 py-1 rounded-lg transition-colors text-white text-xs font-medium ${classItem.isActive !== false ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-300 cursor-not-allowed'}`}
                      title={classItem.isActive === false ? 'Kelas Tidak Aktif' : 'Kelola Siswa'}
                    >
                      Siswa
                    </button>
                    <button
                      onClick={() => classItem.isActive !== false && router.push(`/wali-kelas/management`)}
                      disabled={classItem.isActive === false}
                      className={`p-1 rounded-lg transition-colors ${classItem.isActive !== false ? 'hover:bg-gray-200 text-gray-600' : 'text-gray-400 cursor-not-allowed'}`}
                      title={classItem.isActive === false ? 'Kelas Tidak Aktif' : 'Kelola Kelas'}
                    >
                      <Eye size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Classes Cards - Mobile View */}
      <div className="md:hidden space-y-4">
        {classes.map((classItem) => (
          <div key={classItem.id} className={`bg-white rounded-lg shadow-md border border-gray-200 p-4 ${classItem.isActive === false ? 'opacity-70' : ''}`}>
            {/* Class Name */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-bold text-lg text-gray-900">{classItem.name}</p>
                {classItem.isActive === false && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded">
                    Tidak Aktif
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">Semester {classItem.semesterNumber} • {classItem.schoolYear}</p>
            </div>

            {/* Level Info */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{classItem.levelName}</span>
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-gray-200">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Users size={16} className="text-blue-600" />
                </div>
                <p className="text-lg font-bold text-gray-900">{classItem._count?.students || 0}</p>
                <p className="text-xs text-gray-600">Siswa</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <BookOpen size={16} className="text-purple-600" />
                </div>
                <p className="text-lg font-bold text-gray-900">{classItem.teachers?.length || 0}</p>
                <p className="text-xs text-gray-600">Guru</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Luggage size={16} className="text-amber-600" />
                </div>
                <p className="text-lg font-bold text-gray-900">{classItem.capacity}</p>
                <p className="text-xs text-gray-600">Kapasitas</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => classItem.isActive !== false && router.push(`/wali-kelas/students?classId=${classItem.id}`)}
                disabled={classItem.isActive === false}
                className={`flex-1 px-3 py-2 text-white text-sm font-medium rounded-lg transition-colors ${classItem.isActive !== false ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-300 cursor-not-allowed'}`}
              >
                {classItem.isActive === false ? 'Tidak Aktif' : 'Kelola Siswa'}
              </button>
              <button
                onClick={() => classItem.isActive !== false && router.push(`/wali-kelas/management`)}
                disabled={classItem.isActive === false}
                className={`px-3 py-2 rounded-lg transition-colors ${classItem.isActive !== false ? 'bg-gray-200 hover:bg-gray-300 text-gray-600' : 'bg-gray-100 cursor-not-allowed text-gray-400'}`}
                title={classItem.isActive === false ? 'Kelas Tidak Aktif' : 'Kelola Kelas'}
              >
                <Eye size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
