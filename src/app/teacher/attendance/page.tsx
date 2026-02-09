'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, ChevronLeft, ChevronRight, CheckCircle, Download } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  studentName: string;
  nisn: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  notes?: string;
}

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    studentId: '',
    status: 'PRESENT' as const,
    notes: '',
  });

  const limit = 10;
  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    fetchAttendance();
  }, [page, search, filterDate]);

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
          studentId: formData.studentId,
          date: filterDate,
          status: formData.status,
          notes: formData.notes,
        }),
      });

      if (response.ok) {
        setShowForm(false);
        setFormData({ studentId: '', status: 'PRESENT', notes: '' });
        fetchAttendance();
      }
    } catch (error) {
      console.error('Error saving attendance:', error);
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED') => {
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
    PRESENT: 'bg-green-100 text-green-700 border-green-300',
    ABSENT: 'bg-red-100 text-red-700 border-red-300',
    LATE: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    EXCUSED: 'bg-blue-100 text-blue-700 border-blue-300',
  };

  const statusLabels = {
    PRESENT: '✓ Hadir',
    ABSENT: '❌ Alfa',
    LATE: '⏰ Terlambat',
    EXCUSED: '📝 Izin',
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Cari nama siswa atau NISN..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value);
              setPage(1);
            }}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
          <h2 className="text-xl font-bold text-gray-900 mb-6">➕ Tambah Data Absensi</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Student ID"
                value={formData.studentId}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                required
              />
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              >
                <option value="PRESENT">✓ Hadir</option>
                <option value="ABSENT">❌ Alfa</option>
                <option value="LATE">⏰ Terlambat</option>
                <option value="EXCUSED">📝 Izin</option>
              </select>
            </div>
            <input
              type="text"
              placeholder="Catatan (opsional)"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-lg"
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
                        onChange={(e) => handleStatusChange(record.id, e.target.value as any)}
                        className={`px-3 py-2 rounded-lg font-semibold text-sm border-2 cursor-pointer transition-all ${statusColors[record.status]}`}
                      >
                        <option value="PRESENT">✓ Hadir</option>
                        <option value="ABSENT">❌ Alfa</option>
                        <option value="LATE">⏰ Terlambat</option>
                        <option value="EXCUSED">📝 Izin</option>
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
                  className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-sm"
                >
                  <ChevronLeft size={16} />
                  Sebelumnya
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-sm"
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
