'use client';

import { useEffect, useState, FormEvent } from 'react';
import { Plus, Trash2, X, AlertCircle, CheckCircle, ArrowLeft, BookOpen, Users } from 'lucide-react';

interface Class {
  id: string;
  name: string;
  levelId: string;
  levelName?: string;
  capacity: number;
}

interface ClassSubject {
  id: string;
  subject: {
    id: string;
    code: string;
    name: string;
    nameArabic?: string;
    description?: string;
    creditHours?: number;
  };
}

interface ClassTeacher {
  id: string;
  teacher: {
    id: string;
    name: string;
    email: string;
  };
  subject: {
    id: string;
    code: string;
    name: string;
  };
}

interface Teacher {
  id: string;
  name: string;
  email: string;
}

interface Subject {
  id: string;
  code: string;
  name: string;
  nameArabic?: string;
  description?: string;
  creditHours?: number;
}

interface SubjectFormData {
  subjectId: string;
}

interface TeacherFormData {
  teacherId: string;
  subjectId: string;
}

type TabType = 'subjects' | 'teachers';

export default function WaliKelasClassManagementPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [classTeachers, setClassTeachers] = useState<ClassTeacher[]>([]);
  const [allTeachers, setTeachers] = useState<Teacher[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedClassName, setSelectedClassName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('subjects');
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [showTeacherForm, setShowTeacherForm] = useState(false);
  const [subjectFormData, setSubjectFormData] = useState<SubjectFormData>({ subjectId: '' });
  const [teacherFormData, setTeacherFormData] = useState<TeacherFormData>({ teacherId: '', subjectId: '' });
  const [subjectCurrentPage, setSubjectCurrentPage] = useState(1);
  const [teacherCurrentPage, setTeacherCurrentPage] = useState(1);
  const [subjectSearchText, setSubjectSearchText] = useState('');
  const [teacherSearchText, setTeacherSearchText] = useState('');
  const [subjectSearchTeacherText, setSubjectSearchTeacherText] = useState('');
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      const parsedUser = JSON.parse(user);
      fetchClasses(parsedUser.id);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchClassSubjects();
      fetchClassTeachers();
    }
  }, [selectedClassId]);

  async function fetchClasses(waliKelasId: string) {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await fetch(`/api/admin/classes?limit=100&waliKelasId=${waliKelasId}`, { headers });
      const data = await response.json();

      if (response.ok) {
        // Transform classes to extract nested object values
        const transformedClasses = (data.data || []).map((c: any) => ({
          ...c,
          levelName: c.level?.name || '-',
        }));
        setClasses(transformedClasses);
      } else {
        setErrorMessage('Gagal memuat daftar kelas');
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      setErrorMessage('Gagal memuat daftar kelas');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchClassSubjects() {
    if (!selectedClassId) return;
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      const response = await fetch(`/api/admin/classes/${selectedClassId}/subjects`, { headers });
      const data = await response.json();
      if (response.ok) {
        setClassSubjects(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  }

  async function fetchClassTeachers() {
    if (!selectedClassId) return;
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      const response = await fetch(`/api/admin/classes/${selectedClassId}/teachers`, { headers });
      const data = await response.json();
      if (response.ok) {
        setClassTeachers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  }

  async function fetchAllSubjects() {
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      const response = await fetch(`/api/admin/subjects?limit=100`, { headers });
      const data = await response.json();
      if (response.ok) {
        setAllSubjects(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  }

  async function fetchAllTeachers() {
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { Authorization: `Bearer ${token}` };
      const response = await fetch(`/api/admin/users?limit=100`, { headers });
      const data = await response.json();
      if (response.ok) {
        setTeachers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  }

  async function handleAddSubject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!subjectFormData.subjectId) {
      setErrorMessage('Pilih mata pelajaran');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(`/api/admin/classes/${selectedClassId}/subjects`, {
        method: 'POST',
        headers,
        body: JSON.stringify(subjectFormData),
      });

      if (response.ok) {
        setSuccessMessage('Mata pelajaran berhasil ditambahkan');
        setShowSubjectForm(false);
        setSubjectFormData({ subjectId: '' });
        setSubjectSearchText('');
        setShowSubjectDropdown(false);
        fetchClassSubjects();
      } else {
        const error = await response.json();
        setErrorMessage(error.error || 'Terjadi kesalahan');
      }
    } catch (error) {
      console.error('Error:', error);
      setErrorMessage('Terjadi kesalahan');
    }
  }

  async function handleAddTeacher(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!teacherFormData.teacherId || !teacherFormData.subjectId) {
      setErrorMessage('Pilih guru dan mata pelajaran');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(`/api/admin/classes/${selectedClassId}/teachers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(teacherFormData),
      });

      if (response.ok) {
        setSuccessMessage('Guru berhasil ditambahkan');
        setShowTeacherForm(false);
        setTeacherFormData({ teacherId: '', subjectId: '' });
        fetchClassTeachers();
      } else {
        const error = await response.json();
        setErrorMessage(error.error || 'Terjadi kesalahan');
      }
    } catch (error) {
      console.error('Error:', error);
      setErrorMessage('Terjadi kesalahan');
    }
  }

  async function handleDeleteSubject(subjectId: string) {
    if (!confirm('Hapus mata pelajaran?')) return;
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/classes/${selectedClassId}/subjects/${subjectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        setSuccessMessage('Mata pelajaran berhasil dihapus');
        fetchClassSubjects();
      } else {
        setErrorMessage('Gagal menghapus');
      }
    } catch (error) {
      setErrorMessage('Terjadi kesalahan');
    }
  }

  async function handleDeleteTeacher(teacherId: string) {
    if (!confirm('Hapus guru?')) return;
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/classes/${selectedClassId}/teachers/${teacherId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        setSuccessMessage('Guru berhasil dihapus');
        fetchClassTeachers();
      } else {
        setErrorMessage('Gagal menghapus');
      }
    } catch (error) {
      setErrorMessage('Terjadi kesalahan');
    }
  }

  // View: Classes List
  if (!selectedClassId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manajemen Kelas</h1>
          <p className="text-gray-600 mt-1">Kelola mata pelajaran dan guru untuk setiap kelas</p>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle size={20} />
            {errorMessage}
            <button onClick={() => setErrorMessage('')} className="ml-auto">
              <X size={18} />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Memuat data kelas...</p>
          </div>
        ) : classes.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="text-yellow-800">Anda belum ditugaskan sebagai Wali Kelas.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-lg shadow-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nama Kelas</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tingkat</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Kapasitas</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((classItem) => (
                    <tr key={classItem.id} className="border-b hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{classItem.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{classItem.levelName}</td>
                      <td className="px-6 py-4 text-center text-sm text-gray-700">{classItem.capacity} siswa</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedClassId(classItem.id);
                            setSelectedClassName(classItem.name);
                            setActiveTab('subjects');
                            fetchAllSubjects();
                          }}
                          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-medium transition-colors"
                        >
                          Kelola
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-4">
              {classes.map((classItem) => (
                <div key={classItem.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                  <div className="mb-4">
                    <p className="font-bold text-lg text-gray-900">{classItem.name}</p>
                    <p className="text-sm text-gray-600 mt-1">{classItem.levelName}</p>
                  </div>
                  
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">Kapasitas:</span> {classItem.capacity} siswa
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedClassId(classItem.id);
                      setSelectedClassName(classItem.name);
                      setActiveTab('subjects');
                      fetchAllSubjects();
                    }}
                    className="w-full bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-medium transition-colors"
                  >
                    Kelola Kelas
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // View: Management
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              setSelectedClassId(null);
              setSelectedClassName('');
              setShowSubjectForm(false);
              setShowTeacherForm(false);
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div className="flex-1 sm:flex-initial">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
              Manajemen Kelas - {selectedClassName}
            </h1>
            <p className="text-gray-600 mt-1 text-xs sm:text-base">Kelola mata pelajaran dan guru pengajar</p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={20} />
          {successMessage}
          <button onClick={() => setSuccessMessage('')} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {errorMessage}
          <button onClick={() => setErrorMessage('')} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-t-lg border-b overflow-x-auto">
        <div className="flex gap-4 sm:gap-8 px-4 sm:px-6 min-w-min">
          <button
            onClick={() => {
              setActiveTab('subjects');
              if (!allSubjects.length) fetchAllSubjects();
            }}
            className={`py-4 font-semibold flex items-center gap-2 transition-colors text-sm sm:text-base whitespace-nowrap ${
              activeTab === 'subjects'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BookOpen size={20} />
            <span>Mata Pelajaran ({classSubjects.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('teachers');
              if (!allTeachers.length) fetchAllTeachers();
            }}
            className={`py-4 font-semibold flex items-center gap-2 transition-colors text-sm sm:text-base whitespace-nowrap ${
              activeTab === 'teachers'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users size={20} />
            <span>Guru Pengajar ({classTeachers.length})</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-b-lg p-4 sm:p-6">
        {/* Subjects Tab */}
        {activeTab === 'subjects' && (
          <div className="space-y-6">
            {!showSubjectForm && (
              <button
                onClick={() => {
                  setShowSubjectForm(true);
                  setSubjectFormData({ subjectId: '' });
                }}
                className="w-full sm:w-auto bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 transition-colors text-sm sm:text-base"
              >
                <Plus size={20} /> <span className="hidden sm:inline">Tambah Mata Pelajaran</span><span className="sm:hidden">Tambah</span>
              </button>
            )}

            {showSubjectForm && (
              <div className="bg-emerald-50 rounded-lg p-4 sm:p-6 border-l-4 border-emerald-600">
                <h3 className="text-lg font-semibold mb-4">Tambah Mata Pelajaran</h3>
                <form onSubmit={handleAddSubject} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Cari Mata Pelajaran <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Cari kode atau nama mata pelajaran..."
                        value={subjectSearchText}
                        onChange={(e) => {
                          setSubjectSearchText(e.target.value);
                          setShowSubjectDropdown(true);
                        }}
                        onFocus={() => setShowSubjectDropdown(true)}
                        className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:border-emerald-500"
                      />
                      {showSubjectDropdown && subjectSearchText && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-emerald-500 rounded-lg shadow-lg max-h-96 overflow-y-auto z-10">
                          {allSubjects
                            .filter((subject) =>
                              subject.code.toLowerCase().includes(subjectSearchText.toLowerCase()) ||
                              subject.name.toLowerCase().includes(subjectSearchText.toLowerCase())
                            )
                            .length === 0 ? (
                            <div className="px-4 py-3 text-gray-500">Tidak ada mata pelajaran ditemukan</div>
                          ) : (
                            allSubjects
                              .filter((subject) =>
                                subject.code.toLowerCase().includes(subjectSearchText.toLowerCase()) ||
                                subject.name.toLowerCase().includes(subjectSearchText.toLowerCase())
                              )
                              .map((subject) => (
                                <button
                                  key={subject.id}
                                  type="button"
                                  onClick={() => {
                                    setSubjectFormData({ subjectId: subject.id });
                                    setSubjectSearchText(`${subject.code} - ${subject.name}`);
                                    setShowSubjectDropdown(false);
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors border-b last:border-b-0"
                                >
                                  <div className="font-semibold text-gray-900">{subject.code} - {subject.name}</div>
                                  {subject.nameArabic && <div className="text-sm text-gray-600">{subject.nameArabic}</div>}
                                </button>
                              ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="submit"
                      disabled={!subjectFormData.subjectId}
                      className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Tambahkan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSubjectForm(false);
                        setSubjectSearchText('');
                        setShowSubjectDropdown(false);
                        setSubjectFormData({ subjectId: '' });
                      }}
                      className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Subjects Table - Desktop */}
            <div className="hidden md:block overflow-hidden border rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Kode</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nama</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-emerald-700 bg-emerald-50">Mata Pelajaran Arab</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Deskripsi</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {classSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        Belum ada mata pelajaran
                      </td>
                    </tr>
                  ) : (
                    classSubjects.slice((subjectCurrentPage - 1) * itemsPerPage, subjectCurrentPage * itemsPerPage).map((cs) => (
                      <tr key={cs.id} className="border-b hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{cs.subject.code}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{cs.subject.name}</td>
                        <td className="px-6 py-4 text-center text-sm font-semibold text-emerald-700 bg-emerald-50">
                          {cs.subject.nameArabic || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                          {cs.subject.description || '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleDeleteSubject(cs.subject.id)}
                            className="text-red-600 hover:text-red-900 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Subjects Cards - Mobile */}
            <div className="md:hidden space-y-4">
              {classSubjects.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Belum ada mata pelajaran
                </div>
              ) : (
                classSubjects.slice((subjectCurrentPage - 1) * itemsPerPage, subjectCurrentPage * itemsPerPage).map((cs) => (
                  <div key={cs.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-bold text-lg text-gray-900">{cs.subject.code} - {cs.subject.name}</p>
                        {cs.subject.nameArabic && (
                          <p className="text-sm text-emerald-700 font-semibold mt-1">Arab: {cs.subject.nameArabic}</p>
                        )}
                      </div>
                    </div>
                    
                    {cs.subject.description && (
                      <div className="mb-3 pb-3 border-b border-gray-200">
                        <p className="text-sm text-gray-600">{cs.subject.description}</p>
                      </div>
                    )}

                    <button
                      onClick={() => handleDeleteSubject(cs.subject.id)}
                      className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} /> Hapus
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Subjects Pagination */}
            {classSubjects.length > itemsPerPage && (
              <div className="flex items-center justify-between mt-6 px-2 bg-gray-50 py-4 rounded-lg">
                <div className="text-sm font-medium text-gray-700">
                  Menampilkan {(subjectCurrentPage - 1) * itemsPerPage + 1} - {Math.min(subjectCurrentPage * itemsPerPage, classSubjects.length)} dari {classSubjects.length} mata pelajaran
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSubjectCurrentPage(Math.max(1, subjectCurrentPage - 1))}
                    disabled={subjectCurrentPage === 1}
                    className="px-4 py-3 bg-emerald-600 text-white border-2 border-emerald-600 font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:border-gray-300 disabled:cursor-not-allowed"
                  >
                    ← Sebelumnya
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.ceil(classSubjects.length / itemsPerPage) }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setSubjectCurrentPage(page)}
                        className={`px-3 py-2 rounded-lg font-semibold transition-colors ${
                          page === subjectCurrentPage
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'border-2 border-gray-300 text-gray-700 hover:border-emerald-600 hover:text-emerald-600'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setSubjectCurrentPage(Math.min(Math.ceil(classSubjects.length / itemsPerPage), subjectCurrentPage + 1))}
                    disabled={subjectCurrentPage === Math.ceil(classSubjects.length / itemsPerPage)}
                    className="px-4 py-3 bg-emerald-600 text-white border-2 border-emerald-600 font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:border-gray-300 disabled:cursor-not-allowed"
                  >
                    Selanjutnya →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Teachers Tab */}
        {activeTab === 'teachers' && (
          <div className="space-y-6">
            {!showTeacherForm && (
              <button
                onClick={() => {
                  setShowTeacherForm(true);
                  setTeacherFormData({ teacherId: '', subjectId: '' });
                  setTeacherSearchText('');
                  setSubjectSearchTeacherText('');
                  if (!allTeachers.length) fetchAllTeachers();
                }}
                className="w-full sm:w-auto bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2 transition-colors text-sm sm:text-base"
              >
                <Plus size={20} /> <span className="hidden sm:inline">Tambah Guru</span><span className="sm:hidden">Tambah</span>
              </button>
            )}

            {showTeacherForm && (
              <div className="bg-emerald-50 rounded-lg p-4 sm:p-6 border-l-4 border-emerald-600">
                <h3 className="text-lg font-semibold mb-4">Tambah Guru Pengajar</h3>
                <form onSubmit={handleAddTeacher} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        Cari Guru <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Cari nama guru..."
                          value={teacherSearchText}
                          onChange={(e) => setTeacherSearchText(e.target.value)}
                          className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:border-emerald-500"
                        />
                        {teacherSearchText && !teacherFormData.teacherId && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-emerald-500 rounded-lg shadow-lg max-h-64 overflow-y-auto z-10">
                            {allTeachers
                              .filter((teacher) =>
                                teacher.name.toLowerCase().includes(teacherSearchText.toLowerCase()) ||
                                teacher.email.toLowerCase().includes(teacherSearchText.toLowerCase())
                              )
                              .filter((teacher, index, self) =>
                                index === self.findIndex((t) => t.id === teacher.id)
                              )
                              .length === 0 ? (
                              <div className="px-4 py-3 text-gray-500">Tidak ada guru ditemukan</div>
                            ) : (
                              allTeachers
                                .filter((teacher) =>
                                  teacher.name.toLowerCase().includes(teacherSearchText.toLowerCase()) ||
                                  teacher.email.toLowerCase().includes(teacherSearchText.toLowerCase())
                                )
                                .filter((teacher, index, self) =>
                                  index === self.findIndex((t) => t.id === teacher.id)
                                )
                                .map((teacher) => (
                                  <button
                                    key={teacher.id}
                                    type="button"
                                    onClick={() => {
                                      setTeacherFormData({ ...teacherFormData, teacherId: teacher.id });
                                      setTeacherSearchText(teacher.name);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors border-b last:border-b-0"
                                  >
                                    <div className="font-semibold text-gray-900">{teacher.name}</div>
                                    <div className="text-sm text-gray-600">{teacher.email}</div>
                                  </button>
                                ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        Cari Mata Pelajaran <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Cari kode atau nama mata pelajaran..."
                          value={subjectSearchTeacherText}
                          onChange={(e) => setSubjectSearchTeacherText(e.target.value)}
                          className="w-full px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:border-emerald-500"
                        />
                        {subjectSearchTeacherText && !teacherFormData.subjectId && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-emerald-500 rounded-lg shadow-lg max-h-64 overflow-y-auto z-10">
                            {classSubjects
                              .filter((cs) =>
                                cs.subject.code.toLowerCase().includes(subjectSearchTeacherText.toLowerCase()) ||
                                cs.subject.name.toLowerCase().includes(subjectSearchTeacherText.toLowerCase())
                              )
                              .length === 0 ? (
                              <div className="px-4 py-3 text-gray-500">Tidak ada mata pelajaran ditemukan</div>
                            ) : (
                              classSubjects
                                .filter((cs) =>
                                  cs.subject.code.toLowerCase().includes(subjectSearchTeacherText.toLowerCase()) ||
                                  cs.subject.name.toLowerCase().includes(subjectSearchTeacherText.toLowerCase())
                                )
                                .map((cs) => (
                                  <button
                                    key={cs.subject.id}
                                    type="button"
                                    onClick={() => {
                                      setTeacherFormData({ ...teacherFormData, subjectId: cs.subject.id });
                                      setSubjectSearchTeacherText(`${cs.subject.code} - ${cs.subject.name}`);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors border-b last:border-b-0"
                                  >
                                    <div className="font-semibold text-gray-900">{cs.subject.code} - {cs.subject.name}</div>
                                  </button>
                                ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="submit"
                      disabled={!teacherFormData.teacherId || !teacherFormData.subjectId}
                      className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Tambahkan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTeacherForm(false);
                        setTeacherSearchText('');
                        setSubjectSearchTeacherText('');
                        setTeacherFormData({ teacherId: '', subjectId: '' });
                      }}
                      className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Teachers Table - Desktop */}
            <div className="hidden md:block overflow-hidden border rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nama Guru</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Mata Pelajaran</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {classTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        Belum ada guru
                      </td>
                    </tr>
                  ) : (
                    classTeachers.slice((teacherCurrentPage - 1) * itemsPerPage, teacherCurrentPage * itemsPerPage).map((ct) => (
                      <tr key={ct.id} className="border-b hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{ct.teacher.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{ct.teacher.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {ct.subject.code} - {ct.subject.name}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleDeleteTeacher(ct.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Teachers Cards - Mobile */}
            <div className="md:hidden space-y-4">
              {classTeachers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Belum ada guru
                </div>
              ) : (
                classTeachers.slice((teacherCurrentPage - 1) * itemsPerPage, teacherCurrentPage * itemsPerPage).map((ct) => (
                  <div key={ct.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                    <div className="mb-3">
                      <p className="font-bold text-lg text-gray-900">{ct.teacher.name}</p>
                      <p className="text-sm text-gray-600 mt-1">{ct.teacher.email}</p>
                    </div>

                    <div className="mb-3 pb-3 border-b border-gray-200">
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold text-gray-900">Mata Pelajaran:</span> {ct.subject.code} - {ct.subject.name}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteTeacher(ct.id)}
                      className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} /> Hapus
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Teachers Pagination */}
            {classTeachers.length > itemsPerPage && (
              <div className="flex items-center justify-between mt-6 px-2 bg-gray-50 py-4 rounded-lg">
                <div className="text-sm font-medium text-gray-700">
                  Menampilkan {(teacherCurrentPage - 1) * itemsPerPage + 1} - {Math.min(teacherCurrentPage * itemsPerPage, classTeachers.length)} dari {classTeachers.length} guru
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTeacherCurrentPage(Math.max(1, teacherCurrentPage - 1))}
                    disabled={teacherCurrentPage === 1}
                    className="px-4 py-3 bg-emerald-600 text-white border-2 border-emerald-600 font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:border-gray-300 disabled:cursor-not-allowed"
                  >
                    ← Sebelumnya
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.ceil(classTeachers.length / itemsPerPage) }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setTeacherCurrentPage(page)}
                        className={`px-3 py-2 rounded-lg font-semibold transition-colors ${
                          page === teacherCurrentPage
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'border-2 border-gray-300 text-gray-700 hover:border-emerald-600 hover:text-emerald-600'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setTeacherCurrentPage(Math.min(Math.ceil(classTeachers.length / itemsPerPage), teacherCurrentPage + 1))}
                    disabled={teacherCurrentPage === Math.ceil(classTeachers.length / itemsPerPage)}
                    className="px-4 py-3 bg-emerald-600 text-white border-2 border-emerald-600 font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:border-gray-300 disabled:cursor-not-allowed"
                  >
                    Selanjutnya →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
