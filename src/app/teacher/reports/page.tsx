'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, Eye, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface StudentReport {
  id: string;
  nisn: string;
  name: string;
  className: string;
  semester: string;
  year: string;
  status: 'draft' | 'completed' | 'approved';
  createdDate: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'completed' | 'approved'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const limit = 10;
  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    fetchReports();
  }, [page, search, filterStatus]);

  async function fetchReports() {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
        ...(filterStatus !== 'all' && { status: filterStatus }),
      });

      const response = await fetch(`/api/teacher/reports?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setReports(data.data);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700 border-gray-300',
    completed: 'bg-blue-100 text-blue-700 border-blue-300',
    approved: 'bg-green-100 text-green-700 border-green-300',
  };

  const statusLabels = {
    draft: '📝 Draft',
    completed: '✓ Selesai',
    approved: '✅ Disetujui',
  };

  const handleGenerateReport = async (reportId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/teacher/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ studentId: reportId }),
      });

      if (response.ok) {
        alert('Raport berhasil dibuat! Silahkan download.');
        fetchReports();
      }
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  const handleDownload = (name: string) => {
    alert(`Mengunduh raport: ${name}_Raport.pdf`);
    // Here you would typically trigger a PDF download
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Generate & Kelola Raport</h1>
          <p className="text-gray-600 text-sm mt-1">Buat dan download raport siswa dalam format PDF</p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-600">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Raport</p>
              <div className="text-3xl font-bold text-gray-900 mt-2">{total}</div>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <FileText className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-600">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Disetujui</p>
              <div className="text-3xl font-bold text-gray-900 mt-2">
                {reports.filter((r) => r.status === 'approved').length}
              </div>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <FileText className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-600">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Proses</p>
              <div className="text-3xl font-bold text-gray-900 mt-2">
                {reports.filter((r) => r.status !== 'approved').length}
              </div>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <FileText className="text-orange-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Section */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Cari nama siswa, NISN, atau kelas..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as any);
              setPage(1);
            }}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
          >
            <option value="all">Semua Status</option>
            <option value="draft">Draft</option>
            <option value="completed">Selesai</option>
            <option value="approved">Disetujui</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto mb-4 text-orange-300" size={48} />
            <p className="text-gray-600 font-medium">Belum ada data raport</p>
            <p className="text-gray-500 text-sm mt-1">Mulai dengan membuat raport siswa</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Nama Siswa</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">NISN</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Kelas</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Semester</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Dibuat</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-orange-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{report.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{report.nisn}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold">
                        {report.className}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">Semester {report.semester}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                          statusColors[report.status]
                        }`}
                      >
                        {statusLabels[report.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{report.createdDate}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {report.status === 'draft' && (
                        <button
                          onClick={() => handleGenerateReport(report.id)}
                          className="bg-blue-100 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50 transition-all font-medium text-sm inline-flex items-center gap-1"
                        >
                          <FileText size={16} />
                          Generate
                        </button>
                      )}
                      {report.status !== 'draft' && (
                        <>
                          <button className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition-all font-medium text-sm inline-flex items-center gap-1">
                            <Eye size={16} />
                            Lihat
                          </button>
                          <button
                            onClick={() => handleDownload(report.name)}
                            className="bg-green-100 text-green-700 px-3 py-2 rounded-lg hover:bg-green-50 transition-all font-medium text-sm inline-flex items-center gap-1"
                          >
                            <Download size={16} />
                            Download
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
              <span className="text-sm text-gray-600 font-medium">
                Halaman <span className="text-orange-600 font-bold">{page}</span> dari {totalPages} ({total} total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-medium text-sm"
                >
                  <ChevronLeft size={16} />
                  Sebelumnya
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-medium text-sm"
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
