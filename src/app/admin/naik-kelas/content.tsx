'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Users,
  BookOpen,
  Search,
  RefreshCw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Level {
  id: string;
  name: string;
  code: string;
  order: number;
}

interface ClassItem {
  id: string;
  name: string;
  capacity: number;
  level: Level;
  schoolYear: { id: string; year: string };
  semester: { id: string; number: number };
  waliKelas?: { id: string; name: string } | null;
  isActive?: boolean;
  _count?: { students: number };
}

interface PendingSubject {
  id: string;
  name: string;
  code: string;
  approvedStudents: number;
}

interface EligibilityResult {
  eligible: boolean;
  totalSubjects: number;
  approvedSubjects: number;
  pendingSubjects: PendingSubject[];
  totalStudents: number;
  class: { id: string; name: string; level: Level };
  nextLevel: Level | null;
  targetClassSuggestions: Array<{
    id: string;
    name: string;
    levelId: string;
    level: Level;
  }>;
  reason?: string;
}

interface Student {
  id: string;
  name: string;
  studentNo: string;
  nourut: number | null;
  gender: string;
  averageScore?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NaikKelasContent() {
  const searchParams = useSearchParams();
  const preselectedClassId = searchParams.get('classId');

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Step 1 data
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classSearch, setClassSearch] = useState('');
  const [selectedSourceClassId, setSelectedSourceClassId] = useState<string>(preselectedClassId || '');

  // Step 2 data
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(false);

  // Step 3 data
  const [targetClasses, setTargetClasses] = useState<ClassItem[]>([]);
  const [selectedTargetClassId, setSelectedTargetClassId] = useState<string>('');

  // Step 4 data
  const [students, setStudents] = useState<Student[]>([]);
  const [studentStatus, setStudentStatus] = useState<Record<string, 'promote' | 'retain'>>({});
  const [studentTargetClass, setStudentTargetClass] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';

  // ── Fetch classes on mount ──
  useEffect(() => {
    fetchClasses();
  }, []);

  // ── Pre-select class if passed via query param ──
  useEffect(() => {
    if (preselectedClassId && classes.length > 0) {
      setSelectedSourceClassId(preselectedClassId);
      checkEligibility(preselectedClassId);
      setStep(2);
    }
  }, [preselectedClassId, classes]);

  async function fetchClasses() {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/classes?limit=200', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setClasses(data.data || []);
    } catch {
      setError('Gagal memuat data kelas');
    } finally {
      setIsLoading(false);
    }
  }

  const checkEligibility = useCallback(
    async (classId: string) => {
      setLoadingEligibility(true);
      setEligibility(null);
      setError(null);
      try {
        const res = await fetch(`/api/admin/classes/${classId}/promotion-eligibility`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setEligibility(data.data);
        } else {
          setError(data.error || 'Gagal memeriksa kelayakan naik kelas');
        }
      } catch {
        setError('Gagal menghubungi server');
      } finally {
        setLoadingEligibility(false);
      }
    },
    [token]
  );

  async function fetchTargetClasses(nextLevelId: string) {
    try {
      const res = await fetch(`/api/admin/classes?levelId=${nextLevelId}&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTargetClasses(data.data || []);
    } catch {
      setError('Gagal memuat kelas tujuan');
    }
  }

  async function fetchStudents(classId: string) {
    try {
      const res = await fetch(`/api/admin/students?classId=${classId}&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      let studs: Student[] = data.data || [];
      
      // Fetch grades untuk calculate rata-rata nilai
      if (studs.length > 0) {
        try {
          const studentIdList = studs.map((s) => s.id).join(',');
          const gradesRes = await fetch(
            `/api/admin/students/grades?studentIds=${studentIdList}&limit=500`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const gradesData = await gradesRes.json();
          const gradesMap: Record<string, { score: string }[]> = {};
          
          if (gradesData.data && Array.isArray(gradesData.data.grades)) {
            gradesData.data.grades.forEach((grade: { studentId: string; score: string }) => {
              if (!gradesMap[grade.studentId]) gradesMap[grade.studentId] = [];
              gradesMap[grade.studentId].push({ score: grade.score });
            });
          }
          
          // Calculate average score untuk setiap siswa
          studs = studs.map((student) => {
            const studentGrades = gradesMap[student.id] || [];
            let totalScore = 0;
            let scoreCount = 0;
            
            studentGrades.forEach((grade) => {
              const scoreNum = parseFloat(grade.score);
              if (!isNaN(scoreNum)) {
                totalScore += scoreNum;
                scoreCount++;
              }
            });
            
            const avgScore = scoreCount > 0 ? totalScore / scoreCount : 0;
            return { ...student, averageScore: avgScore };
          });
        } catch (gradesError) {
          console.error('Failed to fetch grades:', gradesError);
          // Continue dengan students data tanpa average score
        }
      }
      
      // Sort berdasarkan average score (descending - tertinggi dulu)
      studs.sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0));
      
      setStudents(studs);
      // Default semua siswa naik kelas
      const statusMap: Record<string, 'promote' | 'retain'> = {};
      const targetClassMap: Record<string, string> = {};
      const defaultTargetClass = targetClasses.length > 0 ? targetClasses[0].id : '';
      studs.forEach((s) => {
        statusMap[s.id] = 'promote';
        targetClassMap[s.id] = defaultTargetClass;
      });
      setStudentStatus(statusMap);
      setStudentTargetClass(targetClassMap);
    } catch {
      setError('Gagal memuat data siswa');
    }
  }

  // ── Step handlers ──

  function handleSelectSourceClass(classId: string) {
    setSelectedSourceClassId(classId);
    setEligibility(null);
    setSelectedTargetClassId('');
    setError(null);
  }

  function handleGoToStep2() {
    if (!selectedSourceClassId) {
      setError('Pilih kelas terlebih dahulu');
      return;
    }
    checkEligibility(selectedSourceClassId);
    setStep(2);
  }

  function handleGoToStep3() {
    if (!eligibility?.eligible) return;
    
    // Set target classes dan show step 3
    if (eligibility.targetClassSuggestions && eligibility.targetClassSuggestions.length > 0) {
      setTargetClasses(eligibility.targetClassSuggestions as unknown as ClassItem[]);
      setStep(3);
    } else {
      setError('Tidak ada kelas tujuan yang tersedia untuk promosi');
    }
  }

  function handleSelectTargetClass(classId: string) {
    setSelectedTargetClassId(classId);
  }

  function handleGoToStep4() {
    fetchStudents(selectedSourceClassId);
    setStep(4);
  }

  function toggleStudentStatus(studentId: string) {
    setStudentStatus((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === 'promote' ? 'retain' : 'promote',
    }));
  }

  function toggleAllStatus(status: 'promote' | 'retain') {
    const updated: Record<string, 'promote' | 'retain'> = {};
    students.forEach((s) => (updated[s.id] = status));
    setStudentStatus(updated);
  }

  function setStudentTargetClasses(studentId: string, targetClassId: string) {
    setStudentTargetClass((prev) => ({
      ...prev,
      [studentId]: targetClassId,
    }));
  }

  async function handlePromote() {
    const promoteStudentIds = students
      .filter((s) => studentStatus[s.id] === 'promote')
      .map((s) => s.id);
    const retainStudentIds = students
      .filter((s) => studentStatus[s.id] === 'retain')
      .map((s) => s.id);

    if (promoteStudentIds.length === 0) {
      setError('Minimal 1 siswa harus dipromosikan');
      return;
    }

    // Validate setiap siswa yang naik kelas punya target class
    const studentsWithoutTarget = promoteStudentIds.filter((sid) => !studentTargetClass[sid]);
    if (studentsWithoutTarget.length > 0) {
      setError('Pastikan semua siswa yang naik kelas sudah memiliki kelas tujuan');
      return;
    }

    // Build student assignments dengan per-student target class
    const studentAssignments = promoteStudentIds.map((sid) => ({
      studentId: sid,
      targetClassId: studentTargetClass[sid],
    }));

    const confirmed = window.confirm(
      `Konfirmasi Naik Kelas:\n\n` +
        `• ${promoteStudentIds.length} siswa akan dipindahkan ke kelas tujuan\n` +
        `• ${retainStudentIds.length} siswa tinggal kelas (tidak dipindahkan)\n\n` +
        `Tindakan ini tidak dapat dibatalkan. Lanjutkan?`
    );
    if (!confirmed) return;

    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/classes/${selectedSourceClassId}/promote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ studentAssignments, retainStudentIds }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || `Berhasil: ${data.data.promoted} siswa dipromosikan!`);
        setStep(5);
      } else {
        setError(data.error || 'Gagal memproses naik kelas');
      }
    } catch {
      setError('Gagal menghubungi server');
    } finally {
      setIsProcessing(false);
    }
  }

  // ── Derived ──
  const filteredClasses = classes
    .filter((c) => c.isActive !== false) // Filter hanya kelas aktif
    .filter(
      (c) =>
        c.name.toLowerCase().includes(classSearch.toLowerCase()) ||
        c.level.name.toLowerCase().includes(classSearch.toLowerCase())
    );

  const selectedSource = classes.find((c) => c.id === selectedSourceClassId);
  const selectedTarget = targetClasses.find((c) => c.id === selectedTargetClassId);
  const promoteCount = Object.values(studentStatus).filter((v) => v === 'promote').length;
  const retainCount = Object.values(studentStatus).filter((v) => v === 'retain').length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="text-purple-600" size={32} />
          Sistem Naik Kelas
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Promosikan siswa ke kelas berikutnya setelah semua mata pelajaran selesai di-approve
        </p>
      </div>

      {/* Step Indicator */}
      {step < 5 && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2">
            {[
              { n: 1, label: 'Pilih Kelas' },
              { n: 2, label: 'Cek Status' },
              { n: 3, label: 'Kelas Tujuan' },
              { n: 4, label: 'Konfirmasi' },
            ].map((s, idx, arr) => (
              <div key={s.n} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      step > s.n
                        ? 'bg-green-500 text-white'
                        : step === s.n
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {step > s.n ? <CheckCircle size={16} /> : s.n}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:block ${
                      step === s.n ? 'text-purple-600' : step > s.n ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < arr.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${step > s.n ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-red-800 font-medium">Terjadi Kesalahan</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            ✕
          </button>
        </div>
      )}

      {/* ── STEP 1: Pilih Kelas Asal ── */}
      {step === 1 && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Langkah 1 — Pilih Kelas Asal</h2>
          <p className="text-sm text-gray-600">
            Pilih kelas yang akan diproses naik kelas. Pastikan kelas sudah memiliki semua nilai yang di-approve.
          </p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Cari kelas atau jenjang..."
              value={classSearch}
              onChange={(e) => setClassSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-gray-500">
              <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
              Memuat data kelas...
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="py-10 text-center text-gray-500">
              Tidak ada kelas ditemukan
            </div>
          ) : (
            <div className="grid gap-3 max-h-96 overflow-y-auto pr-1">
              {filteredClasses.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => handleSelectSourceClass(cls.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                    selectedSourceClassId === cls.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-gray-900">{cls.name}</span>
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {cls.level.name}
                      </span>
                      {cls.level.order > 0 && (
                        <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">
                          Urutan {cls.level.order}
                        </span>
                      )}
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <div>{cls.schoolYear?.year}</div>
                      <div>Sem. {cls.semester?.number}</div>
                      {cls._count && (
                        <div className="mt-0.5 text-gray-400">{cls._count.students} siswa</div>
                      )}
                    </div>
                  </div>
                  {cls.waliKelas && (
                    <div className="text-xs text-gray-500 mt-1">
                      Wali Kelas: {cls.waliKelas.name}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleGoToStep2}
              disabled={!selectedSourceClassId}
              className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Cek Status Persetujuan
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Review Eligibility ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              Langkah 2 — Status Persetujuan Nilai
            </h2>
            {selectedSource && (
              <p className="text-sm text-gray-600 mb-4">
                Kelas:{' '}
                <span className="font-semibold text-purple-700">
                  {selectedSource.name} — {selectedSource.level.name}
                </span>
              </p>
            )}

            {loadingEligibility ? (
              <div className="py-10 text-center text-gray-500">
                <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                Memeriksa status persetujuan...
              </div>
            ) : eligibility ? (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-800">{eligibility.totalStudents}</div>
                    <div className="text-xs text-gray-500 mt-1">Total Siswa</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-800">{eligibility.totalSubjects}</div>
                    <div className="text-xs text-gray-500 mt-1">Total Mapel</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-700">{eligibility.approvedSubjects}</div>
                    <div className="text-xs text-green-600 mt-1">Mapel Sudah Approve</div>
                  </div>
                  <div className={`rounded-lg p-3 text-center ${eligibility.pendingSubjects.length > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <div className={`text-2xl font-bold ${eligibility.pendingSubjects.length > 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {eligibility.pendingSubjects.length}
                    </div>
                    <div className={`text-xs mt-1 ${eligibility.pendingSubjects.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      Mapel Belum Approve
                    </div>
                  </div>
                </div>

                {/* Eligibility Status */}
                <div
                  className={`flex items-start gap-3 p-4 rounded-lg border ${
                    eligibility.eligible
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  {eligibility.eligible ? (
                    <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={22} />
                  ) : (
                    <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={22} />
                  )}
                  <div>
                    <p className={`font-semibold ${eligibility.eligible ? 'text-green-800' : 'text-red-800'}`}>
                      {eligibility.eligible
                        ? '✅ Kelas ini memenuhi syarat naik kelas!'
                        : '❌ Kelas ini belum memenuhi syarat naik kelas'}
                    </p>
                    {eligibility.eligible && eligibility.nextLevel && (
                      <p className="text-green-700 text-sm mt-1">
                        Level berikutnya:{' '}
                        <span className="font-semibold">{eligibility.nextLevel.name}</span>
                      </p>
                    )}
                    {!eligibility.eligible && eligibility.reason && (
                      <p className="text-red-600 text-sm mt-1">{eligibility.reason}</p>
                    )}
                    {!eligibility.eligible && !eligibility.nextLevel && eligibility.eligible === false && eligibility.totalSubjects > 0 && !eligibility.reason && (
                      <p className="text-red-600 text-sm mt-1">
                        Selesaikan persetujuan nilai untuk semua mata pelajaran berikut sebelum melanjutkan.
                      </p>
                    )}
                    {!eligibility.nextLevel && eligibility.eligible && (
                      <p className="text-orange-600 text-sm mt-1">
                        ⚠️ Tidak ada level berikutnya. Pastikan urutan level sudah diatur di halaman Jenjang Pendidikan.
                      </p>
                    )}
                  </div>
                </div>

                {/* Pending Subjects List */}
                {eligibility.pendingSubjects.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <BookOpen size={16} />
                      Mata Pelajaran Belum Lengkap ({eligibility.pendingSubjects.length})
                    </h3>
                    <div className="space-y-2">
                      {eligibility.pendingSubjects.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between px-4 py-2.5 bg-red-50 border border-red-100 rounded-lg"
                        >
                          <div>
                            <span className="font-medium text-gray-800">{s.name}</span>
                            <span className="ml-2 text-xs text-gray-500">({s.code})</span>
                          </div>
                          <div className="text-xs text-red-600 font-medium">
                            {s.approvedStudents}/{eligibility.totalStudents} siswa
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors font-medium"
            >
              <ChevronLeft size={18} />
              Kembali
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => checkEligibility(selectedSourceClassId)}
                className="flex items-center gap-2 px-4 py-2.5 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
              <button
                onClick={handleGoToStep3}
                disabled={!eligibility?.eligible || !eligibility?.nextLevel}
                className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Pilih Kelas Tujuan
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Pilih Kelas Tujuan ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Langkah 3 — Pilih Kelas Tujuan</h2>
            <p className="text-sm text-gray-600 mb-4">
              🎯 Berikut adalah kelas tujuan yang <span className="font-semibold">tersedia</span> untuk promosi. Anda bisa assign setiap siswa ke kelas tujuan yang berbeda-beda di langkah berikutnya:
            </p>

            {targetClasses.length === 0 ? (
              <div className="py-10 text-center">
                <AlertCircle className="mx-auto text-orange-400 mb-3" size={40} />
                <p className="text-gray-600 font-medium">Belum ada kelas tujuan yang cocok</p>
                <p className="text-gray-500 text-sm mt-1">
                  Sistem tidak menemukan kelas tujuan yang sesuai. Pastikan kelas telah dibuat di level yang tepat.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 max-h-96 overflow-y-auto pr-1">
                {targetClasses.map((cls) => {
                  const siswaCount = (cls as any)._count?.students ?? 0;
                  const willBeFull = siswaCount + (eligibility?.totalStudents ?? 0) > cls.capacity;
                  const isRecommended = targetClasses.length === 1;
                  return (
                    <div
                      key={cls.id}
                      className="w-full text-left px-4 py-3 rounded-lg border-2 border-gray-200 bg-white"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-gray-900">{cls.name}</span>
                          {isRecommended && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                              ✓ Rekomendasi Sistem
                            </span>
                          )}
                          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">
                            {cls.level.name}
                          </span>
                          {willBeFull && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                              ⚠️ Melebihi kapasitas
                            </span>
                          )}
                        </div>
                        <div className="text-right text-xs text-gray-500">
                          <div>{cls.schoolYear?.year}</div>
                          <div>Sem. {cls.semester?.number}</div>
                          <div className="mt-0.5">
                            {siswaCount}/{cls.capacity} siswa
                          </div>
                        </div>
                      </div>
                      {cls.waliKelas && (
                        <div className="text-xs text-gray-500 mt-1">
                          Wali Kelas: {cls.waliKelas.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors font-medium"
            >
              <ChevronLeft size={18} />
              Kembali
            </button>
            <button
              onClick={handleGoToStep4}
              className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Atur Siswa
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Konfirmasi & Assign Siswa ── */}
      {step === 4 && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                <Users size={16} className="text-gray-500" />
                <span className="text-gray-600">Dari:</span>
                <span className="font-semibold text-gray-900">
                  {selectedSource?.name} ({selectedSource?.level.name})
                </span>
              </div>
              <ArrowRight size={20} className="text-purple-500 flex-shrink-0 hidden sm:block" />
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-100 rounded-lg">
                <TrendingUp size={16} className="text-purple-500" />
                <span className="text-purple-600">Ke:</span>
                <span className="font-semibold text-purple-900">
                  Kelas Tujuan (disesuaikan per siswa)
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Langkah 4 — Pilih Siswa & Kelas Tujuan
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Tentukan siswa mana yang naik kelas dan pilih kelas tujuan untuk masing-masing siswa
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => toggleAllStatus('promote')}
                  className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium"
                >
                  Semua Naik
                </button>
                <button
                  onClick={() => toggleAllStatus('retain')}
                  className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium"
                >
                  Semua Tinggal
                </button>
              </div>
            </div>

            {/* Counter */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{promoteCount}</div>
                <div className="text-xs text-green-600 mt-0.5">Naik Kelas</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-700">{retainCount}</div>
                <div className="text-xs text-orange-600 mt-0.5">Tinggal Kelas</div>
              </div>
            </div>

            {/* Student Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">No.</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Nama Siswa</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">No. Siswa</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Gender</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Nilai Rata-rata</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Kelas Tujuan</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map((s, idx) => {
                    const isPromote = studentStatus[s.id] === 'promote';
                    return (
                      <tr
                        key={s.id}
                        className={`transition-colors ${isPromote ? 'bg-green-50/50' : 'bg-orange-50/50'}`}
                      >
                        <td className="px-4 py-3 text-gray-500">{s.nourut ?? idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                        <td className="px-4 py-3 text-gray-600">{s.studentNo}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {s.gender === 'MALE' ? '♂ L' : '♀ P'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold ${
                            s.averageScore ? 
                            s.averageScore >= 80 ? 'text-green-700' :
                            s.averageScore >= 70 ? 'text-blue-700' :
                            s.averageScore >= 60 ? 'text-yellow-700' :
                            'text-red-700'
                            : 'text-gray-500'
                          }`}>
                            {s.averageScore ? s.averageScore.toFixed(1) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isPromote ? (
                            <select
                              value={studentTargetClass[s.id] || ''}
                              onChange={(e) => setStudentTargetClasses(s.id, e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-purple-300 rounded bg-purple-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="">-- Pilih Kelas --</option>
                              {targetClasses.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                  {cls.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggleStudentStatus(s.id)}
                            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                              isPromote
                                ? 'bg-green-500 text-white hover:bg-green-600'
                                : 'bg-orange-400 text-white hover:bg-orange-500'
                            }`}
                          >
                            {isPromote ? '✓ Naik Kelas' : '✗ Tinggal Kelas'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors font-medium"
            >
              <ChevronLeft size={18} />
              Kembali
            </button>
            <button
              onClick={handlePromote}
              disabled={isProcessing || promoteCount === 0}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="animate-spin" size={18} />
                  Memproses...
                </>
              ) : (
                <>
                  <TrendingUp size={18} />
                  Proses Naik Kelas ({promoteCount} siswa)
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 5: Sukses ── */}
      {step === 5 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <CheckCircle className="mx-auto text-green-500 mb-4" size={64} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Naik Kelas Berhasil!</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">{successMsg}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                setStep(1);
                setSelectedSourceClassId('');
                setSelectedTargetClassId('');
                setEligibility(null);
                setStudents([]);
                setStudentStatus({});
                setStudentTargetClass({});
                setSuccessMsg(null);
                setError(null);
                fetchClasses();
              }}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors"
            >
              Proses Kelas Lain
            </button>
            <a
              href="/admin/students"
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Lihat Data Siswa
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
