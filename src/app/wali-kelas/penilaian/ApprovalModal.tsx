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
  isFullyApproved?: boolean;
  approvedData?: any;
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
  const [classId, setClassId] = useState<string>('');
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
      const subjectsData = data.data?.subjectsByClass || [];

      // Fetch approved data untuk setiap subject
      const subjectsWithApprovalStatus = await Promise.all(
        subjectsData.map(async (subject: SubjectApproval) => {
          let isFullyApproved = false;
          let approvedData: any[] = [];

          try {
            if (!token) {
              console.warn('[ApprovalModal] No token found');
              return { ...subject, isFullyApproved, approvedData };
            }

            const approvalResponse = await fetch(
              `/api/wali-kelas/nilai-approve?classId=${subject.classId}&limit=1000`,
              {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            console.log(`[ApprovalModal] Fetch approval for ${subject.subjectName}: status ${approvalResponse.status}`);

            if (approvalResponse.ok) {
              const approvalDataResponse = await approvalResponse.json();
              const approvedGrades = approvalDataResponse.data?.data || [];
              
              // Check if all students have approved grades for this subject
              approvedData = approvedGrades.filter(
                (g: any) => g.subjectId === subject.subjectId
              );
              
              isFullyApproved = approvedData.length >= subject.totalStudents;
              
              console.log(`[ApprovalModal] Subject ${subject.subjectName}: approvedData=${approvedData.length}, totalStudents=${subject.totalStudents}, isFullyApproved=${isFullyApproved}`);
            } else {
              const errorData = await approvalResponse.json();
              console.error(`[ApprovalModal] Approval fetch failed: ${approvalResponse.status}`, errorData);
            }
          } catch (err) {
            console.error('[ApprovalModal] Failed to fetch approval data for subject:', subject.subjectId, err);
          }
          
          return {
            ...subject,
            isFullyApproved,
            approvedData,
          };
        })
      );

      setSubjects(subjectsWithApprovalStatus);
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
                      disabled={approving !== null && !subject.isFullyApproved}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        subject.isFullyApproved
                          ? 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                    >
                      {subject.isFullyApproved ? '✓ Sudah Disetujui' : 'Setujui'}
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
                  onClick={() => {
                    console.log('[Debug] Closing modal, selectedSubject:', selectedSubject);
                    setSelectedSubject(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-96 overflow-y-auto">
                {console.log('[Debug] Modal opened with selectedSubject:', {
                  subjectName: selectedSubject.subjectName,
                  isFullyApproved: selectedSubject.isFullyApproved,
                  approvedDataCount: selectedSubject.approvedData?.length || 0,
                  approvedData: selectedSubject.approvedData,
                })}
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

                {selectedSubject.isFullyApproved ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle size={18} className="text-green-600" />
                      <p className="font-semibold text-green-900">Data Sudah Disetujui</p>
                    </div>
                    {selectedSubject.approvedData && selectedSubject.approvedData.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs text-green-800 font-semibold border-b border-green-300 pb-2">
                          Total: {selectedSubject.approvedData.length} siswa telah di-approve
                        </p>
                        
                        {selectedSubject.approvedData.slice(0, 5).map((approval: any, idx: number) => (
                          <div key={idx} className="bg-white rounded p-3 text-xs">
                            <div className="font-semibold text-gray-900 mb-2">
                              {idx + 1}. {approval.student?.name || approval.studentName || 'N/A'} ({approval.student?.studentNo || 'N/A'})
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-gray-700">
                              {approval.suluk && (
                                <div>
                                  <span className="font-medium">Suluk:</span>
                                  <p>{approval.suluk}</p>
                                </div>
                              )}
                              {approval.muazobah && (
                                <div>
                                  <span className="font-medium">Muazobah:</span>
                                  <p>{approval.muazobah}</p>
                                </div>
                              )}
                              {approval.nazofah && (
                                <div>
                                  <span className="font-medium">Nazofah:</span>
                                  <p>{approval.nazofah}</p>
                                </div>
                              )}
                            </div>
                            {approval.updatedAt && (
                              <div className="text-gray-600 mt-2 text-xs border-t border-gray-200 pt-2">
                                <span className="font-medium">Disetujui:</span> {new Date(approval.updatedAt).toLocaleString('id-ID', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {selectedSubject.approvedData.length > 5 && (
                          <p className="text-xs text-green-600 italic font-semibold">
                            ... dan {selectedSubject.approvedData.length - 5} data lainnya
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm text-gray-900 placeholder-gray-500 bg-white"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm text-gray-900 placeholder-gray-500 bg-white"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm text-gray-900 placeholder-gray-500 bg-white"
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setSelectedSubject(null)}
                    className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
                  >
                    {selectedSubject.isFullyApproved ? 'Tutup' : 'Batal'}
                  </button>
                  {!selectedSubject.isFullyApproved && (
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
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
