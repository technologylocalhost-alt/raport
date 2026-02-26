'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, ChevronDown, ChevronUp, Calendar } from 'lucide-react';

interface SchoolYear {
  id: string;
  schoolId: string;
  year: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

interface Semester {
  id: string;
  number: number;
  schoolYearId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  _count: {
    classes: number;
  };
}

interface SchoolYearWithSemesters extends SchoolYear {
  semesters: Semester[];
}

interface School {
  id: string;
  name: string;
}

export default function AcademicStructurePage() {
  const [schoolYears, setSchoolYears] = useState<SchoolYearWithSemesters[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [expandedYear, setExpandedYear] = useState<string | null>(null);
  const [showYearForm, setShowYearForm] = useState(false);
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [showSemesterForm, setShowSemesterForm] = useState<string | null>(null);
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null);

  const [yearFormData, setYearFormData] = useState({
    schoolId: '',
    year: '',
    startDate: '',
    endDate: '',
    isActive: true,
  });

  const [semesterFormData, setSemesterFormData] = useState({
    number: 1,
    startDate: '',
    endDate: '',
    isActive: true,
  });

  useEffect(() => {
    fetchSchools();
    fetchAcademicStructure();
  }, []);

  async function fetchSchools() {
    try {
      setSchoolsLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/admin/schools?limit=100', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      setSchools(data.data || []);
    } catch (error) {
      console.error('Failed to fetch schools:', error);
    } finally {
      setSchoolsLoading(false);
    }
  }

  async function fetchAcademicStructure() {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/admin/school-years?limit=100', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      const yearsWithSemesters = await Promise.all(
        (data.data || []).map(async (year: SchoolYear) => {
          const semesterRes = await fetch(`/api/admin/school-years/${year.id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const semesterData = await semesterRes.json();
          return {
            ...year,
            semesters: semesterData.data?.semesters || [],
          };
        })
      );

      setSchoolYears(yearsWithSemesters);
    } catch (error) {
      console.error('Failed to fetch academic structure:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveYear(e: React.FormEvent) {
    e.preventDefault();

    if (!yearFormData.schoolId || !yearFormData.year || !yearFormData.startDate || !yearFormData.endDate) {
      alert('Sekolah, tahun akademik dan tanggal harus diisi!');
      return;
    }

    const startDate = new Date(yearFormData.startDate);
    const endDate = new Date(yearFormData.endDate);

    if (startDate >= endDate) {
      alert('Tanggal mulai harus lebih awal dari tanggal selesai!');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const url = editingYearId
        ? `/api/admin/school-years/${editingYearId}`
        : '/api/admin/school-years';

      // Format dates as ISO datetime: YYYY-MM-DDTHH:MM:SSZ
      const startDateTime = `${yearFormData.startDate}T00:00:00Z`;
      const endDateTime = `${yearFormData.endDate}T00:00:00Z`;

      // Normalize year format: convert "2024-2025" to "2024/2025"
      const normalizedYear = yearFormData.year.trim().replace(/-/g, '/');
      
      const payload = {
        schoolId: yearFormData.schoolId.trim(),
        year: normalizedYear,
        startDate: startDateTime,
        endDate: endDateTime,
        isActive: yearFormData.isActive,
      };

      console.log('Year payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(url, {
        method: editingYearId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log('Year save response:', result);

      if (response.ok) {
        alert(editingYearId ? '✅ Tahun akademik berhasil diperbarui!' : '✅ Tahun akademik berhasil ditambahkan!');
        setShowYearForm(false);
        setEditingYearId(null);
        setYearFormData({
          schoolId: '',
          year: '',
          startDate: '',
          endDate: '',
          isActive: true,
        });
        fetchAcademicStructure();
      } else {
        let errorMsg = result.error || 'Gagal menyimpan tahun akademik';
        if (result.details && Array.isArray(result.details)) {
          errorMsg = result.details.map((d: any) => `${d.message}`).join(', ');
        }
        alert(`❌ ${errorMsg}`);
      }
    } catch (error) {
      console.error('Failed to save year:', error);
      alert('❌ Gagal menyimpan tahun akademik');
    }
  }

  async function handleDeleteYear(id: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus tahun akademik ini?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/school-years/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert('✅ Tahun akademik berhasil dihapus!');
        fetchAcademicStructure();
      } else {
        const result = await response.json();
        alert(`❌ ${result.error || 'Gagal menghapus tahun akademik'}`);
      }
    } catch (error) {
      console.error('Failed to delete year:', error);
      alert('❌ Gagal menghapus tahun akademik');
    }
  }

  async function handleSaveSemester(e: React.FormEvent, schoolYearId: string) {
    e.preventDefault();

    if (!semesterFormData.startDate || !semesterFormData.endDate) {
      alert('Tanggal mulai dan tanggal selesai harus diisi!');
      return;
    }

    const startDate = new Date(semesterFormData.startDate);
    const endDate = new Date(semesterFormData.endDate);

    if (startDate >= endDate) {
      alert('Tanggal mulai harus lebih awal dari tanggal selesai!');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const url = editingSemesterId
        ? `/api/admin/semesters/${editingSemesterId}`
        : '/api/admin/semesters';

      // Format dates as ISO datetime: YYYY-MM-DDTHH:MM:SSZ
      const startDateTime = `${semesterFormData.startDate}T00:00:00Z`;
      const endDateTime = `${semesterFormData.endDate}T00:00:00Z`;

      const payload = {
        schoolYearId,
        number: semesterFormData.number,
        startDate: startDateTime,
        endDate: endDateTime,
        isActive: semesterFormData.isActive,
      };

      const response = await fetch(url, {
        method: editingSemesterId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log('Semester save response:', result);

      if (response.ok) {
        alert(editingSemesterId ? '✅ Semester berhasil diperbarui!' : '✅ Semester berhasil ditambahkan!');
        setShowSemesterForm(null);
        setEditingSemesterId(null);
        setSemesterFormData({
          number: 1,
          startDate: '',
          endDate: '',
          isActive: true,
        });
        fetchAcademicStructure();
      } else {
        let errorMsg = result.error || 'Gagal menyimpan semester';
        if (result.details && Array.isArray(result.details)) {
          errorMsg = result.details.map((d: any) => `${d.field}: ${d.message}`).join('\n');
        }
        alert(`❌ ${errorMsg}`);
      }
    } catch (error) {
      console.error('Failed to save semester:', error);
      alert('❌ Gagal menyimpan semester');
    }
  }

  async function handleDeleteSemester(id: string) {
    if (!confirm('Apakah Anda yakin ingin menghapus semester ini?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/semesters/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert('✅ Semester berhasil dihapus!');
        fetchAcademicStructure();
      } else {
        const result = await response.json();
        alert(`❌ ${result.error || 'Gagal menghapus semester'}`);
      }
    } catch (error) {
      console.error('Failed to delete semester:', error);
      alert('❌ Gagal menghapus semester');
    }
  }

  function handleEditYear(year: SchoolYear) {
    setYearFormData({
      schoolId: year.schoolId,
      year: year.year,
      startDate: year.startDate.split('T')[0],
      endDate: year.endDate.split('T')[0],
      isActive: year.isActive,
    });
    setEditingYearId(year.id);
    setShowYearForm(true);
  }

  function handleEditSemester(semester: Semester) {
    setSemesterFormData({
      number: semester.number,
      startDate: semester.startDate.split('T')[0],
      endDate: semester.endDate.split('T')[0],
      isActive: semester.isActive,
    });
    setEditingSemesterId(semester.id);
    setShowSemesterForm(semester.schoolYearId);
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Struktur Akademik</h1>
          <p className="text-gray-600 text-sm mt-1">Kelola Tahun Ajaran dan Semester</p>
        </div>
        <button
          onClick={() => {
            setEditingYearId(null);
            setYearFormData({
              schoolId: '',
              year: '',
              startDate: '',
              endDate: '',
              isActive: true,
            });
            setShowYearForm(true);
          }}
          className="flex items-center justify-center sm:justify-start gap-2 bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl font-medium whitespace-nowrap"
        >
          <Plus size={20} />
          <span className="hidden xs:hidden sm:inline">Tahun Akademik Baru</span>
          <span className="inline sm:hidden">Tahun Baru</span>
        </button>
      </div>

      {/* Year Form Section */}
      {showYearForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            {editingYearId ? '✏️ Edit Tahun Akademik' : '➕ Tambah Tahun Akademik Baru'}
          </h2>
          <form onSubmit={handleSaveYear} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sekolah <span className="text-red-500">*</span>
                </label>
                {schoolsLoading ? (
                  <div className="w-full px-4 py-3 bg-gray-100 border-2 border-gray-200 rounded-lg text-gray-600">
                    Loading sekolah...
                  </div>
                ) : schools.length === 0 ? (
                  <div className="w-full px-4 py-3 bg-red-50 border-2 border-red-200 rounded-lg text-red-600">
                    Tidak ada sekolah tersedia
                  </div>
                ) : (
                  <select
                    value={yearFormData.schoolId}
                    onChange={(e) => setYearFormData({ ...yearFormData, schoolId: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                    required
                  >
                    <option value="">-- Pilih Sekolah --</option>
                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tahun Akademik <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 2024/2025"
                  value={yearFormData.year}
                  onChange={(e) => setYearFormData({ ...yearFormData, year: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={yearFormData.isActive}
                  onChange={(e) => setYearFormData({ ...yearFormData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-gray-700">Aktif</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tanggal Mulai <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={yearFormData.startDate}
                  onChange={(e) => setYearFormData({ ...yearFormData, startDate: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tanggal Selesai <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={yearFormData.endDate}
                  onChange={(e) => setYearFormData({ ...yearFormData, endDate: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-gray-900 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 focus:outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {editingYearId ? 'Simpan Perubahan' : 'Tambah Tahun Akademik'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowYearForm(false);
                  setEditingYearId(null);
                  setYearFormData({
                    schoolId: '',
                    year: '',
                    startDate: '',
                    endDate: '',
                    isActive: true,
                  });
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 transition-colors font-medium"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* School Years List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Loading...
          </div>
        ) : schoolYears.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Tidak ada tahun akademik ditemukan
          </div>
        ) : (
          schoolYears.map((year) => (
            <div key={year.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Year Header */}
              <div
                className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white cursor-pointer hover:from-slate-800 hover:to-slate-700 transition-all flex justify-between items-center"
                onClick={() =>
                  setExpandedYear(expandedYear === year.id ? null : year.id)
                }
              >
                <div className="flex items-center gap-4">
                  <Calendar size={24} />
                  <div>
                    <h3 className="text-lg font-bold">{year.year}</h3>
                    <p className="text-sm text-slate-300">
                      {formatDate(year.startDate)} - {formatDate(year.endDate)}
                    </p>
                  </div>
                  {year.isActive && (
                    <span className="ml-4 px-3 py-1 bg-green-500 text-white rounded-full text-xs font-medium">
                      Aktif
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditYear(year);
                    }}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit size={20} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteYear(year.id);
                    }}
                    className="p-2 hover:bg-red-600 rounded-lg transition-colors"
                    title="Hapus"
                  >
                    <Trash2 size={20} />
                  </button>
                  {expandedYear === year.id ? (
                    <ChevronUp size={24} />
                  ) : (
                    <ChevronDown size={24} />
                  )}
                </div>
              </div>

              {/* Year Content */}
              {expandedYear === year.id && (
                <div className="p-6 border-t border-gray-200">
                  {/* Semesters Section */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-lg font-bold text-gray-900">Semester</h4>
                      <button
                        onClick={() => {
                          setSemesterFormData({
                            number: 1,
                            startDate: '',
                            endDate: '',
                            isActive: true,
                          });
                          setEditingSemesterId(null);
                          setShowSemesterForm(year.id);
                        }}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        <Plus size={18} />
                        Tambah Semester
                      </button>
                    </div>

                    {/* Semester Form */}
                    {showSemesterForm === year.id && (
                      <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
                        <h5 className="font-bold text-gray-900 mb-4">
                          {editingSemesterId ? '✏️ Edit Semester' : '➕ Tambah Semester Baru'}
                        </h5>
                        <form
                          onSubmit={(e) => handleSaveSemester(e, year.id)}
                          className="space-y-4"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Nomor <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={semesterFormData.number}
                                onChange={(e) =>
                                  setSemesterFormData({
                                    ...semesterFormData,
                                    number: parseInt(e.target.value),
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border-2 border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              >
                                <option value={1}>Semester 1</option>
                                <option value={2}>Semester 2</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Mulai <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="date"
                                value={semesterFormData.startDate}
                                onChange={(e) =>
                                  setSemesterFormData({
                                    ...semesterFormData,
                                    startDate: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border-2 border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Selesai <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="date"
                                value={semesterFormData.endDate}
                                onChange={(e) =>
                                  setSemesterFormData({
                                    ...semesterFormData,
                                    endDate: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border-2 border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required
                              />
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={semesterFormData.isActive}
                                onChange={(e) =>
                                  setSemesterFormData({
                                    ...semesterFormData,
                                    isActive: e.target.checked,
                                  })
                                }
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-sm font-semibold text-gray-700">
                                Aktif
                              </span>
                            </label>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                              {editingSemesterId ? 'Simpan' : 'Tambah'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowSemesterForm(null);
                                setEditingSemesterId(null);
                                setSemesterFormData({
                                  number: 1,
                                  startDate: '',
                                  endDate: '',
                                  isActive: true,
                                });
                              }}
                              className="flex-1 bg-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-400 transition-colors text-sm font-medium"
                            >
                              Batal
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {/* Semesters List */}
                    <div className="space-y-2">
                      {year.semesters.length === 0 ? (
                        <p className="text-gray-500 text-sm italic">Tidak ada semester</p>
                      ) : (
                        year.semesters.map((semester) => (
                          <div
                            key={semester.id}
                            className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex justify-between items-center"
                          >
                            <div>
                              <h5 className="font-bold text-gray-900">
                                Semester {semester.number}
                              </h5>
                              <p className="text-sm text-gray-600">
                                {formatDate(semester.startDate)} - {formatDate(semester.endDate)}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                {semester.isActive && (
                                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                                    Aktif
                                  </span>
                                )}
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                  {semester._count.classes} kelas
                                </span>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditSemester(semester)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit size={18} />
                              </button>
                              <button
                                onClick={() => handleDeleteSemester(semester.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Hapus"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
