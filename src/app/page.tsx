'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, Users } from 'lucide-react';
import { devError } from '@/lib/dev-log';

interface SchoolData {
  [className: string]: StudentData[];
}

interface StudentData {
  id: string;
  name: string;
  studentNo?: string;
  nourut?: number;
  class?: {
    id: string;
    name: string;
  };
  average: number;
  mulahazoh?: string;
}

interface School {
  id: string;
  name: string;
}

interface PengumumanSchoolYear {
  year?: string;
  tahunAkademik?: string;
}

interface PengumumanResponse {
  success: boolean;
  data?: Record<string, SchoolData>;
  schoolYear?: PengumumanSchoolYear | null;
  schools?: School[];
}

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [allData, setAllData] = useState<Record<string, SchoolData>>({});
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [searchNama, setSearchNama] = useState('');
  const [filteredData, setFilteredData] = useState<Record<string, SchoolData>>({});
  const [schoolYear, setSchoolYear] = useState<PengumumanSchoolYear | null>(null);

  useEffect(() => {
    // Check if user is logged in
    if (typeof window !== 'undefined' && localStorage.getItem('accessToken')) {
      setIsLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    fetchGrades();
  }, []);

  useEffect(() => {
    // Apply filters based on selected school and search
    let dataToFilter = allData;
    
    if (selectedSchool !== 'all') {
      dataToFilter = { [selectedSchool]: allData[selectedSchool] || {} };
    }

    if (searchNama.trim()) {
      const filtered: Record<string, SchoolData> = {};
      Object.entries(dataToFilter).forEach(([schoolName, classes]) => {
        const filteredClasses: SchoolData = {};
        Object.entries(classes).forEach(([className, students]) => {
          const filteredStudents = students.filter(item =>
            item.name.toLowerCase().includes(searchNama.toLowerCase()) ||
            item.studentNo?.includes(searchNama)
          );
          if (filteredStudents.length > 0) {
            filteredClasses[className] = filteredStudents;
          }
        });
        if (Object.keys(filteredClasses).length > 0) {
          filtered[schoolName] = filteredClasses;
        }
      });
      setFilteredData(filtered);
    } else {
      setFilteredData(dataToFilter);
    }
  }, [searchNama, selectedSchool, allData]);

  const fetchGrades = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/nilai-pengumuman');
      if (!response.ok) throw new Error('Failed to fetch');
      
      const result: PengumumanResponse = await response.json();
      if (result.success) {
        setAllData(result.data || {});
        setFilteredData(result.data || {});
        setSchoolYear(result.schoolYear ?? null);
        setSchools(result.schools || []);
        // Set default selected school to first one
        if (result.schools && result.schools.length > 0) {
          setSelectedSchool(result.schools[0]?.name || 'all');
        }
      }
    } catch (error) {
      devError('Error fetching grades:', error);
      setAllData({});
      setFilteredData({});
    } finally {
      setLoading(false);
    }
  };

  const allStudentsCount = Object.values(filteredData)
    .reduce((total, school) => total + Object.values(school).flat().length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-lg">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Raport</h1>
              <p className="text-xs text-gray-500">Pengumuman Nilai Siswa</p>
            </div>
          </div>
          {isLoggedIn && (
            <Link
              href="/admin/dashboard"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Dashboard
            </Link>
          )}
          {!isLoggedIn && (
            <Link
              href="/login"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Login
            </Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-2">
            Pengumuman Nilai Siswa
          </h2>
          {schoolYear && (
            <p className="text-lg text-indigo-600 font-semibold">
              Tahun Ajaran {schoolYear.tahunAkademik || schoolYear.year}
            </p>
          )}
          <p className="text-gray-600 mt-2">
            Nilai siswa yang sudah di-approve oleh wali kelas
          </p>
        </div>

        {/* School Selector */}
        {schools.length > 1 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pilih Sekolah
            </label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedSchool('all')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedSchool === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Semua Sekolah
              </button>
              {schools.map((school) => (
                <button
                  key={school.id}
                  onClick={() => setSelectedSchool(school.name)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    selectedSchool === school.name
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {school.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cari Siswa
          </label>
          <input
            type="text"
            value={searchNama}
            onChange={(e) => setSearchNama(e.target.value)}
            placeholder="Masukkan nama atau nomor roll..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-500"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Memuat data nilai...</p>
          </div>
        ) : Object.keys(filteredData).length > 0 ? (
          <div className="space-y-8">
            {/* Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Siswa</p>
                  <p className="text-3xl font-bold text-indigo-600">{allStudentsCount}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Kelas</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {Object.values(filteredData).reduce((total, school) => total + Object.keys(school).length, 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Schools and Classes */}
            {Object.entries(filteredData).map(([schoolName, classes]) => (
              <div key={schoolName}>
                <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-3 border-b-2 border-indigo-600">
                  {schoolName}
                </h2>
                
                <div className="space-y-6">
                  {Object.entries(classes).map(([className, students]) => (
                    <div key={className} className="bg-white rounded-lg shadow-lg overflow-hidden">
                      {/* Class Header */}
                      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          {className}
                        </h3>
                        <p className="text-indigo-100 text-sm mt-1">
                          {students.length} siswa
                        </p>
                      </div>

                      {/* Students Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                                No.
                              </th>
                              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                                Nama Siswa
                              </th>
                              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                                No. Roll
                              </th>
                              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                                Nilai Rata-Rata
                              </th>
                              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                                Mulahazoh
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {students.map((student, idx) => (
                              <tr
                                key={student.id}
                                className="border-b border-gray-200 hover:bg-indigo-50 transition"
                              >
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                  {idx + 1}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900">
                                  {student.name}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                  {student.studentNo}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                                    {student.average.toFixed(2)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-700">
                                  {student.mulahazoh || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-lg shadow">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-25" />
            <p className="text-gray-600">
              {searchNama ? 'Tidak ada siswa ditemukan' : 'Belum ada data nilai'}
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-600 text-sm">
            © 2026 PPM Dar us Salam Lahat. Sistem Manajemen Raport.
          </p>
        </div>
      </footer>
    </div>
  );
}
