'use client';

import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface SubjectApproval {
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  totalStudents: number;
  gradesCount: number;
  teachersCount: number;
  teachers: string[];
  isComplete: boolean;
  gradesSample?: any[];
}

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ApprovalModal({ isOpen, onClose, onSuccess }: ApprovalModalProps) {
  const [subjects, setSubjects] = useState<SubjectApproval[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<SubjectApproval | null>(null);
  const [formData, setFormData] = useState({
    suluk: '',
    muazobah: '',
    nazofah: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchApprovableSubjects();
    }
  }, [isOpen]);

  async function fetchApprovableSubjects() {
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('accessToken');

      const response = await fetch('/api/wali-kelas/grades-for-approval', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Gagal memuat data penilaian');
      }

      const data = await response.json();
      setSubjects(data.data?.subjectsByClass || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      console.error('Error fetching approvable subjects:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApprove(subject: SubjectApproval) {
    try {
      setApproving(subject.subjectId);
      setError('');
      const token = localStorage.getItem('accessToken');

      const payload = {
        subjectId: subject.subjectId,
        classId: subject.classId,
        ...(formData.suluk && { suluk: formData.suluk }),
        ...(formData.muazobah && { muazobah: formData.muazobah }),
        ...(formData.nazofah && { nazofah: formData.nazofah }),
      };

      const response = await fetch('/api/wali-kelas/approve-grades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.data?.message || 'Gagal menyetujui penilaian');
      }

      const result = await response.json();
      const approvedCount = result.data?.count || 0;
      setSuccess(`${approvedCount} penilaian telah disetujui dan disimpan`);
      setSelectedSubject(null);
      setFormData({ suluk: '', muazobah: '', nazofah: '' });
      
      // Refresh list
      await fetchApprovableSubjects();
      onSuccess();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setApproving(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Setujui Penilaian</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle size={18} />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg">
              <CheckCircle size={18} />
              <p className="text-sm">{success}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader size={24} className="animate-spin text-emerald-600" />
            </div>
          ) : subjects.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Tidak ada penilaian yang siap disetujui
            </div>
          ) : (
            <div className="space-y-3">
              {subjects.map((subject) => (
                <div
                  key={`${subject.subjectId}-${subject.classId}`}
                  className="border border-gray-200 rounded-lg p-4 hover:border-emerald-500 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">{subject.subjectName}</h3>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {subject.className}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                        <div>
                          <p className="text-gray-500">Total Siswa</p>
                          <p className="font-semibold text-gray-900">{subject.totalStudents}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Penilaian</p>
                          <p className="font-semibold text-gray-900">{subject.gradesCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Guru</p>
                          <p className="font-semibold text-gray-900">{subject.teachersCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Status</p>
                          <p className={`font-semibold ${subject.isComplete ? 'text-green-600' : 'text-amber-600'}`}>
                            {subject.isComplete ? 'Lengkap' : 'Belum Lengkap'}
                          </p>
                        </div>
                      </div>
                      {subject.teachers.length > 0 && (
                        <p className="text-xs text-gray-500 mt-2">
                          Guru: {subject.teachers.join(', ')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedSubject(subject)}
                      disabled={approving !== null}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium transition-colors whitespace-nowrap"
                    >
                      Setujui
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Approval Form Modal */}
        {selectedSubject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">
                  Setujui {selectedSubject.subjectName}
                </h3>
                <button
                  onClick={() => setSelectedSubject(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-96 overflow-y-auto">
                {/* Subject & Class Info */}
                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 font-medium">Mata Pelajaran</p>
                      <p className="text-gray-900 font-semibold">{selectedSubject.subjectName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-medium">Kelas</p>
                      <p className="text-gray-900 font-semibold">{selectedSubject.className}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-medium">Total Siswa</p>
                      <p className="text-gray-900 font-semibold">{selectedSubject.totalStudents}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-medium">Penilaian Masuk</p>
                      <p className="text-gray-900 font-semibold">{selectedSubject.gradesCount}</p>
                    </div>
                  </div>
                </div>

                {/* Nomor Raport Preview */}
                <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50">
                  <p className="text-sm font-semibold text-gray-900 mb-2">
                    📋 Nomor Raport Auto-Generated
                  </p>
                  <p className="text-xs text-gray-600 mb-3">
                    Format: JenisPenilaian-Semester-TahunAjaran-JenisKelamin-NomorUrut
                  </p>
                  <div className="space-y-1 text-xs font-mono bg-white rounded p-3">
                    {selectedSubject.gradesSample && selectedSubject.gradesSample.length > 0 && (
                      <>
                        <p className="text-gray-700">
                          <span className="text-emerald-700 font-semibold">Contoh:</span>
                        </p>
                        {selectedSubject.gradesSample.slice(0, 3).map((grade: any, idx: number) => (
                          <p key={idx} className="text-gray-600">
                            • {grade.studentName}: UTS-1-2025/2026-{grade.gender === 'MALE' ? 'PA' : 'PI'}-{String(idx + 1).padStart(4, '0')}
                          </p>
                        ))}
                        {selectedSubject.gradesSample.length > 3 && (
                          <p className="text-gray-500 italic">... dan {selectedSubject.gradesCount - 3} penilaian lainnya</p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Optional Fields */}
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-3">
                    Data Tambahan (Opsional)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Suluk (Perilaku)
                  </label>
                  <input
                    type="text"
                    value={formData.suluk}
                    onChange={(e) =>
                      setFormData({ ...formData, suluk: e.target.value })
                    }
                    placeholder="Opsional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Muazobah
                  </label>
                  <input
                    type="text"
                    value={formData.muazobah}
                    onChange={(e) =>
                      setFormData({ ...formData, muazobah: e.target.value })
                    }
                    placeholder="Opsional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Nazofah
                  </label>
                  <input
                    type="text"
                    value={formData.nazofah}
                    onChange={(e) =>
                      setFormData({ ...formData, nazofah: e.target.value })
                    }
                    placeholder="Opsional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setSelectedSubject(null)}
                    className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => handleApprove(selectedSubject)}
                    disabled={approving !== null}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {approving === selectedSubject.subjectId && (
                      <Loader size={16} className="animate-spin" />
                    )}
                    Setujui & Simpan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
