'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Search, Download, Eye, FileText } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { devError } from '@/lib/dev-log';

interface Class {
  id: string;
  name: string;
  code: string;
  levelId?: string;
  schoolYearId?: string;
  semesterId?: string;
  schoolYear?: {
    id?: string;
    year?: string;
    isActive?: boolean;
  };
  semester?: {
    id?: string;
    number?: number;
    isActive?: boolean;
  };
}

interface Student {
  id: string;
  name: string;
  studentNo: string;
  noUrut?: number;
  raportNo?: string | null;
}

interface ClassWithStudents extends Class {
  students: Student[];
  semesters: Array<{
    classId: string;
    semesterNumber?: number;
    semesterId?: string;
    isActive?: boolean;
    students: Student[];
  }>;
}

interface NilaiApproveItem {
  assessmentType?: string;
  studentId: string;
}

interface ClassApiItem extends Class {
  students?: Student[];
}

interface StudentApiItem {
  id: string;
  name: string;
  studentNo: string;
  raportNo?: string | null;
}

function RaportArabPageContent() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassWithStudents[]>([]);
  const [approvedStudents, setApprovedStudents] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedAssessmentType, setSelectedAssessmentType] = useState<string>('');

  const assessmentTypes = [
    { value: 'UTS_1', label: 'UTS Semester 1' },
    { value: 'UAS_1', label: 'UAS Semester 1' },
    { value: 'UTS_2', label: 'UTS Semester 2' },
    { value: 'UAS_2', label: 'UAS Semester 2' },
    { value: 'FINAL_EXAM_1', label: 'Ujian Akhir Gel 1' },
    { value: 'FINAL_EXAM_2', label: 'Ujian Akhir Gel 2' },
  ];

  const getAssessmentSemester = (assessmentType?: string) => {
    if (!assessmentType) return null;
    if (assessmentType.endsWith('_1')) return 1;
    if (assessmentType.endsWith('_2')) return 2;
    return null;
  };

  const groupClasses = (classItems: ClassApiItem[]) => {
    const groupMap = new Map<string, ClassWithStudents>();

    for (const classItem of classItems) {
      const groupKey = [
        classItem.name,
        classItem.levelId || '',
        classItem.schoolYearId || '',
      ].join('|');

      const students = (classItem.students || []).map((student) => ({ ...student }));
      const semesterNumber = classItem.semester?.number;

      const existing = groupMap.get(groupKey);
      if (!existing) {
        groupMap.set(groupKey, {
          ...classItem,
          id: groupKey,
          code: classItem.code || classItem.name,
          students,
          semesters: [
            {
              classId: classItem.id,
              semesterNumber,
              semesterId: classItem.semesterId,
              isActive: classItem.semester?.isActive,
              students,
            },
          ],
        });
        continue;
      }

      const mergedStudents = new Map<string, Student>();
      existing.students.forEach((student) => mergedStudents.set(student.id, student));
      students.forEach((student) => mergedStudents.set(student.id, student));

      existing.students = Array.from(mergedStudents.values()).sort((a, b) => {
        const noA = a.noUrut || 0;
        const noB = b.noUrut || 0;
        return noA - noB;
      });

      existing.semesters.push({
        classId: classItem.id,
        semesterNumber,
        semesterId: classItem.semesterId,
        isActive: classItem.semester?.isActive,
        students,
      });

      existing.semesters.sort((a, b) => (a.semesterNumber || 0) - (b.semesterNumber || 0));
    }

    return Array.from(groupMap.values()).sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      if (nameCompare !== 0) return nameCompare;
      return (a.schoolYear?.year || '').localeCompare(b.schoolYear?.year || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  };

  const getSemesterClassId = (classGroup: ClassWithStudents | undefined, assessmentType?: string) => {
    if (!classGroup) return '';

    const targetSemester = getAssessmentSemester(assessmentType);
    if (targetSemester) {
      const matchedSemester = classGroup.semesters.find((semester) => semester.semesterNumber === targetSemester);
      if (matchedSemester?.classId) {
        return matchedSemester.classId;
      }
    }

    return classGroup.semesters[0]?.classId || classGroup.id;
  };

  useEffect(() => {
    const loadApprovedStudents = async () => {
      if (!selectedClass || !selectedAssessmentType) {
        setApprovedStudents(new Set());
        return;
      }

      try {
        const selectedClassObj = classes.find((cls) => cls.id === selectedClass);
        const classId = getSemesterClassId(selectedClassObj, selectedAssessmentType);
        if (!classId) {
          setApprovedStudents(new Set());
          return;
        }

        const response = await apiFetch(
          `/api/wali-kelas/nilai-approve?classId=${classId}&limit=1000`
        );

        if (response.ok) {
          const data = await response.json();
          const nilaiApproves = (data.data?.data || []) as NilaiApproveItem[];
          const studentIds = new Set(
            nilaiApproves
              .filter((n) => n.assessmentType === selectedAssessmentType)
              .map((n) => n.studentId)
          );

          setApprovedStudents(studentIds);
        }
      } catch (error) {
        devError('Error fetching approved students:', error);
      }
    };

    void loadApprovedStudents();
  }, [classes, selectedAssessmentType, selectedClass]);

  useEffect(() => {
    const fetchClasses = async () => {
    try {
      setError('');
      setIsLoading(true);

      const response = await apiFetch('/api/admin/classes?limit=100&includeInactive=true');

      if (response.status === 401) {
        setError('Sesi Anda telah berakhir. Silakan login kembali');
        setTimeout(() => router.push('/login'), 1500);
        return;
      }

      if (!response.ok) {
        throw new Error('Gagal memuat data kelas');
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        // Fetch students for each class
        const classesWithStudents = await Promise.all(
          (data.data as ClassApiItem[]).map(async (cls) => {
            try {
              const studentsResponse = await apiFetch(
                `/api/admin/classes/${cls.id}/students?limit=100`
              );

              let students: Student[] = [];
              if (studentsResponse.ok) {
                const studentsData = await studentsResponse.json();
                if (studentsData.success && Array.isArray(studentsData.data)) {
                  students = (studentsData.data as StudentApiItem[]).map((s) => ({ 
                    id: s.id,
                    name: s.name,
                    studentNo: s.studentNo,
                    raportNo: s.raportNo || null,
                  }));
                }
              }

              return {
                ...cls,
                students,
              };
            } catch {
              return {
                ...cls,
                students: [],
              };
            }
          })
        );

        setClasses(groupClasses(classesWithStudents));
      }
    } catch (error) {
      devError('Error fetching classes:', error);
      setError('Terjadi kesalahan saat memuat data kelas');
    } finally {
      setIsLoading(false);
    }
  };

    void fetchClasses();
  }, [router]);

  const handleViewRaport = (classId: string, studentId: string) => {
    const params = new URLSearchParams({
      classId,
      studentId,
    });
    if (selectedAssessmentType) {
      params.append('assessmentType', selectedAssessmentType);
    }
    router.push(`/wali-kelas/raport-arab/detail?${params.toString()}`);
  };

  // Filter classes based on search and selected class
  const getFilteredStudents = () => {
    if (!selectedClass) return [];

    const selectedClassObj = classes.find((cls) => cls.id === selectedClass);
    if (!selectedClassObj) return [];

    const filtered = selectedClassObj.students.filter((student) => {
      const matchSearch =
        !searchQuery ||
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.studentNo.toLowerCase().includes(searchQuery.toLowerCase());

      // If assessment type is selected, only show students who are approved for that assessment type
      const matchAssessment = !selectedAssessmentType || approvedStudents.has(student.id);

      return matchSearch && matchAssessment;
    });

    // Sort by noUrut (ordinal number)
    return filtered.sort((a, b) => {
      const noA = a.noUrut || 0;
      const noB = b.noUrut || 0;
      return noA - noB;
    });
  };

  const filteredStudents = getFilteredStudents();
  const selectedClassObj = classes.find((cls) => cls.id === selectedClass);
  const selectedClassSemesterClassId = getSemesterClassId(selectedClassObj, selectedAssessmentType);
  const selectedClassSemesterLabel = selectedClassObj?.semesters
    .map((semester) => `Semester ${semester.semesterNumber || '-'}`)
    .join(' + ');

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-md"
            >
              <ArrowLeft size={20} />
              Kembali
            </button>
            <h1 className="text-3xl font-bold text-emerald-900">Raport Peserta Didik</h1>
          </div>
        </div>

        {/* Data Table Card */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {error && (
            <div className="p-6 bg-red-50 border-b border-red-200 text-red-700 rounded-t-lg">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              Memuat data raport...
            </div>
          ) : (
            <>
              {/* Filter Section */}
              <div className="p-6 border-b border-gray-200 bg-gray-50 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Search */}
                  <div className="relative">
                    <Search size={18} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari nama atau nomor induk..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                    />
                  </div>

                  {/* Class Filter */}
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white"
                  >
                    <option value="">Pilih Kelas</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}{cls.schoolYear?.year ? ` - ${cls.schoolYear.year}` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Assessment Type Filter */}
                  <select
                    value={selectedAssessmentType}
                    onChange={(e) => setSelectedAssessmentType(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white"
                  >
                    <option value="">Pilih Jenis Penilaian</option>
                    {assessmentTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Summary */}
                <p className="text-sm text-gray-600">
                  {selectedClass ? (
                    <>
                      Total: {filteredStudents.length} siswa di kelas {selectedClassObj?.name}
                      {selectedClassSemesterLabel && (
                        <> • Gabungan: {selectedClassSemesterLabel}</>
                      )}
                      {selectedAssessmentType && (
                        <> • Jenis: {assessmentTypes.find(t => t.value === selectedAssessmentType)?.label}</>
                      )}
                    </>
                  ) : (
                    <>Silakan pilih kelas untuk melihat data</>
                  )}
                </p>
              </div>

              {/* Table Display */}
              <div className="p-6">
                {!selectedClass ? (
                  <div className="p-8 text-center text-gray-500">
                    <p className="text-lg font-semibold mb-2">Silakan Pilih Kelas</p>
                    <p className="text-sm">Pilih kelas dari dropdown di atas untuk menampilkan data siswa</p>
                  </div>
                ) : filteredStudents.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-200">
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">NO</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">NAMA SISWA</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">NOMOR INDUK</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">NOMOR RAPORT</th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">AKSI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student, idx) => (
                          <tr key={student.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm text-gray-900 font-medium">{idx + 1}</td>
                            <td className="px-6 py-4 text-sm text-gray-900">{student.name}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{student.studentNo}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{student.raportNo || '-'}</td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    const params = new URLSearchParams({
                                      classId: selectedClassSemesterClassId || selectedClass,
                                      studentId: student.id,
                                    });
                                    if (selectedAssessmentType) {
                                      params.append('assessmentType', selectedAssessmentType);
                                    }
                                    router.push(`/wali-kelas/raport-arab/cover-preview?${params.toString()}`);
                                  }}
                                  className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-xs font-medium"
                                  title="Sampul Raport"
                                >
                                  <Printer size={16} />
                                  Sampul
                                </button>
                                <button
                                  onClick={() => handleViewRaport(selectedClassSemesterClassId || selectedClass, student.id)}
                                  className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors text-xs font-medium"
                                  title="Review Individual"
                                >
                                  <FileText size={16} />
                                  Review
                                </button>
                                <button
                                  onClick={() => {
                                    const params = new URLSearchParams({
                                      classId: selectedClassSemesterClassId || selectedClass,
                                    });
                                    if (selectedAssessmentType) {
                                      params.append('assessmentType', selectedAssessmentType);
                                    }
                                    router.push(`/wali-kelas/raport-arab/bulk-review?${params.toString()}`);
                                  }}
                                  className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium"
                                  title="Review Keseluruhan"
                                >
                                  <Eye size={16} />
                                  Semua
                                </button>
                                <button
                                  onClick={() => {
                                    const params = new URLSearchParams({
                                      classId: selectedClassSemesterClassId || selectedClass,
                                    });
                                    if (selectedAssessmentType) {
                                      params.append('assessmentType', selectedAssessmentType);
                                    }
                                    router.push(`/wali-kelas/raport-arab/bulk-download?${params.toString()}`);
                                  }}
                                  className="flex items-center gap-1 px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-xs font-medium"
                                  title="Download"
                                >
                                  <Download size={16} />
                                  Unduh
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    Tidak ada data siswa ditemukan
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

export default function RaportArabPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 flex items-center justify-center">
        <p className="text-gray-600">Memuat halaman...</p>
      </div>
    }>
      <RaportArabPageContent />
    </Suspense>
  );
}
