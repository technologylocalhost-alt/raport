'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Target, Plus, X, AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Competency {
  id: string;
  name: string;
  subjectName: string;
  code?: string;
  subjectCode?: string;
  subjectId?: string;
  type?: string;
  description?: string;
}

interface Subject {
  id: string;
  name: string;
  code?: string;
}

interface ApiResponse {
  success: boolean;
  competencies?: Competency[];
  message?: string;
}

export default function CompetenciesPage() {
  const router = useRouter();
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    subjectId: '',
    type: '',
    description: '',
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCompetencies();
    fetchSubjects();
  }, []);

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
        setSubjects(
          data.data.map((subject: any) => ({
            id: subject.id,
            name: subject.name,
            code: subject.code,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to fetch subjects:', error);
    }
  }

  async function fetchCompetencies() {
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('accessToken');

      const response = await fetch('/api/teacher/competencies', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: ApiResponse = await response.json();

      if (data.success && data.competencies) {
        setCompetencies(data.competencies);
      } else {
        setError(data.message || 'Gagal memuat data kompetensi');
      }
    } catch (error) {
      console.error('Failed to fetch competencies:', error);
      setError('Terjadi kesalahan saat memuat data kompetensi');
    } finally {
      setIsLoading(false);
    }
  }

  const filteredCompetencies = competencies.filter((comp) =>
    comp.name.toLowerCase().includes(search.toLowerCase()) ||
    comp.subjectName.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenModal = (competency?: Competency) => {
    setFormError('');
    setFormSuccess('');
    if (competency) {
      setEditingId(competency.id);
      setFormData({
        name: competency.name,
        code: competency.code || '',
        subjectId: competency.subjectId || '',
        type: competency.type || '',
        description: competency.description || '',
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        code: '',
        subjectId: '',
        type: '',
        description: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({ name: '', code: '', subjectId: '', type: '', description: '' });
    setFormError('');
    setFormSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formData.name || !formData.subjectId || !formData.type) {
      setFormError('Nama, Mata Pelajaran, dan Tipe wajib diisi');
      return;
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('accessToken');
      
      const url = editingId 
        ? `/api/teacher/competencies/${editingId}` 
        : '/api/teacher/competencies/create';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code || null,
          subjectId: formData.subjectId,
          type: formData.type,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setFormSuccess(editingId ? 'Kompetensi berhasil diperbarui' : 'Kompetensi berhasil ditambahkan');
        setTimeout(() => {
          handleCloseModal();
          fetchCompetencies();
        }, 1500);
      } else {
        setFormError(data.message || 'Gagal menyimpan kompetensi');
      }
    } catch (error) {
      console.error('Error saving competency:', error);
      setFormError('Terjadi kesalahan saat menyimpan kompetensi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus kompetensi ini?')) return;

    try {
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`/api/teacher/competencies/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        fetchCompetencies();
      } else {
        setError(data.message || 'Gagal menghapus kompetensi');
      }
    } catch (error) {
      console.error('Error deleting competency:', error);
      setError('Terjadi kesalahan saat menghapus kompetensi');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kompetensi</h1>
          <p className="text-gray-600 text-sm mt-1">Kelola kompetensi dan capaian pembelajaran siswa</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Competencies Table */}
        <div className={editingId || showModal ? 'lg:col-span-2' : 'lg:col-span-3'}>
          {/* Search Bar */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex items-center justify-between gap-4">
              <input
                type="text"
                placeholder="Cari kompetensi atau mata pelajaran..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              />
              <button 
                onClick={() => {
                  setEditingId(null);
                  setShowModal(true);
                  setFormData({ name: '', code: '', subjectId: '', type: '', description: '' });
                  setFormError('');
                  setFormSuccess('');
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 whitespace-nowrap text-sm"
              >
                <Plus size={18} />
                Tambah
              </button>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center min-h-96">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">Memuat kompetensi...</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && filteredCompetencies.length === 0 && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="bg-red-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Target className="text-red-600" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Kompetensi</h3>
              <p className="text-gray-600">
                {search ? 'Tidak ada kompetensi yang sesuai dengan pencarian Anda.' : 'Belum ada kompetensi untuk mata pelajaran yang Anda ajar.'}
              </p>
            </div>
          )}

          {/* Competencies Table */}
          {!isLoading && filteredCompetencies.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  {/* Table Head */}
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        No.
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Nama Kompetensi
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Kode
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Mata Pelajaran
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  {/* Table Body */}
                  <tbody className="divide-y divide-gray-200">
                    {filteredCompetencies.map((comp, index) => (
                      <tr key={comp.id} className={`hover:bg-gray-50 transition-colors ${editingId === comp.id ? 'bg-red-50' : ''}`}>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">{index + 1}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">{comp.name}</td>
                        <td className="px-6 py-4 text-sm">
                          {comp.code ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {comp.code}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {comp.subjectName}
                          {comp.subjectCode && <span className="text-gray-400 ml-1">({comp.subjectCode})</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-center space-y-2">
                          <div className="flex gap-2 justify-center flex-wrap">
                            <button
                              onClick={() => {
                                setEditingId(comp.id);
                                setFormData({
                                  name: comp.name,
                                  code: comp.code || '',
                                  subjectId: comp.subjectId || '',
                                  type: comp.type || '',
                                  description: comp.description || '',
                                });
                                setShowModal(true);
                                setFormError('');
                                setFormSuccess('');
                              }}
                              className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(comp.id)}
                              className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors whitespace-nowrap"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Summary */}
          {!isLoading && filteredCompetencies.length > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between mt-6">
              <span className="font-medium">Total Kompetensi: <strong>{filteredCompetencies.length}</strong></span>
            </div>
          )}
        </div>

        {/* Right Column - Form */}
        {showModal && (
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow sticky top-6">
              {/* Form Header */}
              <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">
                  {editingId ? 'Edit Kompetensi' : 'Tambah Kompetensi'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-white hover:bg-red-800 p-1 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Error Alert */}
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-3">
                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{formError}</span>
                  </div>
                )}

                {/* Success Alert */}
                {formSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-start gap-3">
                    <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{formSuccess}</span>
                  </div>
                )}

                {/* Nama Kompetensi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nama Kompetensi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Masukkan nama kompetensi"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm bg-white text-gray-900"
                  />
                </div>

                {/* Kode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kode
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Masukkan kode (opsional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm bg-white text-gray-900"
                  />
                </div>

                {/* Tipe Kompetensi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipe Kompetensi <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm bg-white text-gray-900"
                  >
                    <option value="">Pilih tipe kompetensi</option>
                    <option value="KNOWLEDGE">Pengetahuan (KI-3)</option>
                    <option value="SKILL">Keterampilan (KI-4)</option>
                    <option value="ATTITUDE">Sikap (KI-1, KI-2)</option>
                  </select>
                </div>

                {/* Mata Pelajaran */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mata Pelajaran <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.subjectId}
                    onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm bg-white text-gray-900"
                  >
                    <option value="">Pilih mata pelajaran</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name} {subject.code && `(${subject.code})`}
                      </option>
                    ))}
                  </select>
                </div>



                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={isSubmitting}
                    className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm disabled:bg-gray-100"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium text-sm disabled:bg-gray-400"
                  >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
