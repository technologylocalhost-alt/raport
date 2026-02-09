'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, BookOpen, Luggage, Eye, MoreVertical } from 'lucide-react';

interface Class {
  id: string;
  name: string;
  levelId: string;
  levelName?: string;
  levelCode?: string;
  semesterId: string;
  semesterNumber?: number;
  capacity: number;
  schoolYearId: string;
  schoolYear?: string;
  waliKelasId: string;
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
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      fetchClasses(parsedUser.id);
    }
  }, []);

  async function fetchClasses(waliKelasId: string) {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await fetch(
        `/api/admin/classes?limit=100&waliKelasId=${waliKelasId}`,
        { headers }
      );

      const data = await response.json();

      if (response.ok) {
        const transformedClasses = (data.data || []).map((c: any) => ({
          ...c,
          levelName: c.level?.name || '-',
          levelCode: c.level?.code || '-',
          semesterNumber: c.semester?.number || '-',
          schoolYear: c.schoolYear?.year || '-',
        }));
        setClasses(transformedClasses);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
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

      {/* Classes Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
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
              <tr key={classItem.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-semibold text-gray-900">{classItem.name}</p>
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
                      onClick={() => router.push(`/wali-kelas/students?classId=${classItem.id}`)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors"
                      title="Kelola Siswa"
                    >
                      Siswa
                    </button>
                    <button
                      onClick={() => router.push(`/wali-kelas/management`)}
                      className="p-1 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                      title="Kelola Kelas"
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
    </div>
  );
}
