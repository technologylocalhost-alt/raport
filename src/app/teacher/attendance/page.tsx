'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, ChevronLeft, ChevronRight, CheckCircle, Download } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  studentName: string;
  nisn: string;
  date: string;
  status: 'HADIR' | 'ALFA' | 'SAKIT' | 'IZIN';
  notes?: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Student {
  id: string;
  name: string;
  nisn: string;
}

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  
  // New states for subjects and students
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  const [formData, setFormData] = useState({
    subjectId: '',
    studentId: '',
    status: 'HADIR' as 'HADIR' | 'ALFA' | 'SAKIT' | 'IZIN',
    notes: '',
  });

  const limit = 10;
  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    fetchAttendance();
    fetchSubjects();
  }, [page, search, filterDate]);

  async function fetchSubjects() {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/teacher/subjects', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success && data.data) {
        setSubjects(data.data);
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  }

  async function fetchStudentsBySubject(subjectId: string) {
    if (!subjectId) {
      setStudents([]);
      return;
    }

    try {
      setLoadingStudents(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/teacher/subjects/${subjectId}/students`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success && data.data) {
        setStudents(data.data);
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }

  async function fetchAttendance() {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
        ...(filterDate && { date: filterDate }),
      });

      const response = await fetch(`/api/teacher/attendance?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setAttendance(data.data);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/teacher/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subjectId: formData.subjectId,
          studentId: formData.studentId,
          date: filterDate,
          status: formData.status,
          notes: formData.notes,
        }),
      });

      if (response.ok) {
        setShowForm(false);
        setFormData({ subjectId: '', studentId: '', status: 'HADIR', notes: '' });
        setStudents([]);
        fetchAttendance();
      }
    } catch (error) {
      console.error('Error saving attendance:', error);
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'HADIR' | 'ALFA' | 'SAKIT' | 'IZIN') => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/teacher/attendance/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchAttendance();
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
    }
  };

  const statusColors = {
    HADIR: 'bg-green-100 text-green-700 border-green-300',
    ALFA: 'bg-red-100 text-red-700 border-red-300',
    SAKIT: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    IZIN: 'bg-blue-100 text-blue-700 border-blue-300',
  };

  const statusLabels = {
    HADIR: '✓ Hadir',
    ALFA: '❌ Alfa',
    SAKIT: '🤒 Sakit',
    IZIN: '📝 Izin',
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kelola Absensi</h1>
          <p className="text-gray-600 text-sm mt-1">Catat kehadiran siswa setiap hari</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors shadow-lg hover:shadow-xl font-medium"
        >
          <Plus size={20} />
          Tambah Absensi
        </button>
      </div>

      {/* Filter & Search Section */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🔍 Filter & Pencarian</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Cari Nama Siswa / NISN</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Ketik nama atau NISN..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900"
            />
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
          <h2 className="text-xl font-bold text-gray-900 mb-6">➕ Tambah Data Absensi</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mata Pelajaran <span className="text-red-500">*</span></label>
                <select
                  value={formData.subjectId}
                  onChange={(e) => {
                    const newSubjectId = e.target.value;
                    setFormData({ ...formData, subjectId: newSubjectId, studentId: '' });
                    if (newSubjectId) {
                      fetchStudentsBySubject(newSubjectId);
                    } else {
                      setStudents([]);
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900"
                  required
                >
                  <option value="">-- Pilih Mata Pelajaran --</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Siswa <span className="text-red-500">*</span>
                  {loadingStudents && <span className="text-xs text-gray-500"> (memuat...)</span>}
                </label>
                <select
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required
                  disabled={!formData.subjectId || loadingStudents}
                >
                  <option value="">
                    {!formData.subjectId ? '-- Pilih mata pelajaran terlebih dahulu --' : 'Pilih Siswa --'}
                  </option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.nisn})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Status <span className="text-red-500">*</span></label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'HADIR' | 'ALFA' | 'SAKIT' | 'IZIN' })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900"
                >
                  <option value="HADIR">✓ Hadir</option>
                  <option value="ALFA">❌ Alfa</option>
                  <option value="SAKIT">🤒 Sakit</option>
                  <option value="IZIN">📝 Izin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Catatan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Tambahkan catatan jika diperlukan"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={!formData.subjectId || !formData.studentId}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Export Button */}
      <div className="flex justify-end">
        <button className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium">
          <Download size={20} />
          Export Excel
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        ) : attendance.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="mx-auto mb-4 text-green-300" size={48} />
            <p className="text-gray-600 font-medium">Belum ada data absensi untuk tanggal ini</p>
            <p className="text-gray-500 text-sm mt-1">Mulai dengan menambah absensi siswa</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Nama Siswa</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">NISN</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {attendance.map((record) => (
                  <tr key={record.id} className="hover:bg-green-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{record.studentName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{record.nisn}</td>
                    <td className="px-6 py-4 text-sm">
                      <select
                        value={record.status}
                        onChange={(e) => handleStatusChange(record.id, e.target.value as 'HADIR' | 'ALFA' | 'SAKIT' | 'IZIN')}
                        className={`px-3 py-2 rounded-lg font-semibold text-sm border-2 cursor-pointer transition-all ${statusColors[record.status]}`}
                      >
                        <option value="HADIR">✓ Hadir</option>
                        <option value="ALFA">❌ Alfa</option>
                        <option value="SAKIT">🤒 Sakit</option>
                        <option value="IZIN">📝 Izin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{record.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
              <span className="text-sm text-gray-600 font-medium">
                Halaman <span className="text-green-600 font-bold">{page}</span> dari {totalPages} ({total} total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-medium text-sm"
                >
                  <ChevronLeft size={16} />
                  Sebelumnya
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-medium text-sm"
                >
                  Selanjutnya
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
