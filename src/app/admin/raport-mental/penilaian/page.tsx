'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Save, CheckCircle, ChevronRight,
  AlertCircle, RefreshCw, Brain, Building2, Filter,
  Users, User, ArrowLeft, Plus, Trash2, Printer,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface School { id: string; name: string; }
interface Semester { id: string; number: number; semesterLabel: string | null; isActive: boolean; }
interface SchoolYear { id: string; schoolId: string; year: string; tahunAkademik: string | null; isActive: boolean; semesters: Semester[]; }
interface Kelas { id: string; name: string; _count?: { students: number }; }
interface Santri { id: string; name: string; studentNo: string; namaPanggilan?: string | null; gender?: string; }
interface Aspek { id: string; nama: string; urutan: number; punyaFieldData: boolean; fieldDataType?: 'NONE' | 'TEXT' | 'PRESTASI' | 'HUKUMAN'; keterangan: string | null; }
interface Seksi { id: string; nama: string; kode: string; tipeNilai: 'NILAI_ABCD' | 'NILAI_ABCDE' | 'NILAI_PLUS_MINUS' | 'TEXT' | 'ANGKA'; urutan: number; aspek: Aspek[]; }
interface NilaiEntry { nilai: string; dataEkstra: string; }
interface PrestasiData { bidangDivisi: string; juara: string; }
interface HukumanRow { namaPelanggaran: string; hukuman: string; jumlah: string; }

type Step = 'filter' | 'kelas' | 'santri' | 'nilai';

// ─── Constants ─────────────────────────────────────────────────────────────────
const NILAI_OPTIONS: Record<string, string[]> = {
  NILAI_ABCD: ['A', 'B', 'C', 'D'],
  NILAI_ABCDE: ['A', 'B', 'C', 'D', 'E'],
  NILAI_PLUS_MINUS: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D'],
  TEXT: [], ANGKA: [],
};

const BADGE: Record<string, string> = {
  'A+': 'bg-emerald-100 text-emerald-800', 'A': 'bg-green-100 text-green-700',
  'A-': 'bg-lime-100 text-lime-700', 'B+': 'bg-sky-100 text-sky-700',
  'B': 'bg-blue-100 text-blue-700', 'B-': 'bg-indigo-100 text-indigo-700',
  'C+': 'bg-amber-100 text-amber-700', 'C': 'bg-yellow-100 text-yellow-700',
  'C-': 'bg-orange-100 text-orange-700', 'D': 'bg-red-100 text-red-700',
  'E': 'bg-rose-100 text-rose-800',
};

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : ''; }
function authH(): HeadersInit { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }; }

function getFieldDataType(aspek: Aspek): 'NONE' | 'TEXT' | 'PRESTASI' | 'HUKUMAN' {
  return aspek.fieldDataType || (aspek.punyaFieldData ? 'TEXT' : 'NONE');
}

function parsePrestasiData(dataEkstra: string): PrestasiData {
  if (!dataEkstra) return { bidangDivisi: '', juara: '' };
  try {
    const parsed = JSON.parse(dataEkstra);
    return {
      bidangDivisi: typeof parsed.bidangDivisi === 'string' ? parsed.bidangDivisi : '',
      juara: typeof parsed.juara === 'string' ? parsed.juara : '',
    };
  } catch {
    return { bidangDivisi: '', juara: '' };
  }
}

function stringifyPrestasiData(data: PrestasiData): string {
  if (!data.bidangDivisi && !data.juara) return '';
  return JSON.stringify(data);
}

function createEmptyHukumanRow(): HukumanRow {
  return { namaPelanggaran: '', hukuman: '', jumlah: '' };
}

function hasHukumanContent(rows: HukumanRow[]): boolean {
  return rows.some(row => row.namaPelanggaran || row.hukuman || row.jumlah);
}

function parseHukumanData(dataEkstra: string): HukumanRow[] {
  if (!dataEkstra) return [createEmptyHukumanRow()];
  try {
    const parsed = JSON.parse(dataEkstra);
    if (Array.isArray(parsed)) {
      const rows = parsed.map((item) => ({
        namaPelanggaran: typeof item?.namaPelanggaran === 'string'
          ? item.namaPelanggaran
          : (typeof item?.jenisHukuman === 'string' ? item.jenisHukuman : ''),
        hukuman: typeof item?.hukuman === 'string' ? item.hukuman : '',
        jumlah: typeof item?.jumlah === 'string' ? item.jumlah : '',
      }));
      return rows.length > 0 ? rows : [createEmptyHukumanRow()];
    }
    return [{
      namaPelanggaran: typeof parsed.namaPelanggaran === 'string'
        ? parsed.namaPelanggaran
        : (typeof parsed.jenisHukuman === 'string' ? parsed.jenisHukuman : ''),
      hukuman: typeof parsed.hukuman === 'string' ? parsed.hukuman : '',
      jumlah: typeof parsed.jumlah === 'string' ? parsed.jumlah : '',
    }];
  } catch {
    return [createEmptyHukumanRow()];
  }
}

function stringifyHukumanData(rows: HukumanRow[]): string {
  return JSON.stringify(rows);
}

function parseJumlah(raw: string): number {
  const cleaned = raw.replace(/[^\d-]/g, '');
  if (!cleaned) return raw.trim() ? 1 : 0;
  const value = Number.parseInt(cleaned, 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatSummary(items: string[]): string {
  return Array.from(new Set(items.filter(Boolean))).join(', ');
}

function assignOtherPunishments(
  kategoriByUrutan: Map<number, { total: number; keterangan: string[] }>,
  unmatchedPunishments: Map<string, number>
) {
  const lainLain = Array.from(unmatchedPunishments.entries())
    .sort((a, b) => b[1] - a[1]);

  const first = lainLain[0];
  if (first) {
    const target = kategoriByUrutan.get(6)!;
    target.total = first[1];
    target.keterangan = [`${first[0]} (${first[1]})`];
  }

  const rest = lainLain.slice(1);
  if (rest.length > 0) {
    const target = kategoriByUrutan.get(7)!;
    target.total = rest.reduce((sum, [, total]) => sum + total, 0);
    target.keterangan = rest.map(([label, total]) => `${label} (${total})`);
  }
}

function getPelanggaranSeverityIndex(kode: string): number | null {
  const normalized = kode.trim().toUpperCase();
  if (normalized === 'PELANGGARAN_RINGAN' || normalized === 'L') return 0;
  if (normalized === 'PELANGGARAN_SEDANG' || normalized === 'M') return 1;
  if (normalized === 'PELANGGARAN_BERAT' || normalized === 'N') return 2;
  return null;
}

function addPunishmentCategory(
  kategoriByUrutan: Map<number, { total: number; keterangan: string[] }>,
  unmatchedPunishments: Map<string, number>,
  hukuman: string,
  amount: number
) {
  const normalized = hukuman.trim().toUpperCase();
  if (!normalized) return;

  if (normalized.includes('SP-1')) {
    kategoriByUrutan.get(3)!.total += amount;
    kategoriByUrutan.get(3)!.keterangan.push(hukuman);
  } else if (normalized.includes('SP-2') || normalized.includes('BOTAK')) {
    kategoriByUrutan.get(4)!.total += amount;
    kategoriByUrutan.get(4)!.keterangan.push(hukuman);
  } else if (normalized.includes('SP-3') || normalized.includes('PEMANGGILAN ORANG TUA')) {
    kategoriByUrutan.get(5)!.total += amount;
    kategoriByUrutan.get(5)!.keterangan.push(hukuman);
  } else {
    unmatchedPunishments.set(hukuman, (unmatchedPunishments.get(hukuman) ?? 0) + amount);
  }
}

function buildAkumulasiMap(
  seksiList: Seksi[],
  nilaiMap: Record<string, NilaiEntry>
): Record<string, NilaiEntry> {
  const akumulasi = seksiList.find((seksi) => seksi.kode === 'AKUMULASI');
  if (!akumulasi) return {};

  const kategoriByUrutan = new Map<number, { total: number; keterangan: string[] }>();
  for (let i = 0; i < 8; i += 1) {
    kategoriByUrutan.set(i, { total: 0, keterangan: [] });
  }

  const unmatchedPunishments = new Map<string, number>();
  const pelanggaranSeksi = seksiList.filter((seksi) => getPelanggaranSeverityIndex(seksi.kode) !== null);

  for (const seksi of pelanggaranSeksi) {
    const severityIndex = getPelanggaranSeverityIndex(seksi.kode);
    if (severityIndex === null) continue;

    for (const aspek of seksi.aspek) {
      const entry = nilaiMap[aspek.id];
      const rows = parseHukumanData(entry?.dataEkstra ?? '');
      let hasStructuredRows = false;

      for (const row of rows) {
        const amount = parseJumlah(row.jumlah);
        if (!amount && !row.namaPelanggaran && !row.hukuman) continue;
        hasStructuredRows = true;

        kategoriByUrutan.get(severityIndex)!.total += amount || 1;
        if (row.namaPelanggaran) {
          kategoriByUrutan.get(severityIndex)!.keterangan.push(row.namaPelanggaran);
        }

        const hukuman = row.hukuman.trim();
        if (!hukuman) continue;
        addPunishmentCategory(kategoriByUrutan, unmatchedPunishments, hukuman, amount || 1);
      }

      // Fallback untuk data lama yang tersimpan sebagai input biasa, bukan JSON row hukuman.
      if (!hasStructuredRows && entry && (entry.nilai || entry.dataEkstra)) {
        const amount = parseJumlah(entry.nilai || '');
        const safeAmount = amount || 1;
        kategoriByUrutan.get(severityIndex)!.total += safeAmount;
        kategoriByUrutan.get(severityIndex)!.keterangan.push(entry.dataEkstra || aspek.nama);

        if (entry.dataEkstra) {
          addPunishmentCategory(kategoriByUrutan, unmatchedPunishments, entry.dataEkstra, safeAmount);
        }
      }
    }
  }

  assignOtherPunishments(kategoriByUrutan, unmatchedPunishments);

  return Object.fromEntries(
    akumulasi.aspek.map((aspek) => {
      const kategori = kategoriByUrutan.get(aspek.urutan) ?? { total: 0, keterangan: [] };
      return [
        aspek.id,
        {
          nilai: kategori.total > 0 ? String(kategori.total) : '',
          dataEkstra: formatSummary(kategori.keterangan),
        },
      ];
    })
  );
}

// ─── Breadcrumb ────────────────────────────────────────────────────────────────
function Breadcrumb({ steps }: { steps: { label: string; onClick?: () => void }[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-gray-500 flex-wrap">
      {steps.map((s, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={12} className="text-gray-300 shrink-0" />}
          {s.onClick
            ? <button onClick={s.onClick} className="text-emerald-600 hover:underline font-medium">{s.label}</button>
            : <span className="text-gray-800 font-semibold">{s.label}</span>}
        </span>
      ))}
    </nav>
  );
}

// ─── Nilai Input Components ────────────────────────────────────────────────────
function PlusMinusInput({ nilai, onChange }: { nilai: string; onChange: (v: string) => void }) {
  const groups = [['A+', 'A', 'A-'], ['B+', 'B', 'B-'], ['C+', 'C', 'C-'], ['D']];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {groups.map((g, gi) => (
        <div key={gi} className="flex rounded-lg overflow-hidden border border-gray-200 shadow-sm">
          {g.map(opt => (
            <button key={opt} type="button" onClick={() => onChange(nilai === opt ? '' : opt)}
              className={`px-2.5 py-1.5 text-xs font-bold transition-all border-r border-gray-200 last:border-r-0 ${
                nilai === opt ? (BADGE[opt] || 'bg-gray-100') + ' shadow-inner' : 'bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-700'
              }`}>{opt}</button>
          ))}
        </div>
      ))}
      {nilai && <span className={`px-2 py-0.5 rounded text-xs font-bold ${BADGE[nilai] || 'bg-gray-100 text-gray-600'}`}>✓ {nilai}</span>}
    </div>
  );
}

function SimpleNilaiInput({ opts, nilai, onChange }: { opts: string[]; nilai: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {opts.map(opt => (
        <button key={opt} type="button" onClick={() => onChange(nilai === opt ? '' : opt)}
          className={`min-w-[2rem] h-7 px-2 rounded-lg text-xs font-bold border-2 transition-all ${
            nilai === opt ? (BADGE[opt] || 'bg-emerald-100 text-emerald-700 border-emerald-300') + ' scale-110 shadow-sm' : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-700'
          }`}>{opt}</button>
      ))}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function PenilaianRaportMentalPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('filter');

  // ── Filter state ──
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [seksiList, setSeksiList] = useState<Seksi[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState('');
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [loadingFilter, setLoadingFilter] = useState(true);
  const [errorFilter, setErrorFilter] = useState('');

  // ── Kelas state ──
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<Kelas | null>(null);
  const [loadingKelas, setLoadingKelas] = useState(false);
  const [searchKelas, setSearchKelas] = useState('');

  // ── Santri state ──
  const [santriList, setSantriList] = useState<Santri[]>([]);
  const [selectedSantri, setSelectedSantri] = useState<Santri | null>(null);
  const [loadingSantri, setLoadingSantri] = useState(false);
  const [searchSantri, setSearchSantri] = useState('');

  // ── Nilai state ──
  const [nilaiMap, setNilaiMap] = useState<Record<string, NilaiEntry>>({});
  const [activeSeksiId, setActiveSeksiId] = useState('');
  const [loadingNilai, setLoadingNilai] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState('');
  const [errorSeksi, setErrorSeksi] = useState('');

  // ── Derived ──
  const selectedSchoolYear = schoolYears.find(sy => sy.id === selectedSchoolYearId);
  const semesters = selectedSchoolYear?.semesters ?? [];
  const filteredKelas = kelasList.filter(k => k.name.toLowerCase().includes(searchKelas.toLowerCase()));
  const filteredSantri = santriList.filter(s =>
    s.name.toLowerCase().includes(searchSantri.toLowerCase()) ||
    s.studentNo.includes(searchSantri)
  );
  const akumulasiMap = useMemo(() => buildAkumulasiMap(seksiList, nilaiMap), [seksiList, nilaiMap]);

  // ─── Load awal: sekolah + seksi ────────────────────────────────────────────
  useEffect(() => {
    setLoadingFilter(true);
    Promise.all([
      fetch('/api/admin/schools?limit=50', { headers: authH() }).then(r => r.json()),
      fetch('/api/admin/raport-mental/seksi', { headers: authH() }).then(r => r.json()),
    ]).then(([sData, skData]) => {
      if (sData.success) {
        const schoolList: School[] = Array.isArray(sData.data) ? sData.data : (sData.data?.data ?? []);
        setSchools(schoolList);
        if (schoolList.length > 0) {
          setSelectedSchoolId(prev => prev || schoolList[0].id);
        }
      } else {
        setErrorFilter(sData.error || 'Gagal memuat data sekolah');
      }
      if (skData.success) {
        const list: Seksi[] = Array.isArray(skData.data) ? skData.data : [];
        setSeksiList(list);
        setActiveSeksiId(list[0]?.id ?? '');
      } else {
        setErrorSeksi(skData.error || 'Gagal memuat master data seksi');
      }
    }).catch(() => setErrorFilter('Gagal terhubung ke server'))
      .finally(() => setLoadingFilter(false));
  }, []);

  // ─── Load tahun ajaran sesuai sekolah terpilih ─────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const loadSchoolYears = async () => {
      setLoadingFilter(true);
      setErrorFilter('');
      setSchoolYears([]);
      setSelectedSchoolYearId('');
      setSelectedSemesterId('');
      setKelasList([]);
      setSantriList([]);
      setSelectedKelas(null);
      setSelectedSantri(null);
      setNilaiMap({});
      setStep('filter');

      try {
        const params = new URLSearchParams({ limit: '100' });
        if (selectedSchoolId) params.set('schoolId', selectedSchoolId);

        const res = await fetch(`/api/admin/school-years?${params}`, { headers: authH() });
        const data = await res.json();

        if (!data.success) {
          if (!cancelled) setErrorFilter(data.error || 'Gagal memuat tahun ajaran');
          return;
        }

        const years: SchoolYear[] = Array.isArray(data.data) ? data.data : (data.data?.data ?? []);
        if (cancelled) return;

        setSchoolYears(years);
        const active = years.find(y => y.isActive) ?? years[0];
        if (active) {
          setSelectedSchoolYearId(active.id);
          const sem = active.semesters?.find(s => s.isActive) ?? active.semesters?.[0];
          setSelectedSemesterId(sem?.id ?? '');
        }
      } catch {
        if (!cancelled) setErrorFilter('Gagal terhubung ke server');
      } finally {
        if (!cancelled) setLoadingFilter(false);
      }
    };

    loadSchoolYears();

    return () => {
      cancelled = true;
    };
  }, [selectedSchoolId]);

  // ─── Load kelas ketika filter lengkap ──────────────────────────────────────
  const loadKelas = useCallback(async () => {
    if (!selectedSchoolId || !selectedSchoolYearId || !selectedSemesterId) return;
    setLoadingKelas(true);
    setKelasList([]);
    try {
      const params = new URLSearchParams({
        schoolId: selectedSchoolId,
        schoolYearId: selectedSchoolYearId,
        semesterId: selectedSemesterId,
        limit: '100',
      });
      const res = await fetch(`/api/admin/classes?${params}`, { headers: authH() });
      const d = await res.json();
      if (d.success) {
        const classes: Kelas[] = Array.isArray(d.data) ? d.data : (d.data?.data ?? []);
        setKelasList(classes);
      }
    } catch (e) { console.error(e); }
    finally { setLoadingKelas(false); }
  }, [selectedSchoolId, selectedSchoolYearId, selectedSemesterId]);

  useEffect(() => {
    if (!selectedSchoolId || !selectedSchoolYearId || !selectedSemesterId) return;

    setSelectedKelas(null);
    setSelectedSantri(null);
    setSantriList([]);
    setNilaiMap({});
    setSearchKelas('');
    setSearchSantri('');
    setStep('filter');
    loadKelas();
  }, [selectedSchoolId, selectedSchoolYearId, selectedSemesterId, loadKelas]);

  // ─── Load santri ketika kelas dipilih ──────────────────────────────────────
  const loadSantri = useCallback(async (kelasId: string) => {
    setLoadingSantri(true);
    setSantriList([]);
    try {
      const res = await fetch(`/api/admin/classes/${kelasId}/students?limit=200`, { headers: authH() });
      const d = await res.json();
      if (d.success) {
        setSantriList(Array.isArray(d.data) ? d.data : (d.data?.data ?? []));
      }
    } catch (e) { console.error(e); }
    finally { setLoadingSantri(false); }
  }, []);

  // ─── Load nilai ketika santri dipilih ──────────────────────────────────────
  const loadNilai = useCallback(async (santri: Santri) => {
    if (!selectedSchoolYearId || !selectedSemesterId) return;
    setLoadingNilai(true);
    setNilaiMap({});
    try {
      const res = await fetch(
        `/api/admin/raport-mental/nilai?studentNo=${santri.studentNo}&schoolYearId=${selectedSchoolYearId}&semesterId=${selectedSemesterId}`,
        { headers: authH() }
      );
      const d = await res.json();
      if (d.success) {
        const map: Record<string, NilaiEntry> = {};
        for (const item of d.data) {
          map[item.aspekId] = { nilai: item.nilai ?? '', dataEkstra: item.dataEkstra ?? '' };
        }
        setNilaiMap(map);
      }
    } catch (e) { console.error(e); }
    finally { setLoadingNilai(false); }
  }, [selectedSchoolYearId, selectedSemesterId]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectKelas = (kelas: Kelas) => {
    setSelectedKelas(kelas);
    setSelectedSantri(null);
    setSearchSantri('');
    loadSantri(kelas.id);
    setStep('santri');
  };

  const handleSelectSantri = (santri: Santri) => {
    setSelectedSantri(santri);
    loadNilai(santri);
    setStep('nilai');
  };

  const handlePrintLaporan = (santri: Santri) => {
    if (!selectedSchoolId || !selectedSchoolYearId || !selectedSemesterId || !selectedKelas) return;

    const params = new URLSearchParams({
      studentNo: santri.studentNo,
      studentName: santri.name,
      className: selectedKelas.name,
      schoolId: selectedSchoolId,
      schoolYearId: selectedSchoolYearId,
      semesterId: selectedSemesterId,
      schoolYearLabel: selectedSchoolYear?.tahunAkademik || selectedSchoolYear?.year || '',
      semesterLabel: semesters.find(s => s.id === selectedSemesterId)?.semesterLabel || `Semester ${semesters.find(s => s.id === selectedSemesterId)?.number || ''}`,
    });

    router.push(`/admin/raport-mental/laporan?${params.toString()}`);
  };

  const goToStep = (s: Step) => {
    setStep(s);
    if (s === 'filter') { setSelectedKelas(null); setSelectedSantri(null); }
    if (s === 'kelas') { setSelectedSantri(null); }
    if (s === 'santri') { setSelectedSantri(null); loadSantri(selectedKelas!.id); }
  };

  const setNilai = (aspekId: string, nilai: string) =>
    setNilaiMap(p => ({ ...p, [aspekId]: { nilai, dataEkstra: p[aspekId]?.dataEkstra ?? '' } }));
  const setEkstra = (aspekId: string, dataEkstra: string) =>
    setNilaiMap(p => ({ ...p, [aspekId]: { nilai: p[aspekId]?.nilai ?? '', dataEkstra } }));
  const setPrestasiField = (aspekId: string, key: keyof PrestasiData, value: string) =>
    setNilaiMap(p => {
      const current = parsePrestasiData(p[aspekId]?.dataEkstra ?? '');
      return {
        ...p,
        [aspekId]: {
          nilai: p[aspekId]?.nilai ?? '',
          dataEkstra: stringifyPrestasiData({ ...current, [key]: value }),
        },
      };
    });
  const setHukumanField = (aspekId: string, rowIndex: number, key: keyof HukumanRow, value: string) =>
    setNilaiMap(p => {
      const current = parseHukumanData(p[aspekId]?.dataEkstra ?? '');
      const next = current.map((row, idx) => idx === rowIndex ? { ...row, [key]: value } : row);
      return {
        ...p,
        [aspekId]: {
          nilai: p[aspekId]?.nilai ?? '',
          dataEkstra: stringifyHukumanData(next),
        },
      };
    });
  const addHukumanRow = (aspekId: string) =>
    setNilaiMap(p => {
      const current = parseHukumanData(p[aspekId]?.dataEkstra ?? '');
      return {
        ...p,
        [aspekId]: {
          nilai: p[aspekId]?.nilai ?? '',
          dataEkstra: stringifyHukumanData([...current, createEmptyHukumanRow()]),
        },
      };
    });
  const removeHukumanRow = (aspekId: string, rowIndex: number) =>
    setNilaiMap(p => {
      const current = parseHukumanData(p[aspekId]?.dataEkstra ?? '');
      const next = current.filter((_, idx) => idx !== rowIndex);
      return {
        ...p,
        [aspekId]: {
          nilai: p[aspekId]?.nilai ?? '',
          dataEkstra: next.length > 0 ? stringifyHukumanData(next) : '',
        },
      };
    });

  const handleSave = async () => {
    if (!selectedSantri || !selectedSchoolYearId || !selectedSemesterId) return;
    setSaving(true); setSaveStatus('idle');
    try {
      const items: { aspekId: string; seksiId: string; nilai: string; dataEkstra: string }[] = [];
      for (const seksi of seksiList) {
        if (seksi.kode === 'AKUMULASI') continue;
        for (const aspek of seksi.aspek) {
          const e = nilaiMap[aspek.id];
          if (!e) continue;

          const fieldDataType = getFieldDataType(aspek);
          const shouldIncludeHukuman = fieldDataType === 'HUKUMAN'
            ? (e.nilai || hasHukumanContent(parseHukumanData(e.dataEkstra)))
            : (e.nilai || e.dataEkstra);

          if (shouldIncludeHukuman) {
            items.push({
              aspekId: aspek.id,
              seksiId: seksi.id,
              nilai: e.nilai || '',
              dataEkstra: fieldDataType === 'HUKUMAN' && !hasHukumanContent(parseHukumanData(e.dataEkstra))
                ? ''
                : (e.dataEkstra || ''),
            });
          }
        }
      }

      const akumulasiSeksi = seksiList.find((seksi) => seksi.kode === 'AKUMULASI');
      if (akumulasiSeksi) {
        for (const aspek of akumulasiSeksi.aspek) {
          const e = akumulasiMap[aspek.id];
          if (!e) continue;
          items.push({
            aspekId: aspek.id,
            seksiId: akumulasiSeksi.id,
            nilai: e.nilai || '',
            dataEkstra: e.dataEkstra || '',
          });
        }
      }

      const res = await fetch('/api/admin/raport-mental/nilai', {
        method: 'POST', headers: authH(),
        body: JSON.stringify({ studentNo: selectedSantri.studentNo, schoolYearId: selectedSchoolYearId, semesterId: selectedSemesterId, items }),
      });
      const d = await res.json();
      if (d.success) { setSaveStatus('success'); setSaveMsg(d.message || `${items.length} nilai tersimpan`); setTimeout(() => setSaveStatus('idle'), 4000); }
      else { setSaveStatus('error'); setSaveMsg(d.error || 'Gagal menyimpan'); }
    } catch { setSaveStatus('error'); setSaveMsg('Terjadi kesalahan'); }
    finally { setSaving(false); }
  };

  const filledCount = seksiList.reduce((total, seksi) => {
    const source = seksi.kode === 'AKUMULASI' ? akumulasiMap : nilaiMap;
    return total + seksi.aspek.filter(aspek => source[aspek.id]?.nilai || source[aspek.id]?.dataEkstra).length;
  }, 0);
  const totalAspek = seksiList.reduce((s, sk) => s + sk.aspek.length, 0);

  // ─── Breadcrumb steps ──────────────────────────────────────────────────────
  const breadcrumbSteps = [
    { label: 'Filter', onClick: step !== 'filter' ? () => goToStep('filter') : undefined },
    ...(step === 'kelas' || step === 'santri' || step === 'nilai' ? [{ label: selectedSchoolYear?.tahunAkademik || selectedSchoolYear?.year || '...', onClick: step !== 'kelas' ? () => goToStep('kelas') : undefined }] : []),
    ...(step === 'santri' || step === 'nilai' ? [{ label: selectedKelas?.name || '...', onClick: step !== 'santri' ? () => goToStep('santri') : undefined }] : []),
    ...(step === 'nilai' ? [{ label: selectedSantri?.name || '...' }] : []),
  ];

  // ══════════════ RENDER ══════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Brain size={28} className="text-emerald-600" />
            <h1 className="text-3xl font-bold text-gray-900">Penilaian Santri Raport Mental</h1>
          </div>
          <div>
            <p className="text-gray-600 mt-2">Pilih periode, kelas, dan santri untuk mengisi penilaian raport mental.</p>
            <div className="mt-2">
              <Breadcrumb steps={breadcrumbSteps} />
            </div>
          </div>
        </div>
        {/* Save button - only on nilai step */}
        {step === 'nilai' && selectedSantri && (
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
              saveStatus === 'success' ? 'bg-green-500 text-white' :
              saveStatus === 'error'   ? 'bg-red-500 text-white' :
              'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60'
            }`}>
            {saveStatus === 'success' ? <><CheckCircle size={16} />{saveMsg}</> :
             saveStatus === 'error'   ? <><AlertCircle size={16} />{saveMsg}</> :
             saving ? <><RefreshCw size={16} className="animate-spin" />Menyimpan...</> :
             <><Save size={16} />Simpan Penilaian</>}
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 1: FILTER (Sekolah, Tahun Ajaran, Semester)
      ═══════════════════════════════════════════════════════════════════════ */}
      {step === 'filter' && (
        <>
        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filter & Pencarian</h2>
          </div>

          {loadingFilter ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="animate-spin text-emerald-500 mr-2" size={20} />
              <span className="text-sm text-gray-500">Memuat data...</span>
            </div>
          ) : (
            <>
              {errorFilter && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  <AlertCircle size={16} /> {errorFilter}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Sekolah */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    <Building2 size={14} className="inline mr-1.5" />Sekolah
                  </label>
                  <select value={selectedSchoolId} onChange={e => setSelectedSchoolId(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-900 bg-white">
                    <option value="">-- Pilih Sekolah --</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* Tahun Ajaran */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Tahun Ajaran
                  </label>
                  <select value={selectedSchoolYearId}
                    onChange={e => {
                      setSelectedSchoolYearId(e.target.value);
                      const sy = schoolYears.find(y => y.id === e.target.value);
                      const sem = sy?.semesters?.find(s => s.isActive) ?? sy?.semesters?.[0];
                      setSelectedSemesterId(sem?.id ?? '');
                    }}
                    disabled={!selectedSchoolId}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-900 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed">
                    <option value="">-- Pilih Tahun --</option>
                    {schoolYears.map(sy => (
                      <option key={sy.id} value={sy.id}>{sy.tahunAkademik || sy.year}{sy.isActive ? ' ✓' : ''}</option>
                    ))}
                  </select>
                </div>

                {/* Semester */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Semester
                  </label>
                  <select value={selectedSemesterId} onChange={e => setSelectedSemesterId(e.target.value)}
                    disabled={!selectedSchoolYearId}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-900 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed">
                    <option value="">-- Pilih Semester --</option>
                    {semesters.map(sm => (
                      <option key={sm.id} value={sm.id}>{sm.semesterLabel || `Semester ${sm.number}`}{sm.isActive ? ' ✓' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-sm text-gray-500 pt-2">
                Daftar kelas akan tampil otomatis setelah sekolah, tahun ajaran, dan semester dipilih.
              </p>
            </>
          )}
        </div>

        {(selectedSchoolId && selectedSchoolYearId && selectedSemesterId) && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">Daftar Kelas</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedSchoolYear?.tahunAkademik || selectedSchoolYear?.year} ·{' '}
                  {semesters.find(s => s.id === selectedSemesterId)?.semesterLabel ||
                   `Semester ${semesters.find(s => s.id === selectedSemesterId)?.number}`}
                </p>
              </div>
              <div className="relative w-48">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={searchKelas} onChange={e => setSearchKelas(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 font-medium bg-white"
                  placeholder="Cari kelas..." />
              </div>
            </div>

            {loadingKelas ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="animate-spin text-emerald-500 mr-2" size={20} />
                <span className="text-sm text-gray-500">Memuat daftar kelas...</span>
              </div>
            ) : filteredKelas.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Users size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-gray-600 text-lg font-medium">Tidak ada kelas ditemukan</p>
                <p className="text-gray-500 text-sm mt-2">Coba ubah filter periode atau sekolah</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Kelas</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Jumlah Siswa</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredKelas.map(kelas => (
                      <tr key={kelas.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{kelas.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{kelas._count?.students ?? 0} siswa</td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => handleSelectKelas(kelas)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors font-medium"
                          >
                            Pilih
                            <ChevronRight size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 3: DAFTAR SANTRI dalam Kelas
      ═══════════════════════════════════════════════════════════════════════ */}
      {step === 'santri' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
            <button onClick={() => goToStep('kelas')} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft size={16} className="text-gray-500" />
            </button>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">Kelas {selectedKelas?.name}</h2>
              <p className="text-sm text-gray-600 mt-1">Pilih santri untuk mengisi nilai</p>
            </div>
            {/* Search santri */}
            <div className="relative w-52">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={searchSantri} onChange={e => setSearchSantri(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 font-medium bg-white"
                placeholder="Cari nama / stambuk..." />
            </div>
          </div>

          {loadingSantri ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="animate-spin text-emerald-500 mr-2" size={20} />
              <span className="text-sm text-gray-500">Memuat daftar santri...</span>
            </div>
          ) : filteredSantri.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <User size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-gray-600 text-lg font-medium">Tidak ada santri ditemukan</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Santri</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">No. Stambuk</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
              {filteredSantri.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{idx + 1}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{s.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{s.studentNo}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSelectSantri(s)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors font-medium"
                        >
                          Isi Nilai
                          <ChevronRight size={16} />
                        </button>
                        <button
                          onClick={() => handlePrintLaporan(s)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors font-medium"
                        >
                          <Printer size={15} />
                          Cetak Laporan
                        </button>
                      </div>
                    </td>
                  </tr>
              ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          STEP 4: FORM INPUT NILAI
      ═══════════════════════════════════════════════════════════════════════ */}
      {step === 'nilai' && selectedSantri && (
        <>
          {/* Info santri terpilih */}
          <div className="bg-white rounded-lg shadow-md p-6 flex items-center gap-4">
            <button onClick={() => goToStep('santri')} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
              <ArrowLeft size={16} className="text-gray-500" />
            </button>
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {selectedSantri.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-gray-900 truncate">{selectedSantri.name}</p>
              <p className="text-sm text-gray-600">No. {selectedSantri.studentNo} · Kelas {selectedKelas?.name}</p>
            </div>
            {/* Progress */}
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-700">{filledCount}/{totalAspek} aspek</p>
              <div className="w-28 h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${totalAspek > 0 ? (filledCount / totalAspek) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          {/* Error seksi */}
          {errorSeksi && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
              <div>
                <p><strong>Master Data Seksi:</strong> {errorSeksi}</p>
                <p className="text-xs mt-0.5 text-amber-600">Kemungkinan tabel belum dibuat. Jalankan migration SQL di Supabase SQL Editor.</p>
              </div>
            </div>
          )}

          {/* Loading nilai */}
          {loadingNilai ? (
            <div className="flex items-center justify-center py-16 bg-white rounded-lg shadow-md">
              <RefreshCw className="animate-spin text-emerald-500 mr-2" size={20} />
              <span className="text-sm text-gray-500">Memuat data penilaian...</span>
            </div>
          ) : seksiList.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md border border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-500">Belum ada master data seksi. Silakan isi di <strong>Master Data</strong> terlebih dahulu.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="border-b border-gray-200 px-4 py-4">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {seksiList.map((seksi, idx) => {
                      const source = seksi.kode === 'AKUMULASI' ? akumulasiMap : nilaiMap;
                      const filled = seksi.aspek.filter(a => source[a.id]?.nilai || source[a.id]?.dataEkstra).length;
                      const isActive = seksi.id === activeSeksiId;
                      return (
                        <button
                          key={seksi.id}
                          type="button"
                          onClick={() => setActiveSeksiId(seksi.id)}
                          className={`min-w-fit rounded-lg border px-4 py-2 text-left transition-colors ${
                            isActive
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                              isActive ? 'bg-white text-emerald-600' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {idx + 1}
                            </span>
                            <span className="text-sm font-medium">{seksi.nama}</span>
                          </div>
                          <p className={`mt-1 text-xs ${isActive ? 'text-emerald-50' : 'text-gray-500'}`}>
                            {filled}/{seksi.aspek.length} aspek terisi
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {(() => {
                  const activeSeksi = seksiList.find(seksi => seksi.id === activeSeksiId) ?? seksiList[0];
                  if (!activeSeksi) return null;

                  const opts = NILAI_OPTIONS[activeSeksi.tipeNilai] ?? [];
                  const isPM = activeSeksi.tipeNilai === 'NILAI_PLUS_MINUS';

                  return (
                    <div className="divide-y divide-gray-50">
                      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <h3 className="text-base font-semibold text-gray-900">{activeSeksi.nama}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {(activeSeksi.kode === 'AKUMULASI'
                            ? activeSeksi.aspek.filter(a => akumulasiMap[a.id]?.nilai || akumulasiMap[a.id]?.dataEkstra).length
                            : activeSeksi.aspek.filter(a => nilaiMap[a.id]?.nilai || nilaiMap[a.id]?.dataEkstra).length)}/{activeSeksi.aspek.length} aspek terisi
                        </p>
                      </div>
                      {activeSeksi.kode === 'AKUMULASI' ? (
                        <div className="px-6 py-5">
                          <div className="overflow-hidden rounded-xl border border-gray-200">
                            <div className="grid grid-cols-[64px_minmax(0,1fr)_140px_280px] gap-0 bg-gray-100 text-xs font-semibold uppercase tracking-wider text-gray-500">
                              <div className="border-r border-gray-200 px-4 py-3 text-center">No</div>
                              <div className="border-r border-gray-200 px-4 py-3">Jenis Pelanggaran</div>
                              <div className="border-r border-gray-200 px-4 py-3">Jumlah</div>
                              <div className="px-4 py-3">Ket</div>
                            </div>
                            {activeSeksi.aspek.map((aspek, aidx) => {
                              const entry = akumulasiMap[aspek.id] ?? { nilai: '', dataEkstra: '' };
                              const isFilled = !!(entry.nilai || entry.dataEkstra);
                              return (
                                <div
                                  key={aspek.id}
                                  className={`grid grid-cols-[64px_minmax(0,1fr)_140px_280px] gap-0 border-t border-gray-200 ${isFilled ? 'bg-emerald-50/40' : 'bg-white'}`}
                                >
                                  <div className="flex items-start justify-center border-r border-gray-200 px-3 py-4 text-sm font-semibold text-gray-500">
                                    {aidx + 1}
                                  </div>
                                  <div className="border-r border-gray-200 px-4 py-4">
                                    <p className="text-sm font-medium text-gray-900">{aspek.nama}</p>
                                  </div>
                                  <div className="border-r border-gray-200 px-4 py-4">
                                    <input
                                      type="number"
                                      min={0}
                                      value={entry.nilai}
                                      readOnly
                                      className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm text-gray-900 bg-gray-50"
                                      placeholder="0"
                                    />
                                  </div>
                                  <div className="px-4 py-4">
                                    <div className="min-h-[72px] rounded-lg border-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-900">
                                      {entry.dataEkstra ? (
                                        <div className="space-y-1">
                                          {entry.dataEkstra.split(', ').map((item, idx) => (
                                            <div key={`${aspek.id}-${idx}`} className="break-words">
                                              {item}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-gray-400">Tidak ada keterangan</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="mt-3 text-xs text-gray-500">
                            Nilai akumulasi dihitung otomatis dari input pada tab pelanggaran dan hukuman.
                          </p>
                        </div>
                      ) : activeSeksi.kode === 'PENILAIAN_AKHIR' ? (
                        <div className="space-y-5 px-6 py-5">
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">
                            Dengan mempertimbangkan berbagai aspek serta menelaah raport mental dari beragam sudut pandang
                            dalam setiap ranah kegiatan secara menyeluruh, maka secara keseluruhan raport ananda dinilai:
                            <span className="font-semibold"> pilih nilai akhir A / B / C / D / E</span>.
                            Semoga hasil ini dapat menjadi bahan evaluasi yang bermanfaat demi kebaikan dan kemajuan bersama,
                            khususnya untuk perkembangan ananda ke arah yang lebih baik.
                          </div>
                          <div className="grid gap-5">
                            {activeSeksi.aspek.map((aspek) => {
                              const entry = nilaiMap[aspek.id] ?? { nilai: '', dataEkstra: '' };
                              return (
                                <div key={aspek.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                  <div className="mb-4">
                                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800">{aspek.nama}</h4>
                                    <p className="mt-1 text-sm text-slate-500">Pilih satu nilai akhir untuk keseluruhan raport mental.</p>
                                  </div>
                                  <div className="flex flex-wrap gap-3">
                                    {['A', 'B', 'C', 'D', 'E'].map((opt) => (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => setNilai(aspek.id, entry.nilai === opt ? '' : opt)}
                                        className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-lg font-bold transition-all ${
                                          entry.nilai === opt
                                            ? 'border-emerald-500 bg-emerald-500 text-white shadow-md'
                                            : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-400'
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                      <>
                      <div className="grid gap-3 px-6 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                        style={{ gridTemplateColumns: opts.length > 0 ? (isPM ? '1fr 2fr' : '2fr 1fr') : '1fr' }}>
                        <span>Aspek</span>
                        <span>{opts.length > 0 ? 'Nilai' : (activeSeksi.tipeNilai === 'ANGKA' ? 'Jumlah' : 'Keterangan')}</span>
                      </div>
                      {activeSeksi.aspek.map((aspek, aidx) => {
                        const entry = nilaiMap[aspek.id] ?? { nilai: '', dataEkstra: '' };
                        const isFilled = !!(entry.nilai || entry.dataEkstra);
                        const fieldDataType = getFieldDataType(aspek);
                        const prestasiData = fieldDataType === 'PRESTASI' ? parsePrestasiData(entry.dataEkstra) : null;
                        const hukumanRows = fieldDataType === 'HUKUMAN' ? parseHukumanData(entry.dataEkstra) : null;
                        const isAkumulasi = activeSeksi.kode === 'AKUMULASI';
                        const isPenilaianUmum =
                          activeSeksi.kode === 'CATATAN_POSITIF' ||
                          activeSeksi.kode === 'CATATAN_NEGATIF' ||
                          activeSeksi.kode === 'P' ||
                          activeSeksi.nama.toUpperCase().includes('PENILAIAN UMUM');
                        const isPositiveNote =
                          aspek.nama.toUpperCase().includes('POSITIF') ||
                          aspek.nama.toUpperCase().includes('AFIRMASI') ||
                          aspek.nama.toUpperCase().includes('APRESIASI');
                        return (
                          <div key={aspek.id}
                            className={`grid gap-4 px-6 py-4 items-start ${isFilled ? 'bg-emerald-50/40' : 'hover:bg-gray-50'}`}
                            style={{ gridTemplateColumns: opts.length > 0 ? (isPM ? '1fr 2fr' : '2fr 1fr') : '1fr' }}>
                            <div className="flex items-start gap-2 pt-1">
                              <span className={`text-xs shrink-0 w-5 text-right font-mono mt-0.5 ${isFilled ? 'text-emerald-500' : 'text-gray-400'}`}>{aidx + 1}.</span>
                              <div className="min-w-0">
                                <span className="text-sm font-medium text-gray-900">{aspek.nama}</span>
                              </div>
                            </div>
                            <div className="pt-1">
                              {fieldDataType === 'TEXT' ? (
                                isPenilaianUmum ? (
                                  <div className={`rounded-2xl border p-4 ${isPositiveNote ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'}`}>
                                    <label className={`mb-2 block text-[11px] font-semibold uppercase tracking-wider ${isPositiveNote ? 'text-emerald-700' : 'text-rose-700'}`}>
                                      {isPositiveNote ? 'Catatan Positif' : 'Catatan Negatif'}
                                    </label>
                                    <textarea
                                      value={entry.dataEkstra}
                                      onChange={e => setEkstra(aspek.id, e.target.value)}
                                      rows={5}
                                      className="w-full rounded-xl border-2 border-white bg-white px-4 py-3 text-sm leading-6 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                                      placeholder={isPositiveNote
                                        ? 'Tulis afirmasi, apresiasi, atau catatan positif...'
                                        : 'Tulis evaluasi, perhatian khusus, atau catatan negatif...'}
                                    />
                                  </div>
                                ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                                      {isAkumulasi ? 'Ket' : 'Data Pendukung'}
                                    </label>
                                    <input
                                      type="text"
                                      value={entry.dataEkstra}
                                      onChange={e => setEkstra(aspek.id, e.target.value)}
                                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm text-gray-900 bg-white"
                                      placeholder={isAkumulasi ? 'Isi keterangan...' : 'Isi data pendukung...'}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                                      {isAkumulasi ? 'Jumlah' : 'Nilai'}
                                    </label>
                                    {isPM ? <PlusMinusInput nilai={entry.nilai} onChange={v => setNilai(aspek.id, v)} /> :
                                     opts.length > 0 ? <SimpleNilaiInput opts={opts} nilai={entry.nilai} onChange={v => setNilai(aspek.id, v)} /> :
                                     <input type={activeSeksi.tipeNilai === 'ANGKA' ? 'number' : 'text'}
                                       value={entry.nilai} onChange={e => setNilai(aspek.id, e.target.value)} min={0}
                                       className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm text-gray-900 bg-white"
                                       placeholder={activeSeksi.tipeNilai === 'ANGKA' ? '0' : (isAkumulasi ? 'Isi jumlah...' : 'Isi nilai...')} />}
                                  </div>
                                </div>
                                )
                              ) : fieldDataType === 'PRESTASI' && prestasiData ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                                      Bidang / Divisi
                                    </label>
                                    <input
                                      type="text"
                                      value={prestasiData.bidangDivisi}
                                      onChange={e => setPrestasiField(aspek.id, 'bidangDivisi', e.target.value)}
                                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm text-gray-900 bg-white"
                                      placeholder="Bidang / Divisi"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                                      Juara
                                    </label>
                                    <input
                                      type="text"
                                      value={prestasiData.juara}
                                      onChange={e => setPrestasiField(aspek.id, 'juara', e.target.value)}
                                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm text-gray-900 bg-white"
                                      placeholder="Juara"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                                      Nilai
                                    </label>
                                    {isPM ? <PlusMinusInput nilai={entry.nilai} onChange={v => setNilai(aspek.id, v)} /> :
                                     opts.length > 0 ? <SimpleNilaiInput opts={opts} nilai={entry.nilai} onChange={v => setNilai(aspek.id, v)} /> :
                                     <input type={activeSeksi.tipeNilai === 'ANGKA' ? 'number' : 'text'}
                                       value={entry.nilai} onChange={e => setNilai(aspek.id, e.target.value)} min={0}
                                       className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm text-gray-900 bg-white"
                                      placeholder={activeSeksi.tipeNilai === 'ANGKA' ? '0' : 'Isi nilai...'} />}
                                  </div>
                                </div>
                              ) : fieldDataType === 'HUKUMAN' && hukumanRows ? (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                      Daftar Pelanggaran / Hukuman
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => addHukumanRow(aspek.id)}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                    >
                                      <Plus size={14} />
                                      Tambah Row
                                    </button>
                                  </div>
                                  <div className="space-y-3">
                                    {hukumanRows.map((row, rowIdx) => (
                                      <div key={`${aspek.id}-${rowIdx}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                          <span className="text-xs font-semibold text-gray-500">Row {rowIdx + 1}</span>
                                          <button
                                            type="button"
                                            onClick={() => removeHukumanRow(aspek.id, rowIdx)}
                                            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                                          >
                                            <Trash2 size={14} />
                                            Hapus
                                          </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                          <div>
                                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                                              Nama Pelanggaran
                                            </label>
                                            <input
                                              type="text"
                                              value={row.namaPelanggaran}
                                              onChange={e => setHukumanField(aspek.id, rowIdx, 'namaPelanggaran', e.target.value)}
                                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm text-gray-900 bg-white"
                                              placeholder="Nama pelanggaran"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                                              Hukuman
                                            </label>
                                            <input
                                              type="text"
                                              value={row.hukuman}
                                              onChange={e => setHukumanField(aspek.id, rowIdx, 'hukuman', e.target.value)}
                                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm text-gray-900 bg-white"
                                              placeholder="Jenis hukuman / tindakan"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                                              Jumlah
                                            </label>
                                            <input
                                              type="text"
                                              value={row.jumlah}
                                              onChange={e => setHukumanField(aspek.id, rowIdx, 'jumlah', e.target.value)}
                                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm text-gray-900 bg-white"
                                              placeholder="Jumlah"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                                    Nilai
                                  </label>
                                  {isPM ? <PlusMinusInput nilai={entry.nilai} onChange={v => setNilai(aspek.id, v)} /> :
                                   opts.length > 0 ? <SimpleNilaiInput opts={opts} nilai={entry.nilai} onChange={v => setNilai(aspek.id, v)} /> :
                                   <input type={activeSeksi.tipeNilai === 'ANGKA' ? 'number' : 'text'}
                                     value={entry.nilai} onChange={e => setNilai(aspek.id, e.target.value)} min={0}
                                     className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm text-gray-900 bg-white"
                                     placeholder={activeSeksi.tipeNilai === 'ANGKA' ? '0' : 'Isi keterangan...'} />}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      </>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Sticky Save */}
              <div className="sticky bottom-4 flex justify-end pt-2">
                <button onClick={handleSave} disabled={saving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-md ${
                    saveStatus === 'success' ? 'bg-green-500 text-white' :
                    saveStatus === 'error'   ? 'bg-red-500 text-white' :
                    'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60'
                  }`}>
                  {saveStatus === 'success' ? <><CheckCircle size={16} />Tersimpan!</> :
                   saveStatus === 'error'   ? <><AlertCircle size={16} />Gagal</> :
                   saving ? <><RefreshCw size={16} className="animate-spin" />Menyimpan...</> :
                   <><Save size={16} />Simpan ({filledCount} terisi)</>}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
