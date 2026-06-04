'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronDown, ChevronRight, Edit2, Trash2, GripVertical, CheckCircle, XCircle, BookOpen, List } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { devError } from '@/lib/dev-log';

interface Aspek {
  id: string;
  seksiId: string;
  nama: string;
  keterangan: string | null;
  urutan: number;
  punyaFieldData: boolean;
  fieldDataType?: 'NONE' | 'TEXT' | 'PRESTASI' | 'HUKUMAN';
  isActive: boolean;
}

interface Seksi {
  id: string;
  nama: string;
  kode: string;
  deskripsi: string | null;
  urutan: number;
  tipeNilai: 'NILAI_ABCD' | 'NILAI_ABCDE' | 'NILAI_PLUS_MINUS' | 'TEXT' | 'ANGKA';
  isActive: boolean;
  aspek: Aspek[];
}

const TIPE_NILAI_LABELS = {
  NILAI_ABCD:        'A / B / C / D',
  NILAI_ABCDE:       'A / B / C / D / E',
  NILAI_PLUS_MINUS:  'A+ / A / A- / B+ / B / B- / C+ / C / C- / D',
  TEXT:              'Teks Bebas',
  ANGKA:             'Angka / Jumlah',
};

const TIPE_NILAI_COLORS = {
  NILAI_ABCD:        'bg-blue-100 text-blue-700',
  NILAI_ABCDE:       'bg-purple-100 text-purple-700',
  NILAI_PLUS_MINUS:  'bg-teal-100 text-teal-700',
  TEXT:              'bg-amber-100 text-amber-700',
  ANGKA:             'bg-rose-100 text-rose-700',
};

const FIELD_DATA_TYPE_LABELS = {
  NONE: 'Tanpa Data Tambahan',
  TEXT: 'Data Teks',
  PRESTASI: 'Prestasi: Bidang/Divisi + Juara',
  HUKUMAN: 'Hukuman: Nama Pelanggaran + Hukuman + Jumlah',
};

// ─── Modal Tambah/Edit Seksi ────────────────────────────────────────────────
function SeksiModal({
  open, onClose, seksi, onSave,
}: { open: boolean; onClose: () => void; seksi: Seksi | null; onSave: () => void }) {
  const [form, setForm] = useState({ nama: '', kode: '', deskripsi: '', tipeNilai: 'NILAI_ABCD', urutan: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (seksi) {
      setForm({ nama: seksi.nama, kode: seksi.kode, deskripsi: seksi.deskripsi || '', tipeNilai: seksi.tipeNilai, urutan: String(seksi.urutan) });
    } else {
      setForm({ nama: '', kode: '', deskripsi: '', tipeNilai: 'NILAI_ABCD', urutan: '' });
    }
  }, [seksi, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = seksi ? `/api/admin/raport-mental/seksi/${seksi.id}` : '/api/admin/raport-mental/seksi';
      const method = seksi ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, urutan: form.urutan !== '' ? parseInt(form.urutan) : undefined }),
      });
      const data = await res.json();
      if (!data.success) { alert(data.error || 'Gagal menyimpan'); return; }
      onSave();
      onClose();
    } catch { alert('Terjadi kesalahan'); }
    finally { setLoading(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
          <h2 className="text-lg font-bold text-white">{seksi ? 'Edit Seksi' : 'Tambah Seksi Baru'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Nama Seksi *</label>
            <input value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Contoh: Mental Kepribadian-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Kode *</label>
              <input value={form.kode} onChange={e => setForm(f => ({ ...f, kode: e.target.value.toUpperCase() }))} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="MK1" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Urutan</label>
              <input type="number" value={form.urutan} onChange={e => setForm(f => ({ ...f, urutan: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Tipe Nilai</label>
            <select value={form.tipeNilai} onChange={e => setForm(f => ({ ...f, tipeNilai: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {Object.entries(TIPE_NILAI_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Deskripsi</label>
            <textarea value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Keterangan tambahan (opsional)" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Tambah/Edit Aspek ────────────────────────────────────────────────
function AspekModal({
  open, onClose, aspek, seksiId, onSave,
}: { open: boolean; onClose: () => void; aspek: Aspek | null; seksiId: string; onSave: () => void }) {
  const [form, setForm] = useState({ nama: '', keterangan: '', urutan: '', punyaFieldData: false, fieldDataType: 'NONE' as 'NONE' | 'TEXT' | 'PRESTASI' | 'HUKUMAN' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (aspek) {
      const fieldDataType = aspek.fieldDataType || (aspek.punyaFieldData ? 'TEXT' : 'NONE');
      setForm({ nama: aspek.nama, keterangan: aspek.keterangan || '', urutan: String(aspek.urutan), punyaFieldData: aspek.punyaFieldData, fieldDataType });
    } else {
      setForm({ nama: '', keterangan: '', urutan: '', punyaFieldData: false, fieldDataType: 'NONE' });
    }
  }, [aspek, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = aspek ? `/api/admin/raport-mental/aspek/${aspek.id}` : '/api/admin/raport-mental/aspek';
      const method = aspek ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          seksiId,
          punyaFieldData: form.fieldDataType !== 'NONE',
          urutan: form.urutan !== '' ? parseInt(form.urutan) : undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) { alert(data.error || 'Gagal menyimpan'); return; }
      onSave();
      onClose();
    } catch { alert('Terjadi kesalahan'); }
    finally { setLoading(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-4">
          <h2 className="text-lg font-bold text-white">{aspek ? 'Edit Aspek' : 'Tambah Aspek Baru'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Nama Aspek *</label>
            <input value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Contoh: Kedisiplinan" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Urutan</label>
              <input type="number" value={form.urutan} onChange={e => setForm(f => ({ ...f, urutan: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Format Data</label>
              <select
                value={form.fieldDataType}
                onChange={e => setForm(f => ({ ...f, fieldDataType: e.target.value as 'NONE' | 'TEXT' | 'PRESTASI' | 'HUKUMAN', punyaFieldData: e.target.value !== 'NONE' }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {Object.entries(FIELD_DATA_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Keterangan</label>
            <textarea value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Penjelasan tambahan (opsional)" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Batal</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Halaman Utama ───────────────────────────────────────────────────────────
export default function RaportMentalMasterPage() {
  const router = useRouter();
  const pathname = usePathname();
  const mentalBasePath = pathname.startsWith('/teacher')
    ? '/teacher/raport-mental'
    : pathname.startsWith('/wali-kelas')
      ? '/wali-kelas/raport-mental'
      : '/admin/raport-mental';
  const [seksiList, setSeksiList] = useState<Seksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [seksiModal, setSeksiModal] = useState<{ open: boolean; data: Seksi | null }>({ open: false, data: null });
  const [aspekModal, setAspekModal] = useState<{ open: boolean; data: Aspek | null; seksiId: string }>({ open: false, data: null, seksiId: '' });
  const [includeInactive, setIncludeInactive] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/raport-mental/seksi?includeInactive=${includeInactive}`);
      const data = await res.json();
      if (data.success) {
        setSeksiList(data.data);
        // Auto-expand semua seksi
        setExpandedIds(new Set(data.data.map((s: Seksi) => s.id)));
      }
    } catch {
      devError('Gagal memuat data');
    }
    finally { setLoading(false); }
  }, [includeInactive]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSeksi = async (seksi: Seksi) => {
    if (!confirm(`Yakin hapus seksi "${seksi.nama}"? Semua aspek dan nilai di dalamnya akan ikut terhapus.`)) return;
    await apiFetch(`/api/admin/raport-mental/seksi/${seksi.id}`, { method: 'DELETE' });
    void fetchData();
  };

  const handleDeleteAspek = async (aspek: Aspek) => {
    if (!confirm(`Yakin hapus aspek "${aspek.nama}"?`)) return;
    await apiFetch(`/api/admin/raport-mental/aspek/${aspek.id}`, { method: 'DELETE' });
    void fetchData();
  };

  const totalAspek = seksiList.reduce((sum, s) => sum + s.aspek.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Data Raport Mental</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola seksi penilaian dan aspek di dalamnya</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`${mentalBasePath}/penilaian`)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            <BookOpen size={15} /> Penilaian Santri
          </button>
          <button
            onClick={() => setSeksiModal({ open: true, data: null })}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus size={15} /> Tambah Seksi
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Seksi', value: seksiList.length, icon: List, color: 'text-emerald-600' },
          { label: 'Total Aspek', value: totalAspek, icon: GripVertical, color: 'text-teal-600' },
          { label: 'Seksi Aktif', value: seksiList.filter(s => s.isActive).length, icon: CheckCircle, color: 'text-blue-600' },
          { label: 'Seksi Nonaktif', value: seksiList.filter(s => !s.isActive).length, icon: XCircle, color: 'text-red-500' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <stat.icon className={`${stat.color} shrink-0`} size={20} />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
          <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} className="rounded" />
          Tampilkan yang nonaktif
        </label>
      </div>

      {/* List Seksi */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Memuat data master...</p>
          </div>
        </div>
      ) : seksiList.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <List className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-gray-500 font-medium">Belum ada seksi penilaian</p>
          <p className="text-sm text-gray-400 mt-1">Klik &quot;Tambah Seksi&quot; untuk memulai, atau jalankan seed script</p>
          <button onClick={() => setSeksiModal({ open: true, data: null })}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
            <Plus size={14} /> Tambah Seksi Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {seksiList.map((seksi, idx) => (
            <div key={seksi.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${!seksi.isActive ? 'opacity-60 border-gray-200' : 'border-gray-100'}`}>
              {/* Seksi Header */}
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => toggleExpand(seksi.id)}>
                <GripVertical size={16} className="text-gray-300 shrink-0" />
                <span className="text-xs font-semibold text-gray-400 w-5 text-center">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{seksi.nama}</span>
                    <span className="font-mono text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{seksi.kode}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPE_NILAI_COLORS[seksi.tipeNilai]}`}>
                      {TIPE_NILAI_LABELS[seksi.tipeNilai]}
                    </span>
                    {!seksi.isActive && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Nonaktif</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{seksi.aspek.length} aspek</p>
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setSeksiModal({ open: true, data: seksi })}
                    className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 transition-colors" title="Edit seksi">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDeleteSeksi(seksi)}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title="Hapus seksi">
                    <Trash2 size={14} />
                  </button>
                  <button onClick={() => setAspekModal({ open: true, data: null, seksiId: seksi.id })}
                    className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 transition-colors" title="Tambah aspek">
                    <Plus size={14} />
                  </button>
                </div>
                <div className="text-gray-400 shrink-0">
                  {expandedIds.has(seksi.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
              </div>

              {/* Aspek List */}
              {expandedIds.has(seksi.id) && (
                <div className="border-t border-gray-100">
                  {seksi.aspek.length === 0 ? (
                    <div className="px-10 py-4 text-sm text-gray-400 italic text-center">
                      Belum ada aspek.
                      <button onClick={() => setAspekModal({ open: true, data: null, seksiId: seksi.id })}
                        className="ml-2 text-emerald-600 font-medium hover:underline">Tambah aspek</button>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {seksi.aspek.map((aspek, aidx) => (
                        <div key={aspek.id} className={`flex items-center gap-3 px-10 py-2.5 hover:bg-gray-50 group ${!aspek.isActive ? 'opacity-50' : ''}`}>
                          <span className="text-xs text-gray-400 w-5 text-right shrink-0">{aidx + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-800">{aspek.nama}</span>
                            {((aspek.fieldDataType || (aspek.punyaFieldData ? 'TEXT' : 'NONE')) !== 'NONE') && (
                              <span className="ml-2 text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">
                                {(aspek.fieldDataType || (aspek.punyaFieldData ? 'TEXT' : 'NONE')) === 'PRESTASI'
                                  ? 'Prestasi'
                                  : (aspek.fieldDataType || (aspek.punyaFieldData ? 'TEXT' : 'NONE')) === 'HUKUMAN'
                                    ? 'Hukuman'
                                    : '+ Data'}
                              </span>
                            )}
                            {aspek.keterangan && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate">{aspek.keterangan}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setAspekModal({ open: true, data: aspek, seksiId: seksi.id })}
                              className="p-1 hover:bg-blue-50 rounded text-blue-500" title="Edit aspek">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => handleDeleteAspek(aspek)}
                              className="p-1 hover:bg-red-50 rounded text-red-500" title="Hapus aspek">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Tombol tambah aspek di bawah */}
                  <div className="px-10 py-2 border-t border-gray-50">
                    <button onClick={() => setAspekModal({ open: true, data: null, seksiId: seksi.id })}
                      className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                      <Plus size={12} /> Tambah Aspek
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <SeksiModal
        open={seksiModal.open}
        onClose={() => setSeksiModal({ open: false, data: null })}
        seksi={seksiModal.data}
        onSave={fetchData}
      />
      <AspekModal
        open={aspekModal.open}
        onClose={() => setAspekModal({ open: false, data: null, seksiId: '' })}
        aspek={aspekModal.data}
        seksiId={aspekModal.seksiId}
        onSave={fetchData}
      />
    </div>
  );
}
