'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Search, ChevronLeft, ChevronRight, Users, Download, Eye } from 'lucide-react';

interface Santri {
  id: string;
  [key: string]: any;
}

interface PaginatedResponse {
  success: boolean;
  data: Santri[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function SantriPage() {
  const router = useRouter();
  const [santriList, setSantriList] = useState<Santri[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isImporting, setIsImporting] = useState(false);

  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchSantri = useCallback(async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(), limit: limit.toString(),
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/santri?${queryParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: PaginatedResponse = await response.json();
      setSantriList(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to fetch santri:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchSantri(); }, [fetchSantri]);

  const handleImportFromStudents = async () => {
    if (!confirm('Import data dari tabel Student ke Santri?\nData yang sudah ada (berdasarkan No Stambuk) akan di-skip.')) return;
    try {
      setIsImporting(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/admin/santri/import-from-students', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) { alert(data.message || 'Gagal import data'); return; }
      alert(`Import selesai!\n- Berhasil diimport: ${data.data.imported} santri\n- Sudah ada (di-skip): ${data.data.skipped} santri`);
      fetchSantri();
    } catch (error) {
      console.error('Error importing:', error);
      alert('Terjadi kesalahan saat import');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus data santri ini?')) return;
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/admin/santri/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) { alert('Gagal menghapus data santri'); return; }
      fetchSantri();
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Terjadi kesalahan');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Master Data Santri</h1>
          <p className="text-gray-600 mt-2">Total: {total} santri</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleImportFromStudents} disabled={isImporting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors font-medium disabled:opacity-50 text-sm">
            <Download size={18} />
            {isImporting ? 'Importing...' : 'Import dari Student'}
          </button>
          <button onClick={() => router.push('/admin/santri/tambah')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors font-medium text-sm">
            <Plus size={18} />
            Tambah Santri
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input type="text" placeholder="Cari nama, no stambuk, atau NISN..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 font-medium placeholder-gray-500 bg-white" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Memuat data santri...</p>
            </div>
          </div>
        ) : santriList.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Users size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Tidak ada data santri</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">No</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">No Stambuk</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">NISN</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Nama Santri</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">L/P</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tempat/Tgl Lahir</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Telepon</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Asal Sekolah</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {santriList.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/santri/${s.id}`)}>
                      <td className="px-4 py-3 text-sm text-gray-900">{(page - 1) * limit + idx + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.studentNo}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{s.nisn || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          s.gender === 'MALE' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                        }`}>
                          {s.gender === 'MALE' ? 'L' : 'P'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {s.birthPlace ? `${s.birthPlace}, ` : ''}{formatDate(s.birthDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{s.phone || s.parentPhoneNo || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{s.asalSekolah || '-'}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => router.push(`/admin/santri/${s.id}`)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors text-xs">
                            <Eye size={14} /> Detail
                          </button>
                          <button onClick={() => router.push(`/admin/santri/${s.id}/edit`)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors text-xs">
                            <Edit size={14} /> Edit
                          </button>
                          <button onClick={() => handleDelete(s.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors text-xs">
                            <Trash2 size={14} /> Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm font-medium text-gray-700">
                Halaman {page} dari {totalPages} &bull; {(page - 1) * limit + 1}-{Math.min(page * limit, total)} dari {total}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft size={18} className="text-gray-700" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <button key={pageNum} onClick={() => setPage(pageNum)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          page === pageNum ? 'bg-emerald-600 text-white' : 'border border-gray-300 hover:bg-gray-100 text-gray-700'
                        }`}>
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages || totalPages === 0}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight size={18} className="text-gray-700" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
