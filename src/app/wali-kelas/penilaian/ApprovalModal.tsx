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
  assessmentTypes?: string[];
}

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedClass?: string;
}

export default function ApprovalModal({ isOpen, onClose, onSuccess, selectedClass }: ApprovalModalProps) {
  const [subjects, setSubjects] = useState<SubjectApproval[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<SubjectApproval | null>(null);
  const [selectedClassName, setSelectedClassName] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSelectedSubject(null);
      // Jika ada selectedClass dari props, langsung set ke modal
      if (selectedClass) {
        setSelectedClassName(selectedClass);
      } else {
        setSelectedClassName('');
      }
      fetchApprovableSubjects();
    }
  }, [isOpen, selectedClass]);

  async function fetchApprovableSubjects() {
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('accessToken');

      if (!token) {
        throw new Error('Token tidak ditemukan. Silakan login kembali.');
      }

      const response = await fetch('/api/wali-kelas/grades-for-approval', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[fetchApprovableSubjects] API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        throw new Error(errorData.error || `Gagal memuat data penilaian (${response.status})`);
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
              const allApprovedGrades = approvalDataResponse.data?.data || [];
              
              // Filter approved data untuk subject ini
              approvedData = allApprovedGrades.filter(
                (g: any) => g.subjectId === subject.subjectId
              );
              
              // Get unique students yang approved untuk subject ini
              const approvedStudents = new Set(approvedData.map((g: any) => g.studentId));
              isFullyApproved = approvedStudents.size >= subject.totalStudents;
              
              console.log(`[ApprovalModal] Subject ${subject.subjectName}: approvedStudents=${approvedStudents.size}, totalStudents=${subject.totalStudents}, isFullyApproved=${isFullyApproved}`);
            } else {
              const errorData = await approvalResponse.json();
              console.error(`[ApprovalModal] Approval fetch failed: ${approvalResponse.status}`, errorData);
            }
          } catch (err) {
            console.error('[ApprovalModal] Failed to fetch approval data for subject:', subject.subjectId, err);
          }
          
          // Extract unique assessment types from gradesSample
          const assessmentTypes = subject.gradesSample
            ? Array.from(new Set(subject.gradesSample.map((g: any) => g.assessmentType)))
            : [];
          
          return {
            ...subject,
            isFullyApproved,
            approvedData,
            assessmentTypes,
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

  // Translate assessment type to Indonesian
  const translateAssessmentType = (type: string): string => {
    const translations: { [key: string]: string } = {
      UTS_1: 'Ujian Tengah Semester 1 (UTS 1)',
      UAS_1: 'Ujian Akhir Semester 1 (UAS 1)',
      UTS_2: 'Ujian Tengah Semester 2 (UTS 2)',
      UAS_2: 'Ujian Akhir Semester 2 (UAS 2)',
      FINAL_EXAM_1: 'Ujian Akhir Siswa Akhir Gel 1',
      FINAL_EXAM_2: 'Ujian Akhir Siswa Gel 2',
      DAILY: 'Penilaian Harian',
    };
    return translations[type] || type;
  };

  async function handleApprove(subject: SubjectApproval) {
    try {
      setApproving(subject.subjectId);
      setError('');
      const token = localStorage.getItem('accessToken');

      const payload = {
        subjectId: subject.subjectId,
        classId: subject.classId,
      };

      console.log('[ApprovalModal] Sending approve request - Payload:', JSON.stringify(payload, null, 2));

      const response = await fetch('/api/wali-kelas/approve-grades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      console.log('[ApprovalModal] Approve response status:', response.status);
      console.log('[ApprovalModal] Response OK?:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.log('[ApprovalModal] Error response data:', errorData);
        const errorMessage = errorData.error || errorData.data?.message || 'Gagal menyetujui penilaian';
        
        // Handle 409 Conflict specifically
        if (response.status === 409) {
          throw new Error(`Data sudah di-approve: ${errorMessage}`);
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('[ApprovalModal] Success response data:', JSON.stringify(result, null, 2));
      const approvedCount = result.data?.count ?? 0;
      const totalGrades = result.data?.totalGrades ?? 0;
      const message = result.data?.message || 'Unknown';
      console.log('[ApprovalModal] Approved count:', approvedCount, 'out of', totalGrades);
      console.log('[ApprovalModal] Server message:', message);
      
      if (approvedCount === 0 && totalGrades > 0) {
        setError(`⚠️ API returned success but created 0 records! Total grades: ${totalGrades}. Message: ${message}`);
        console.error('[ApprovalModal] WARNING: Zero records created despite API success!');
        return;
      }
      
      setSuccess(`${approvedCount} penilaian telah disetujui dan disimpan`);
      setSelectedSubject(null);
      
      // Refresh list
      await fetchApprovableSubjects();
      onSuccess();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('[ApprovalModal] Error during approval:', err);
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setApproving(null);
    }
  }

  if (!isOpen) return null;

  const handleClose = () => {
    setSelectedSubject(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Setujui Penilaian</h2>
          <button
            onClick={handleClose}
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

          {!selectedClass ? (
            <div className="text-center py-8 text-gray-500">
              Silakan pilih kelas terlebih dahulu di filter data
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader size={24} className="animate-spin text-emerald-600" />
            </div>
          ) : subjects.filter((s) => s.className === selectedClass).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Tidak ada penilaian yang siap disetujui untuk kelas {selectedClass}
            </div>
          ) : (
            // Subject Selection (direct, no class selection step)
            <div className="space-y-4">
              <div className="text-sm font-medium text-gray-700 mb-3">
                Kelas: <span className="font-semibold text-emerald-600">{selectedClass}</span>
              </div>
              <div className="space-y-3">
                {subjects
                  .filter((s) => s.className === selectedClass)
                  .map((subject) => (
                    <div
                      key={`${subject.subjectId}-${subject.classId}`}
                      className="border border-gray-200 rounded-lg p-4 hover:border-emerald-500 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900">{subject.subjectName}</h3>
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
                          {subject.assessmentTypes && subject.assessmentTypes.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {subject.assessmentTypes.map((type) => (
                                <span key={type} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                  {translateAssessmentType(type)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => subject.isFullyApproved ? null : setSelectedSubject(subject)}
                          disabled={subject.isFullyApproved || (approving !== null && !subject.isFullyApproved)}
                          title={subject.isFullyApproved ? 'Mata pelajaran ini sudah disetujui dan tidak dapat diubah' : 'Klik untuk menyetujui penilaian'}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                            subject.isFullyApproved
                              ? 'bg-green-100 text-green-700 cursor-not-allowed opacity-75'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed'
                          }`}
                        >
                          {subject.isFullyApproved ? '✓ Sudah Disetujui' : 'Setujui'}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
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
                {/* Approval Status Banner */}
                {selectedSubject.isFullyApproved ? (
                  <div className="border-2 border-green-300 rounded-lg p-4 bg-green-50">
                    <div className="flex items-center gap-3">
                      <CheckCircle size={24} className="text-green-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-bold text-green-900">✓ Sudah Disetujui</p>
                        <p className="text-xs text-green-800 mt-1">Mata pelajaran ini telah disetujui oleh Wali Kelas dan tidak dapat diubah</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-amber-300 rounded-lg p-4 bg-amber-50">
                    <div className="flex items-center gap-3">
                      <AlertCircle size={24} className="text-amber-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-bold text-amber-900">⊗ Belum Disetujui</p>
                        <p className="text-xs text-amber-800 mt-1">Silakan review data dan klik tombol Setujui & Simpan untuk menyetujui</p>
                      </div>
                    </div>
                  </div>
                )}

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
                  {selectedSubject.assessmentTypes && selectedSubject.assessmentTypes.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-blue-200">
                      <p className="text-gray-600 font-medium text-sm mb-2">Jenis Penilaian</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedSubject.assessmentTypes.map((type) => (
                          <span key={type} className="px-3 py-1 bg-blue-200 text-blue-800 rounded-full text-sm font-medium">
                            {translateAssessmentType(type)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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
                            <div className="grid grid-cols-2 gap-2 text-gray-700 mb-2">
                              {approval.jumlahNilai && (
                                <div>
                                  <span className="font-medium">Jumlah Nilai:</span>
                                  <p className="font-semibold text-emerald-600">{approval.jumlahNilai.toFixed(2)}</p>
                                </div>
                              )}
                              {approval.mulahazoh && (
                                <div>
                                  <span className="font-medium">Mulahazoh:</span>
                                  <p className="font-semibold text-gray-900">{approval.mulahazoh}</p>
                                </div>
                              )}
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
