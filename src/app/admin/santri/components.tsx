'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Save, Trash2, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { devError } from '@/lib/dev-log';

// === FORM FIELD COMPONENTS ===

export function InputField({ label, name, value, onChange, type = 'text', required = false, placeholder = '' }: {
  label: string; name: string; value: string; onChange: (name: string, val: string) => void;
  type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && ' *'}</label>
      <input type={type} value={value || ''} onChange={(e) => onChange(name, e.target.value)}
        required={required} placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white font-medium text-sm" />
    </div>
  );
}

export function SelectField({ label, name, value, onChange, options }: {
  label: string; name: string; value: string; onChange: (name: string, val: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select value={value || ''} onChange={(e) => onChange(name, e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white font-medium text-sm">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function TextareaField({ label, name, value, onChange, rows = 2 }: {
  label: string; name: string; value: string; onChange: (name: string, val: string) => void; rows?: number;
}) {
  return (
    <div className="sm:col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea value={value || ''} onChange={(e) => onChange(name, e.target.value)} rows={rows}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 bg-white font-medium text-sm" />
    </div>
  );
}

export function SectionTitle({ title }: { title: string }) {
  return <h3 className="sm:col-span-2 text-sm font-bold text-emerald-700 border-b border-emerald-200 pb-1 mt-2">{title}</h3>;
}

interface KamarItem {
  kelas: string;
  tahun: string;
  smt1: string;
  smt2: string;
}

type StudentNoCheckStatus = 'idle' | 'checking' | 'available' | 'duplicate' | 'error';

type StudentNoCheckSource = 'none' | 'student' | 'santri';

type StudentNoCheckState = {
  status: StudentNoCheckStatus;
  message: string;
  matchedName?: string;
  source?: StudentNoCheckSource;
  prefill?: {
    name?: string;
    birthDate?: string;
    phone?: string;
    address?: string;
    parentPhoneNo?: string;
  };
};

interface ClassHistoryItem {
  schoolYear?: string;
  semester?: string;
  levelName?: string;
  className?: string;
  waliKelasName?: string;
}

export function KamarHistoryInput({ value, onChange }: { 
  value: string; 
  onChange: (name: string, val: string) => void;
}) {
  const [items, setItems] = useState<KamarItem[]>([]);

  // Sync state when prop value changes (e.g. after loading data)
  useEffect(() => {
    try {
      const parsed = value ? JSON.parse(value) : [];
      if (JSON.stringify(parsed) !== JSON.stringify(items)) {
        const timer = setTimeout(() => setItems(parsed as KamarItem[]), 0);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      devError('Error parsing kamar history JSON:', e);
    }
  }, [items, value]);

  const updateItems = (newItems: KamarItem[]) => {
    setItems(newItems);
    onChange('riwayatKamar', JSON.stringify(newItems));
  };

  const addItem = () => {
    updateItems([...items, { kelas: '', tahun: '', smt1: '', smt2: '' }]);
  };

  const removeItem = (index: number) => {
    updateItems(items.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof KamarItem, val: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: val };
    updateItems(newItems);
  };

  return (
    <div className="sm:col-span-2 space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">Riwayat Kamar (Kelas, Tahun, Semester 1, Semester 2)</label>
        <button type="button" onClick={addItem}
          className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md transition-colors">
          <Plus size={14} /> Tambah Baris
        </button>
      </div>
      
      {items.length > 0 ? (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase">Kelas</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase">Tahun</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase">Smt 1</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase">Smt 2</th>
                <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase w-10">#</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50">
                  <td className="px-2 py-2">
                    <input type="text" value={item.kelas} onChange={(e) => handleChange(idx, 'kelas', e.target.value)}
                      placeholder="Kelas" className="w-full bg-transparent border-none focus:ring-0 text-sm p-1 text-gray-900 font-medium" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="text" value={item.tahun} onChange={(e) => handleChange(idx, 'tahun', e.target.value)}
                      placeholder="Thn" className="w-full bg-transparent border-none focus:ring-0 text-sm p-1 text-gray-900 font-medium" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="text" value={item.smt1} onChange={(e) => handleChange(idx, 'smt1', e.target.value)}
                      placeholder="Kamar Smt 1" className="w-full bg-transparent border-none focus:ring-0 text-sm p-1 text-gray-900 font-medium" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="text" value={item.smt2} onChange={(e) => handleChange(idx, 'smt2', e.target.value)}
                      placeholder="Kamar Smt 2" className="w-full bg-transparent border-none focus:ring-0 text-sm p-1 text-gray-900 font-medium" />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-lg">
          <p className="text-sm text-gray-400">Belum ada data riwayat kamar. Klik Tambah Baris untuk memulai.</p>
        </div>
      )}
    </div>
  );
}

// === CONSTANTS ===

export const EMPTY_FORM: Record<string, string> = {
  tahunDaftar: '', noPendaftaranPSB: '', studentNo: '', tingkatSebelumnya: '', gender: 'MALE',
  name: '', namaPanggilan: '', birthPlace: '', birthDate: '', anakKe: '', dariAnak: '',
  nik: '', nisn: '', asalSekolah: '', nsmNpsn: '', statusDomisili: '', alamatKK: '', kodePos: '',
  domisiliLuar: '', penanggungJawab: '', penanggungJawabHP: '', ukuranPakaian: '',
  bahasaSehariHari: '', golonganDarah: '', tinggiBadan: '', beratBadan: '', noBPJS: '',
  phone: '', address: '', parentPhoneNo: '',
  kondisiGigi: '', kondisiFisik: '', instansiKesehatanNama: '', instansiKesehatanAlamat: '', instansiKesehatanHP: '',
  penyakitDalam: '', rawatJalan: '', riwayatSakit: '', alergiMakanan: '', alergiObat: '', konsumsiObatRutin: '',
  ayahNama: '', ayahStatus: 'Hidup', ayahTempatTglLahir: '', ayahKebangsaan: 'WNI', ayahNIK: '', ayahNoKK: '',
  ayahAgama: 'Islam', ayahPendidikan: '', ayahPekerjaan: '', ayahPenghasilan: '', ayahAlamat: '', ayahTelepon: '', ayahEmail: '',
  ibuNama: '', ibuStatus: 'Hidup', ibuTempatTglLahir: '', ibuKebangsaan: 'WNI', ibuNIK: '', ibuNoKK: '',
  ibuAgama: 'Islam', ibuPendidikan: '', ibuPekerjaan: '', ibuPenghasilan: '', ibuAlamat: '', ibuTelepon: '', ibuEmail: '',
  sumberPembiayaan: '', detailPembiayaan: '', nominalBantuan: '', periodeBantuan: '',
  waliStatus: '', waliNama: '', waliTempatTglLahir: '', waliNIK: '', waliNoKK: '', waliAgama: '',
  waliPendidikan: '', waliPekerjaan: '', waliPenghasilan: '', waliAlamat: '', waliKondisi: '',
  pendidikanTK: '', pendidikanPAUD: '', pendidikanSD: '', pendidikanSMP: '', pendidikanSMA: '',
  riwayatKelas: '', riwayatKamar: '', kamarBerkesan: '',
  motivasiMasuk: '', ikutOrangtuaAtauSendiri: '', betahDiPondok: '', alasanBetah: '', alasanTidakBetah: '',
  janjiOrangtua: '', inspirasiDiPondok: '', sosokTeladan: '', sadarDewasa: '', dariManaTahuPPMDL: '',
  lingkunganSuku: '', lingkunganBahasa: '', lingkunganInteraksi: '', lingkunganTradisi: '',
  lingkunganGotongRoyong: '', lingkunganPolitik: '', lingkunganOrmasMasyarakat: '', lingkunganOrmasKeagamaan: '',
  lingkunganBeragama: '', lingkunganJarakMasjid: '', lingkunganKeagamaan: '', lingkunganJumlahMasjid: '',
  lingkunganShalatJamaah: '', lingkunganPendidikanMayoritas: '', lingkunganLembagaPendidikan: '',
  lingkunganBudayaBelajar: '', lingkunganAksesInternet: '', lingkunganGadget: '', lingkunganMedsos: '',
  lingkunganOrganisasi: '', lingkunganKepemudaan: '', lingkunganKeamanan: '', lingkunganRonda: '',
  lingkunganPergaulanRemaja: '',
  prestasi: '', kegiatanOrganisasi: '', kegiatanEkskul: '', subjekDigemari: '',
  pernahOperasi: '', penyakitKronis: '', alergiZat: '', gejalaSatuTahun: '', kebutuhanKhusus: '',
  preferensiBahasa: '', preferensiPelajaran: '', pelajaranArabDisukai: '', pelajaranInggrisDisukai: '',
  pelajaranEksaktaDisukai: '', pelajaranTidakDisukai: '', ekskulDisukai: '', ekskulTidakDisukai: '',
  kegiatanBesarDisukai: '', kegiatanBesarTidakDisukai: '', rencanaMA: '', rencanaKuliah: '', rencanaKarier: '',
  tempatKerjaDiinginkan: '', profesiCitaCita: '', skillDipelajari: '', target10Tahun: '',
  diInputOleh: '', tanggalInput: '', catatanSekpim: '',
};

export const TABS = [
  { id: 'identitas', label: 'Identitas' },
  { id: 'dataDiri', label: 'Data Diri' },
  { id: 'kesehatan', label: 'Kesehatan' },
  { id: 'orangTua', label: 'Orang Tua' },
  { id: 'pembiayaan', label: 'Pembiayaan & Wali' },
  { id: 'riwayat', label: 'Riwayat Pendidikan' },
  { id: 'motivasi', label: 'Motivasi' },
  { id: 'lingkungan', label: 'Lingkungan' },
  { id: 'prestasi', label: 'Prestasi & Minat' },
  { id: 'lainnya', label: 'Lain-lain' },
];

const PENDIDIKAN_OPTIONS = [
  { value: '', label: '-- Pilih --' }, { value: 'SD', label: 'SD' }, { value: 'SMP', label: 'SMP' },
  { value: 'SMA', label: 'SMA' }, { value: 'S1', label: 'S1' }, { value: 'S2', label: 'S2' }, { value: 'S3', label: 'S3' },
];

// === TAB CONTENT RENDERER ===

export function renderTabContent(
  activeTab: string,
  formData: Record<string, string>,
  onChange: (name: string, val: string) => void,
  classHistory?: ClassHistoryItem[],
  studentNoCheck?: StudentNoCheckState,
) {
  const F = formData;
  const C = onChange;
  const getStudentNoMessageClass = (status: StudentNoCheckStatus) => {
    switch (status) {
      case 'checking':
        return 'text-blue-600 text-sm';
      case 'available':
        return 'text-emerald-600 text-sm';
      case 'duplicate':
        return 'text-red-600 text-sm';
      case 'error':
        return 'text-orange-600 text-sm';
      default:
        return 'text-gray-500 text-sm';
    }
  };

  switch (activeTab) {
    case 'identitas':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField label="Nama Lengkap" name="name" value={F.name} onChange={C} required />
          <div>
            <InputField label="No Stambuk" name="studentNo" value={F.studentNo} onChange={C} required />
            {studentNoCheck?.message && studentNoCheck.status !== 'idle' && (
              <p className={`mt-1 ${getStudentNoMessageClass(studentNoCheck.status)}`}>
                {studentNoCheck.message}
              </p>
            )}
          </div>
          <InputField label="Nama Panggilan" name="namaPanggilan" value={F.namaPanggilan} onChange={C} />
          <SelectField label="Jenis Kelamin" name="gender" value={F.gender} onChange={C}
            options={[{ value: 'MALE', label: 'Putra' }, { value: 'FEMALE', label: 'Putri' }]} />
          <InputField label="Tahun Daftar" name="tahunDaftar" value={F.tahunDaftar} onChange={C} />
          <InputField label="No Pendaftaran PSB" name="noPendaftaranPSB" value={F.noPendaftaranPSB} onChange={C} />
          <SelectField label="Tingkat Pendidikan Sebelumnya" name="tingkatSebelumnya" value={F.tingkatSebelumnya} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'MI/SD', label: 'MI/SD' }, { value: 'MTS/SMP', label: 'MTS/SMP' }, { value: 'MA/SMA', label: 'MA/SMA' }]} />
          <InputField label="NIK" name="nik" value={F.nik} onChange={C} />
          <InputField label="NISN" name="nisn" value={F.nisn} onChange={C} />
          <InputField label="Asal Sekolah" name="asalSekolah" value={F.asalSekolah} onChange={C} />
          <InputField label="NSM/NPSN Asal Sekolah" name="nsmNpsn" value={F.nsmNpsn} onChange={C} />
        </div>
      );

    case 'dataDiri':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField label="Tempat Lahir" name="birthPlace" value={F.birthPlace} onChange={C} />
          <InputField label="Tanggal Lahir" name="birthDate" value={F.birthDate} onChange={C} type="date" />
          <InputField label="Anak Ke" name="anakKe" value={F.anakKe} onChange={C} type="number" />
          <InputField label="Dari Anak" name="dariAnak" value={F.dariAnak} onChange={C} type="number" />
          <SelectField label="Status Domisili" name="statusDomisili" value={F.statusDomisili} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Rumah Ortu', label: 'Rumah Orang Tua' }, { value: 'Rumah Nenek/Kakek', label: 'Rumah Nenek/Kakek' },
              { value: 'Rumah Saudara Ortu', label: 'Rumah Saudara Orang Tua' }, { value: 'Rumah Saudara Kandung', label: 'Rumah Saudara Kandung' }, { value: 'Lainnya', label: 'Lainnya' }]} />
          <InputField label="Telepon Santri" name="phone" value={F.phone} onChange={C} />
          <TextareaField label="Alamat Sesuai KK" name="alamatKK" value={F.alamatKK} onChange={C} />
          <InputField label="Kode Pos" name="kodePos" value={F.kodePos} onChange={C} />
          <TextareaField label="Domisili di Luar KK" name="domisiliLuar" value={F.domisiliLuar} onChange={C} />
          <InputField label="Penanggung Jawab (Nama)" name="penanggungJawab" value={F.penanggungJawab} onChange={C} />
          <InputField label="HP Penanggung Jawab" name="penanggungJawabHP" value={F.penanggungJawabHP} onChange={C} />
          <InputField label="Telepon Wali/Orang Tua" name="parentPhoneNo" value={F.parentPhoneNo} onChange={C} />
          <InputField label="Ukuran Pakaian" name="ukuranPakaian" value={F.ukuranPakaian} onChange={C} />
          <InputField label="Bahasa Sehari-hari" name="bahasaSehariHari" value={F.bahasaSehariHari} onChange={C} />
          <SelectField label="Golongan Darah" name="golonganDarah" value={F.golonganDarah} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'AB', label: 'AB' }, { value: 'O', label: 'O' }]} />
          <InputField label="Tinggi Badan (cm)" name="tinggiBadan" value={F.tinggiBadan} onChange={C} />
          <InputField label="Berat Badan (kg)" name="beratBadan" value={F.beratBadan} onChange={C} />
          <InputField label="No BPJS" name="noBPJS" value={F.noBPJS} onChange={C} />
          <TextareaField label="Alamat Lengkap" name="address" value={F.address} onChange={C} />
        </div>
      );

    case 'kesehatan':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SectionTitle title="Kondisi Fisik" />
          <SelectField label="Kondisi Gigi" name="kondisiGigi" value={F.kondisiGigi} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Normal', label: 'Normal' }, { value: 'Tidak Rapi', label: 'Tidak Rapi' }, { value: 'Berlubang/Sakit-Kambuh', label: 'Berlubang/Sakit-Kambuh' }]} />
          <InputField label="Kondisi Badan/Fisik" name="kondisiFisik" value={F.kondisiFisik} onChange={C} placeholder="Normal / Cacat (bagian tubuh)" />
          <SectionTitle title="Instansi Kesehatan" />
          <InputField label="Nama RS/Dokter" name="instansiKesehatanNama" value={F.instansiKesehatanNama} onChange={C} />
          <InputField label="Alamat RS/Dokter" name="instansiKesehatanAlamat" value={F.instansiKesehatanAlamat} onChange={C} />
          <InputField label="No HP RS/Dokter" name="instansiKesehatanHP" value={F.instansiKesehatanHP} onChange={C} />
          <SectionTitle title="Riwayat Penyakit" />
          <TextareaField label="Penyakit Dalam (Pernah/Sedang)" name="penyakitDalam" value={F.penyakitDalam} onChange={C} />
          <TextareaField label="Rawat Jalan & Kambuh" name="rawatJalan" value={F.rawatJalan} onChange={C} />
          <TextareaField label="Riwayat Sakit (Sudah Sembuh)" name="riwayatSakit" value={F.riwayatSakit} onChange={C} />
          <TextareaField label="Alergi Makanan/Pantangan" name="alergiMakanan" value={F.alergiMakanan} onChange={C} />
          <TextareaField label="Alergi Obat/Pantangan" name="alergiObat" value={F.alergiObat} onChange={C} />
          <TextareaField label="Konsumsi Obat Rutin" name="konsumsiObatRutin" value={F.konsumsiObatRutin} onChange={C} />
          <SectionTitle title="Keterangan Tambahan Kesehatan" />
          <TextareaField label="Pernah Operasi? (YA/TIDAK + Detail)" name="pernahOperasi" value={F.pernahOperasi} onChange={C} />
          <TextareaField label="Penyakit Kronis? (YA/TIDAK + Detail)" name="penyakitKronis" value={F.penyakitKronis} onChange={C} />
          <TextareaField label="Alergi Zat/Makanan Tertentu? (Detail)" name="alergiZat" value={F.alergiZat} onChange={C} />
          <TextareaField label="Gejala/Keluhan Selama 1 Tahun?" name="gejalaSatuTahun" value={F.gejalaSatuTahun} onChange={C} />
          <TextareaField label="Kebutuhan Khusus Kesehatan?" name="kebutuhanKhusus" value={F.kebutuhanKhusus} onChange={C} />
        </div>
      );

    case 'orangTua':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SectionTitle title="Data Ayah Kandung" />
          <InputField label="Nama Ayah" name="ayahNama" value={F.ayahNama} onChange={C} />
          <SelectField label="Status" name="ayahStatus" value={F.ayahStatus} onChange={C}
            options={[{ value: 'Hidup', label: 'Hidup' }, { value: 'Wafat', label: 'Wafat' }]} />
          <InputField label="Tempat/Tanggal Lahir" name="ayahTempatTglLahir" value={F.ayahTempatTglLahir} onChange={C} />
          <SelectField label="Kebangsaan" name="ayahKebangsaan" value={F.ayahKebangsaan} onChange={C}
            options={[{ value: 'WNI', label: 'WNI' }, { value: 'WNA', label: 'WNA' }]} />
          <InputField label="NIK" name="ayahNIK" value={F.ayahNIK} onChange={C} />
          <InputField label="No KK" name="ayahNoKK" value={F.ayahNoKK} onChange={C} />
          <InputField label="Agama" name="ayahAgama" value={F.ayahAgama} onChange={C} />
          <SelectField label="Pendidikan Terakhir" name="ayahPendidikan" value={F.ayahPendidikan} onChange={C} options={PENDIDIKAN_OPTIONS} />
          <InputField label="Pekerjaan/Jabatan" name="ayahPekerjaan" value={F.ayahPekerjaan} onChange={C} />
          <InputField label="Penghasilan Per Bulan" name="ayahPenghasilan" value={F.ayahPenghasilan} onChange={C} />
          <TextareaField label="Alamat" name="ayahAlamat" value={F.ayahAlamat} onChange={C} />
          <InputField label="Telepon/HP/WA" name="ayahTelepon" value={F.ayahTelepon} onChange={C} />
          <InputField label="Email" name="ayahEmail" value={F.ayahEmail} onChange={C} type="email" />
          <SectionTitle title="Data Ibu Kandung" />
          <InputField label="Nama Ibu" name="ibuNama" value={F.ibuNama} onChange={C} />
          <SelectField label="Status" name="ibuStatus" value={F.ibuStatus} onChange={C}
            options={[{ value: 'Hidup', label: 'Hidup' }, { value: 'Wafat', label: 'Wafat' }]} />
          <InputField label="Tempat/Tanggal Lahir" name="ibuTempatTglLahir" value={F.ibuTempatTglLahir} onChange={C} />
          <SelectField label="Kebangsaan" name="ibuKebangsaan" value={F.ibuKebangsaan} onChange={C}
            options={[{ value: 'WNI', label: 'WNI' }, { value: 'WNA', label: 'WNA' }]} />
          <InputField label="NIK" name="ibuNIK" value={F.ibuNIK} onChange={C} />
          <InputField label="No KK" name="ibuNoKK" value={F.ibuNoKK} onChange={C} />
          <InputField label="Agama" name="ibuAgama" value={F.ibuAgama} onChange={C} />
          <SelectField label="Pendidikan Terakhir" name="ibuPendidikan" value={F.ibuPendidikan} onChange={C} options={PENDIDIKAN_OPTIONS} />
          <InputField label="Pekerjaan/Jabatan" name="ibuPekerjaan" value={F.ibuPekerjaan} onChange={C} />
          <InputField label="Penghasilan Per Bulan" name="ibuPenghasilan" value={F.ibuPenghasilan} onChange={C} />
          <TextareaField label="Alamat" name="ibuAlamat" value={F.ibuAlamat} onChange={C} />
          <InputField label="Telepon/HP/WA" name="ibuTelepon" value={F.ibuTelepon} onChange={C} />
          <InputField label="Email" name="ibuEmail" value={F.ibuEmail} onChange={C} type="email" />
        </div>
      );

    case 'pembiayaan':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SectionTitle title="Pembiayaan" />
          <InputField label="Sumber Pembiayaan" name="sumberPembiayaan" value={F.sumberPembiayaan} onChange={C} placeholder="Orang tua, Beasiswa, dll" />
          <InputField label="Detail Pembiayaan" name="detailPembiayaan" value={F.detailPembiayaan} onChange={C} placeholder="Nama lembaga / orang" />
          <InputField label="Nominal Bantuan/Beasiswa" name="nominalBantuan" value={F.nominalBantuan} onChange={C} />
          <SelectField label="Periode Bantuan" name="periodeBantuan" value={F.periodeBantuan} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Harian', label: 'Harian' }, { value: 'Mingguan', label: 'Mingguan' }, { value: 'Bulanan', label: 'Bulanan' }, { value: 'Semester', label: 'Semester' }, { value: 'Tahunan', label: 'Tahunan' }]} />
          <SectionTitle title="Data Wali / Wakil Wali" />
          <SelectField label="Status Hubungan" name="waliStatus" value={F.waliStatus} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Ayah Tiri', label: 'Ayah Tiri' }, { value: 'Ibu Tiri', label: 'Ibu Tiri' }, { value: 'Saudara Tiri', label: 'Saudara/i Tiri' },
              { value: 'Ayah/Ibu Angkat', label: 'Ayah/Ibu Angkat' }, { value: 'Kakek/Nenek', label: 'Kakek/Nenek' }, { value: 'Saudara Ortu', label: 'Saudara/i Orang Tua' },
              { value: 'Saudara Kandung', label: 'Saudara/i Kandung' }, { value: 'Lainnya', label: 'Lainnya' }]} />
          <InputField label="Nama Wali" name="waliNama" value={F.waliNama} onChange={C} />
          <InputField label="Tempat/Tanggal Lahir" name="waliTempatTglLahir" value={F.waliTempatTglLahir} onChange={C} />
          <InputField label="NIK" name="waliNIK" value={F.waliNIK} onChange={C} />
          <InputField label="No KK" name="waliNoKK" value={F.waliNoKK} onChange={C} />
          <InputField label="Agama" name="waliAgama" value={F.waliAgama} onChange={C} />
          <SelectField label="Pendidikan Terakhir" name="waliPendidikan" value={F.waliPendidikan} onChange={C} options={PENDIDIKAN_OPTIONS} />
          <InputField label="Pekerjaan/Jabatan" name="waliPekerjaan" value={F.waliPekerjaan} onChange={C} />
          <InputField label="Penghasilan Per Bulan" name="waliPenghasilan" value={F.waliPenghasilan} onChange={C} />
          <TextareaField label="Alamat" name="waliAlamat" value={F.waliAlamat} onChange={C} />
          <InputField label="Kondisi (Pembiayaan/Pengasuhan)" name="waliKondisi" value={F.waliKondisi} onChange={C} />
        </div>
      );

    case 'riwayat':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SectionTitle title="Riwayat Pendidikan Sebelum PPMDL" />
            <InputField label="TK A/B (Tahun)" name="pendidikanTK" value={F.pendidikanTK} onChange={C} />
            <InputField label="PAUD (Tahun)" name="pendidikanPAUD" value={F.pendidikanPAUD} onChange={C} />
            <InputField label="SD/MI (Tahun)" name="pendidikanSD" value={F.pendidikanSD} onChange={C} />
            <InputField label="SMP/MTS (Tahun)" name="pendidikanSMP" value={F.pendidikanSMP} onChange={C} />
            <InputField label="SMA/MA - Pindahan/Lanjut (Tahun)" name="pendidikanSMA" value={F.pendidikanSMA} onChange={C} />
          </div>

          {/* Riwayat Kelas dari Database */}
          <h3 className="text-sm font-bold text-emerald-700 border-b border-emerald-200 pb-1 mt-2">Riwayat Kelas di PPMDL</h3>
          {classHistory && classHistory.length > 0 ? (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">No</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Tahun Ajaran</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Semester</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Tingkat</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Kelas</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Wali Kelas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {classHistory.map((ch: ClassHistoryItem, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-700">{idx + 1}</td>
                      <td className="px-4 py-2.5 text-gray-900 font-medium">{ch.schoolYear}</td>
                      <td className="px-4 py-2.5 text-gray-700">{ch.semester}</td>
                      <td className="px-4 py-2.5 text-gray-700">{ch.levelName}</td>
                      <td className="px-4 py-2.5 text-gray-900 font-medium">{ch.className}</td>
                      <td className="px-4 py-2.5 text-gray-700">{ch.waliKelasName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic py-2">Belum ada data riwayat kelas di database</p>
          )}

          <div className="grid grid-cols-1 gap-4">
            <SectionTitle title="Riwayat Kamar di PPMDL" />
            <KamarHistoryInput value={F.riwayatKamar} onChange={C} />
            <InputField label="Kamar yang Paling Berkesan" name="kamarBerkesan" value={F.kamarBerkesan} onChange={C} />
          </div>
        </div>
      );

    case 'motivasi':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SectionTitle title="Alasan & Motivasi Masuk Pondok" />
          <TextareaField label="Siapa yang Memotivasi Masuk Pondok?" name="motivasiMasuk" value={F.motivasiMasuk} onChange={C} />
          <TextareaField label="Ikut Orang Tua atau Keinginan Sendiri?" name="ikutOrangtuaAtauSendiri" value={F.ikutOrangtuaAtauSendiri} onChange={C} />
          <TextareaField label="Betah di Pondok?" name="betahDiPondok" value={F.betahDiPondok} onChange={C} />
          <TextareaField label="Apa yang Membuat Betah?" name="alasanBetah" value={F.alasanBetah} onChange={C} />
          <TextareaField label="Apa yang Tidak Membuat Betah?" name="alasanTidakBetah" value={F.alasanTidakBetah} onChange={C} />
          <TextareaField label="Janji Orang Tua Saat Masuk/Setelah Lulus" name="janjiOrangtua" value={F.janjiOrangtua} onChange={C} />
          <InputField label="Inspirasi di Pondok" name="inspirasiDiPondok" value={F.inspirasiDiPondok} onChange={C} />
          <InputField label="Sosok Teladan" name="sosokTeladan" value={F.sosokTeladan} onChange={C} />
          <TextareaField label="Kapan Sadar Harus Dewasa?" name="sadarDewasa" value={F.sadarDewasa} onChange={C} />
          <InputField label="Dari Mana Tahu PPM Darussalam Lahat?" name="dariManaTahuPPMDL" value={F.dariManaTahuPPMDL} onChange={C} />
        </div>
      );

    case 'lingkungan':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SectionTitle title="Profil Lingkungan Domisili Wali Santri" />
          <InputField label="Suku Mayoritas" name="lingkunganSuku" value={F.lingkunganSuku} onChange={C} />
          <InputField label="Bahasa Sehari-hari Masyarakat" name="lingkunganBahasa" value={F.lingkunganBahasa} onChange={C} />
          <SelectField label="Tingkat Interaksi Sosial" name="lingkunganInteraksi" value={F.lingkunganInteraksi} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Sangat erat', label: 'Sangat erat' }, { value: 'Erat', label: 'Erat' }, { value: 'Cukup', label: 'Cukup' }, { value: 'Kurang', label: 'Kurang' }]} />
          <InputField label="Tradisi/Kegiatan Adat" name="lingkunganTradisi" value={F.lingkunganTradisi} onChange={C} />
          <SelectField label="Gotong Royong" name="lingkunganGotongRoyong" value={F.lingkunganGotongRoyong} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Rutin', label: 'Rutin' }, { value: 'Kadang-kadang', label: 'Kadang-kadang' }, { value: 'Jarang', label: 'Jarang' }]} />
          <InputField label="Pandangan Politik (Partai)" name="lingkunganPolitik" value={F.lingkunganPolitik} onChange={C} />
          <InputField label="Organisasi Masyarakat (Umum)" name="lingkunganOrmasMasyarakat" value={F.lingkunganOrmasMasyarakat} onChange={C} />
          <InputField label="Organisasi Keagamaan" name="lingkunganOrmasKeagamaan" value={F.lingkunganOrmasKeagamaan} onChange={C} placeholder="NU/MU, dll" />
          <SelectField label="Kehidupan Beragama" name="lingkunganBeragama" value={F.lingkunganBeragama} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Sangat aktif', label: 'Sangat aktif' }, { value: 'Aktif', label: 'Aktif' }, { value: 'Cukup', label: 'Cukup' }, { value: 'Kurang', label: 'Kurang' }]} />
          <InputField label="Jarak Rumah ke Masjid/Mushalla" name="lingkunganJarakMasjid" value={F.lingkunganJarakMasjid} onChange={C} />
          <InputField label="Kegiatan Keagamaan Rutin" name="lingkunganKeagamaan" value={F.lingkunganKeagamaan} onChange={C} placeholder="Pengajian, Yasinan, dll" />
          <SelectField label="Jumlah Masjid/Mushalla" name="lingkunganJumlahMasjid" value={F.lingkunganJumlahMasjid} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Banyak', label: 'Banyak' }, { value: 'Cukup', label: 'Cukup' }, { value: 'Sedikit', label: 'Sedikit' }]} />
          <SelectField label="Shalat Berjamaah" name="lingkunganShalatJamaah" value={F.lingkunganShalatJamaah} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Umum', label: 'Umum' }, { value: 'Sebagian', label: 'Sebagian' }, { value: 'Jarang', label: 'Jarang' }]} />
          <SelectField label="Pendidikan Mayoritas" name="lingkunganPendidikanMayoritas" value={F.lingkunganPendidikanMayoritas} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'SD', label: 'SD' }, { value: 'SMP', label: 'SMP' }, { value: 'SMA', label: 'SMA' }, { value: 'Perguruan Tinggi', label: 'Perguruan Tinggi' }]} />
          <InputField label="Lembaga Pendidikan di Sekitar" name="lingkunganLembagaPendidikan" value={F.lingkunganLembagaPendidikan} onChange={C} placeholder="Pesantren, Madrasah, dll" />
          <SelectField label="Budaya Belajar Anak" name="lingkunganBudayaBelajar" value={F.lingkunganBudayaBelajar} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Sangat baik', label: 'Sangat baik' }, { value: 'Baik', label: 'Baik' }, { value: 'Cukup', label: 'Cukup' }, { value: 'Kurang', label: 'Kurang' }]} />
          <SelectField label="Akses Internet" name="lingkunganAksesInternet" value={F.lingkunganAksesInternet} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Sangat mudah', label: 'Sangat mudah' }, { value: 'Mudah', label: 'Mudah' }, { value: 'Terbatas', label: 'Terbatas' }, { value: 'Sulit', label: 'Sulit' }]} />
          <SelectField label="Penggunaan Gadget Remaja" name="lingkunganGadget" value={F.lingkunganGadget} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Tinggi', label: 'Tinggi' }, { value: 'Sedang', label: 'Sedang' }, { value: 'Rendah', label: 'Rendah' }]} />
          <InputField label="Media Sosial Dominan" name="lingkunganMedsos" value={F.lingkunganMedsos} onChange={C} />
          <InputField label="Organisasi Aktif" name="lingkunganOrganisasi" value={F.lingkunganOrganisasi} onChange={C} />
          <SelectField label="Kegiatan Kepemudaan" name="lingkunganKepemudaan" value={F.lingkunganKepemudaan} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Aktif', label: 'Aktif' }, { value: 'Cukup', label: 'Cukup' }, { value: 'Tidak aktif', label: 'Tidak aktif' }]} />
          <SelectField label="Kondisi Keamanan" name="lingkunganKeamanan" value={F.lingkunganKeamanan} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Sangat aman', label: 'Sangat aman' }, { value: 'Aman', label: 'Aman' }, { value: 'Cukup', label: 'Cukup' }, { value: 'Kurang aman', label: 'Kurang aman' }]} />
          <SelectField label="Ronda/Siskamling" name="lingkunganRonda" value={F.lingkunganRonda} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Rutin', label: 'Rutin' }, { value: 'Kadang', label: 'Kadang' }, { value: 'Tidak ada', label: 'Tidak ada' }]} />
          <SelectField label="Pengaruh Pergaulan Remaja" name="lingkunganPergaulanRemaja" value={F.lingkunganPergaulanRemaja} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Sangat baik', label: 'Sangat baik' }, { value: 'Baik', label: 'Baik' }, { value: 'Cukup', label: 'Cukup' }, { value: 'Perlu perhatian', label: 'Perlu perhatian' }]} />
        </div>
      );

    case 'prestasi':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SectionTitle title="Prestasi, Kegiatan & Minat" />
          <TextareaField label="Prestasi" name="prestasi" value={F.prestasi} onChange={C} rows={3} />
          <TextareaField label="Kegiatan Organisasi (Internal/Eksternal)" name="kegiatanOrganisasi" value={F.kegiatanOrganisasi} onChange={C} rows={3} />
          <TextareaField label="Kegiatan Ekstrakurikuler" name="kegiatanEkskul" value={F.kegiatanEkskul} onChange={C} rows={3} />
          <TextareaField label="Subjek yang Digemari" name="subjekDigemari" value={F.subjekDigemari} onChange={C} rows={3} />
        </div>
      );

    case 'lainnya':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SectionTitle title="Preferensi Pelajaran" />
          <SelectField label="Bahasa yang Lebih Disukai" name="preferensiBahasa" value={F.preferensiBahasa} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Bahasa Arab', label: 'Bahasa Arab' }, { value: 'Bahasa Inggris', label: 'Bahasa Inggris' }]} />
          <SelectField label="Jenis Pelajaran yang Disukai" name="preferensiPelajaran" value={F.preferensiPelajaran} onChange={C}
            options={[{ value: '', label: '-- Pilih --' }, { value: 'Pelajaran Bahasa', label: 'Pelajaran Bahasa' }, { value: 'Pelajaran Umum', label: 'Pelajaran Umum' }, { value: 'Pelajaran Eksakta', label: 'Pelajaran Eksakta' }]} />
          <InputField label="Pelajaran B. Arab Disukai" name="pelajaranArabDisukai" value={F.pelajaranArabDisukai} onChange={C} />
          <InputField label="Pelajaran B. Inggris Disukai" name="pelajaranInggrisDisukai" value={F.pelajaranInggrisDisukai} onChange={C} />
          <InputField label="Pelajaran Eksakta Disukai" name="pelajaranEksaktaDisukai" value={F.pelajaranEksaktaDisukai} onChange={C} />
          <InputField label="Pelajaran Tidak Disukai" name="pelajaranTidakDisukai" value={F.pelajaranTidakDisukai} onChange={C} />
          <SectionTitle title="Ekstrakurikuler & Kegiatan Besar" />
          <InputField label="Ekskul Disukai" name="ekskulDisukai" value={F.ekskulDisukai} onChange={C} />
          <InputField label="Ekskul Tidak Disukai" name="ekskulTidakDisukai" value={F.ekskulTidakDisukai} onChange={C} />
          <InputField label="Kegiatan Besar Disukai" name="kegiatanBesarDisukai" value={F.kegiatanBesarDisukai} onChange={C} />
          <InputField label="Kegiatan Besar Tidak Disukai" name="kegiatanBesarTidakDisukai" value={F.kegiatanBesarTidakDisukai} onChange={C} />
          <SectionTitle title="Rencana Masa Depan" />
          <TextareaField label="Rencana Lanjut MA/SMA" name="rencanaMA" value={F.rencanaMA} onChange={C} />
          <TextareaField label="Rencana Kuliah (Universitas & Jurusan)" name="rencanaKuliah" value={F.rencanaKuliah} onChange={C} />
          <TextareaField label="Rencana Karier" name="rencanaKarier" value={F.rencanaKarier} onChange={C} />
          <InputField label="Tempat Kerja yang Diinginkan" name="tempatKerjaDiinginkan" value={F.tempatKerjaDiinginkan} onChange={C} />
          <InputField label="Profesi Cita-cita" name="profesiCitaCita" value={F.profesiCitaCita} onChange={C} />
          <InputField label="Skill yang Ingin Dipelajari" name="skillDipelajari" value={F.skillDipelajari} onChange={C} />
          <TextareaField label="Target 10 Tahun ke Depan" name="target10Tahun" value={F.target10Tahun} onChange={C} rows={4} />
          <SectionTitle title="Administrasi" />
          <InputField label="Di-input Oleh" name="diInputOleh" value={F.diInputOleh} onChange={C} />
          <InputField label="Tanggal Input" name="tanggalInput" value={F.tanggalInput} onChange={C} type="date" />
          <TextareaField label="Catatan Sekpim" name="catatanSekpim" value={F.catatanSekpim} onChange={C} />
        </div>
      );

    default:
      return null;
  }
}

// === SANTRI FORM PAGE COMPONENT ===

export function SantriFormPage({ id }: { id?: string }) {
  const router = useRouter();
  const [formData, setFormData] = useState<Record<string, string>>({ ...EMPTY_FORM });
  const [classHistory, setClassHistory] = useState<ClassHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState('identitas');
  const [isLoading, setIsLoading] = useState(!!id);
  const [isSaving, setIsSaving] = useState(false);
  const [initialStudentNo, setInitialStudentNo] = useState('');
  const [studentNoCheck, setStudentNoCheck] = useState<StudentNoCheckState>({
    status: 'idle',
    message: '',
  });
  const studentNoCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const studentNoCheckRequestRef = useRef(0);

  const isEdit = !!id;

  // Load data if editing
  useEffect(() => {
    if (!id) return;
    void apiFetch(`/api/admin/santri/${id}`)
      .then(res => res.json())
      .then(result => {
        if (!result.success) { alert('Gagal memuat data'); router.push('/admin/santri'); return; }
        const d = result.data;
        const newForm: Record<string, string> = { ...EMPTY_FORM };
        for (const key of Object.keys(EMPTY_FORM)) {
          if (d[key] !== null && d[key] !== undefined) {
            if (key === 'birthDate' || key === 'tanggalInput') {
              newForm[key] = d[key] ? new Date(d[key]).toISOString().split('T')[0] : '';
            } else {
              newForm[key] = String(d[key]);
            }
          }
        }
        setFormData(newForm);
        setInitialStudentNo(newForm.studentNo || '');
        setStudentNoCheck(
          newForm.studentNo
            ? { status: 'available', message: 'No Stambuk saat ini', matchedName: undefined }
            : { status: 'idle', message: '', matchedName: undefined }
        );
        if (d.classHistory) setClassHistory(d.classHistory);
      })
      .catch(() => { alert('Gagal memuat data'); router.push('/admin/santri'); })
      .finally(() => setIsLoading(false));
  }, [id, router]);

  const handleFieldChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatDateInputValue = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (studentNoCheckTimerRef.current) {
      clearTimeout(studentNoCheckTimerRef.current);
    }

    const currentStudentNo = (formData.studentNo || '').trim();

    if (!currentStudentNo) {
      setStudentNoCheck({ status: 'idle', message: '', matchedName: undefined, source: 'none', prefill: undefined });
      return;
    }

    if (isEdit && currentStudentNo === initialStudentNo) {
      setStudentNoCheck({ status: 'available', message: 'No Stambuk saat ini', matchedName: undefined, source: 'santri' });
      return;
    }

    const requestId = ++studentNoCheckRequestRef.current;
    setStudentNoCheck({ status: 'checking', message: 'Memeriksa no stambuk...', matchedName: undefined });

    studentNoCheckTimerRef.current = setTimeout(async () => {
      try {
        const queryParams = new URLSearchParams({ studentNo: currentStudentNo });
        if (isEdit && id) {
          queryParams.set('excludeId', id);
        }

        const response = await apiFetch(`/api/admin/santri/check-student-no?${queryParams.toString()}`);
        if (requestId !== studentNoCheckRequestRef.current) return;

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Gagal mengecek no stambuk' }));
          if (requestId !== studentNoCheckRequestRef.current) return;
          setStudentNoCheck({
            status: 'error',
            message: err.error || 'Gagal mengecek no stambuk',
            matchedName: undefined,
            source: 'none',
            prefill: undefined,
          });
          return;
        }

        const result = await response.json();
        if (requestId !== studentNoCheckRequestRef.current) return;

        if (!result.success || !result.data) {
          setStudentNoCheck({
            status: 'error',
            message: result.error || 'Gagal membaca respons pengecekan',
            matchedName: undefined,
            source: 'none',
            prefill: undefined,
          });
          return;
        }

        const duplicateName = result.data.santri?.name || result.data.student?.name || '';
        const fromSantri = result.data.source === 'santri';
        const sourceStudent = result.data.source === 'student';
        const prefillData = sourceStudent && result.data.student
          ? {
              name: result.data.student.name || '',
              birthDate: result.data.student.birthDate || '',
              phone: result.data.student.phone || '',
              address: result.data.student.address || '',
              parentPhoneNo: result.data.student.parentPhoneNo || '',
            }
          : undefined;

        setStudentNoCheck({
          status: fromSantri ? 'duplicate' : 'available',
          message: fromSantri
              ? `No Stambuk sudah terdaftar${duplicateName ? ` (${duplicateName})` : ''}`
              : sourceStudent
                ? 'No Stambuk ditemukan di tabel Student, data dasar telah diisi otomatis'
                : 'No Stambuk tersedia',
          source: result.data.source || 'none',
          matchedName: duplicateName || undefined,
          prefill: prefillData,
        });

        if (!fromSantri && prefillData) {
          setFormData(prev => {
            const next = { ...prev };
            if (!next.name && prefillData.name) next.name = prefillData.name;
            if (!next.birthDate) {
              const v = formatDateInputValue(prefillData.birthDate);
              if (v) next.birthDate = v;
            }
            if (!next.phone && prefillData.phone) next.phone = prefillData.phone;
            if (!next.address && prefillData.address) next.address = prefillData.address;
            if (!next.parentPhoneNo && prefillData.parentPhoneNo) next.parentPhoneNo = prefillData.parentPhoneNo;
            return next;
          });
        }

        if (fromSantri && duplicateName) {
          setFormData(prev => {
            if (prev.name === duplicateName) return prev;
            return { ...prev, name: duplicateName };
          });
        }

      } catch (error) {
        devError('Error checking studentNo:', error);
        if (requestId !== studentNoCheckRequestRef.current) return;
        setStudentNoCheck({
          status: 'error',
          message: 'Terjadi masalah koneksi saat mengecek no stambuk',
          matchedName: undefined,
          source: 'none',
          prefill: undefined,
        });
      }
    }, 450);

    return () => {
      if (studentNoCheckTimerRef.current) {
        clearTimeout(studentNoCheckTimerRef.current);
      }
    };
  }, [formData.studentNo, id, initialStudentNo, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.studentNo) {
      alert('Nama Lengkap dan No Stambuk wajib diisi');
      setActiveTab('identitas');
      return;
    }
    if (studentNoCheck.status === 'checking') {
      alert('Tunggu hingga pengecekan No Stambuk selesai');
      setActiveTab('identitas');
      return;
    }
    if (studentNoCheck.status === 'duplicate') {
      alert('No Stambuk sudah terdaftar');
      setActiveTab('identitas');
      return;
    }
    try {
      setIsSaving(true);
      const url = isEdit ? `/api/admin/santri/${id}` : '/api/admin/santri';
      const method = isEdit ? 'PUT' : 'POST';
      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const err = await response.json();
        alert(err.message || 'Gagal menyimpan data santri');
        return;
      }
      const result = await response.json();
      alert(isEdit ? 'Perubahan berhasil disimpan!' : 'Santri baru berhasil ditambahkan!');
      
      if (!isEdit && result.data?.id) {
        // Alihkan ke halaman edit santri yang baru dibuat agar tetap di form yang sama
        router.replace(`/admin/santri/${result.data.id}/edit`);
      }
      // Jika mode edit, tetap di halaman tanpa push/replace.
    } catch (error) {
      devError('Error saving:', error);
      alert('Terjadi kesalahan');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data santri...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/admin/santri')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Santri' : 'Tambah Santri Baru'}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isEdit ? `Edit data santri ${formData.name || ''}` : 'Isi data santri baru sesuai form data diri'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b overflow-x-auto">
          <div className="flex">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            {renderTabContent(activeTab, formData, handleFieldChange, classHistory, studentNoCheck)}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-lg">
            <button type="button" onClick={() => router.push('/admin/santri')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm">
              <X size={16} /> Batal
            </button>
            <button
              type="submit"
              disabled={isSaving || studentNoCheck.status === 'checking' || studentNoCheck.status === 'duplicate'}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm disabled:opacity-50">
              <Save size={16} /> {isSaving ? 'Menyimpan...' : (isEdit ? 'Simpan Perubahan' : 'Tambah Santri')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// === DETAIL SECTIONS CONFIG (semua field, sesuai form input) ===

export const DETAIL_SECTIONS = [
  { title: 'Identitas Pendaftaran', fields: [
    { label: 'Nama Lengkap', key: 'name' },
    { label: 'Nama Panggilan', key: 'namaPanggilan' },
    { label: 'No Stambuk', key: 'studentNo' },
    { label: 'Jenis Kelamin', key: 'gender' },
    { label: 'Tahun Daftar', key: 'tahunDaftar' },
    { label: 'No Pendaftaran PSB', key: 'noPendaftaranPSB' },
    { label: 'Tingkat Pendidikan Sebelumnya', key: 'tingkatSebelumnya' },
    { label: 'NIK', key: 'nik' },
    { label: 'NISN', key: 'nisn' },
    { label: 'Asal Sekolah', key: 'asalSekolah' },
    { label: 'NSM/NPSN Asal Sekolah', key: 'nsmNpsn' },
  ]},
  { title: 'Data Diri', fields: [
    { label: 'Tempat Lahir', key: 'birthPlace' },
    { label: 'Tanggal Lahir', key: 'birthDate', type: 'date' },
    { label: 'Anak Ke', key: 'anakKe' },
    { label: 'Dari Anak', key: 'dariAnak' },
    { label: 'Status Domisili', key: 'statusDomisili' },
    { label: 'Telepon Santri', key: 'phone' },
    { label: 'Alamat Sesuai KK', key: 'alamatKK' },
    { label: 'Kode Pos', key: 'kodePos' },
    { label: 'Domisili di Luar KK', key: 'domisiliLuar' },
    { label: 'Penanggung Jawab (Nama)', key: 'penanggungJawab' },
    { label: 'HP Penanggung Jawab', key: 'penanggungJawabHP' },
    { label: 'Telepon Wali/Orang Tua', key: 'parentPhoneNo' },
    { label: 'Ukuran Pakaian', key: 'ukuranPakaian' },
    { label: 'Bahasa Sehari-hari', key: 'bahasaSehariHari' },
    { label: 'Golongan Darah', key: 'golonganDarah' },
    { label: 'Tinggi Badan (cm)', key: 'tinggiBadan' },
    { label: 'Berat Badan (kg)', key: 'beratBadan' },
    { label: 'No BPJS', key: 'noBPJS' },
    { label: 'Alamat Lengkap', key: 'address' },
  ]},
  { title: 'Kondisi Fisik', fields: [
    { label: 'Kondisi Gigi', key: 'kondisiGigi' },
    { label: 'Kondisi Badan/Fisik', key: 'kondisiFisik' },
  ]},
  { title: 'Instansi Kesehatan', fields: [
    { label: 'Nama RS/Dokter', key: 'instansiKesehatanNama' },
    { label: 'Alamat RS/Dokter', key: 'instansiKesehatanAlamat' },
    { label: 'No HP RS/Dokter', key: 'instansiKesehatanHP' },
  ]},
  { title: 'Riwayat Penyakit', fields: [
    { label: 'Penyakit Dalam (Pernah/Sedang)', key: 'penyakitDalam' },
    { label: 'Rawat Jalan & Kambuh', key: 'rawatJalan' },
    { label: 'Riwayat Sakit (Sudah Sembuh)', key: 'riwayatSakit' },
    { label: 'Alergi Makanan/Pantangan', key: 'alergiMakanan' },
    { label: 'Alergi Obat/Pantangan', key: 'alergiObat' },
    { label: 'Konsumsi Obat Rutin', key: 'konsumsiObatRutin' },
  ]},
  { title: 'Keterangan Tambahan Kesehatan', fields: [
    { label: 'Pernah Operasi?', key: 'pernahOperasi' },
    { label: 'Penyakit Kronis?', key: 'penyakitKronis' },
    { label: 'Alergi Zat/Makanan Tertentu?', key: 'alergiZat' },
    { label: 'Gejala/Keluhan Selama 1 Tahun?', key: 'gejalaSatuTahun' },
    { label: 'Kebutuhan Khusus Kesehatan?', key: 'kebutuhanKhusus' },
  ]},
  { title: 'Data Ayah Kandung', fields: [
    { label: 'Nama Ayah', key: 'ayahNama' },
    { label: 'Status', key: 'ayahStatus' },
    { label: 'Tempat/Tanggal Lahir', key: 'ayahTempatTglLahir' },
    { label: 'Kebangsaan', key: 'ayahKebangsaan' },
    { label: 'NIK', key: 'ayahNIK' },
    { label: 'No KK', key: 'ayahNoKK' },
    { label: 'Agama', key: 'ayahAgama' },
    { label: 'Pendidikan Terakhir', key: 'ayahPendidikan' },
    { label: 'Pekerjaan/Jabatan', key: 'ayahPekerjaan' },
    { label: 'Penghasilan Per Bulan', key: 'ayahPenghasilan' },
    { label: 'Alamat', key: 'ayahAlamat' },
    { label: 'Telepon/HP/WA', key: 'ayahTelepon' },
    { label: 'Email', key: 'ayahEmail' },
  ]},
  { title: 'Data Ibu Kandung', fields: [
    { label: 'Nama Ibu', key: 'ibuNama' },
    { label: 'Status', key: 'ibuStatus' },
    { label: 'Tempat/Tanggal Lahir', key: 'ibuTempatTglLahir' },
    { label: 'Kebangsaan', key: 'ibuKebangsaan' },
    { label: 'NIK', key: 'ibuNIK' },
    { label: 'No KK', key: 'ibuNoKK' },
    { label: 'Agama', key: 'ibuAgama' },
    { label: 'Pendidikan Terakhir', key: 'ibuPendidikan' },
    { label: 'Pekerjaan/Jabatan', key: 'ibuPekerjaan' },
    { label: 'Penghasilan Per Bulan', key: 'ibuPenghasilan' },
    { label: 'Alamat', key: 'ibuAlamat' },
    { label: 'Telepon/HP/WA', key: 'ibuTelepon' },
    { label: 'Email', key: 'ibuEmail' },
  ]},
  { title: 'Pembiayaan', fields: [
    { label: 'Sumber Pembiayaan', key: 'sumberPembiayaan' },
    { label: 'Detail Pembiayaan', key: 'detailPembiayaan' },
    { label: 'Nominal Bantuan/Beasiswa', key: 'nominalBantuan' },
    { label: 'Periode Bantuan', key: 'periodeBantuan' },
  ]},
  { title: 'Data Wali / Wakil Wali', fields: [
    { label: 'Status Hubungan', key: 'waliStatus' },
    { label: 'Nama Wali', key: 'waliNama' },
    { label: 'Tempat/Tanggal Lahir', key: 'waliTempatTglLahir' },
    { label: 'NIK', key: 'waliNIK' },
    { label: 'No KK', key: 'waliNoKK' },
    { label: 'Agama', key: 'waliAgama' },
    { label: 'Pendidikan Terakhir', key: 'waliPendidikan' },
    { label: 'Pekerjaan/Jabatan', key: 'waliPekerjaan' },
    { label: 'Penghasilan Per Bulan', key: 'waliPenghasilan' },
    { label: 'Alamat', key: 'waliAlamat' },
    { label: 'Kondisi (Pembiayaan/Pengasuhan)', key: 'waliKondisi' },
  ]},
  { title: 'Riwayat Pendidikan Sebelum PPMDL', fields: [
    { label: 'TK A/B (Tahun)', key: 'pendidikanTK' },
    { label: 'PAUD (Tahun)', key: 'pendidikanPAUD' },
    { label: 'SD/MI (Tahun)', key: 'pendidikanSD' },
    { label: 'SMP/MTS (Tahun)', key: 'pendidikanSMP' },
    { label: 'SMA/MA - Pindahan/Lanjut (Tahun)', key: 'pendidikanSMA' },
  ]},
  { title: 'Riwayat Kelas & Kamar di PPMDL', fields: [
    { label: 'Riwayat Kelas (Kelas, Wali Kelas, Tahun)', key: 'riwayatKelas' },
    { label: 'Riwayat Kamar (Kelas, Tahun, Semester 1, Semester 2)', key: 'riwayatKamar' },
    { label: 'Kamar yang Paling Berkesan', key: 'kamarBerkesan' },
  ]},
  { title: 'Alasan & Motivasi Masuk Pondok', fields: [
    { label: 'Siapa yang Memotivasi Masuk Pondok?', key: 'motivasiMasuk' },
    { label: 'Ikut Orang Tua atau Keinginan Sendiri?', key: 'ikutOrangtuaAtauSendiri' },
    { label: 'Betah di Pondok?', key: 'betahDiPondok' },
    { label: 'Apa yang Membuat Betah?', key: 'alasanBetah' },
    { label: 'Apa yang Tidak Membuat Betah?', key: 'alasanTidakBetah' },
    { label: 'Janji Orang Tua Saat Masuk/Setelah Lulus', key: 'janjiOrangtua' },
    { label: 'Inspirasi di Pondok', key: 'inspirasiDiPondok' },
    { label: 'Sosok Teladan', key: 'sosokTeladan' },
    { label: 'Kapan Sadar Harus Dewasa?', key: 'sadarDewasa' },
    { label: 'Dari Mana Tahu PPM Darussalam Lahat?', key: 'dariManaTahuPPMDL' },
  ]},
  { title: 'Profil Lingkungan Domisili Wali Santri', fields: [
    { label: 'Suku Mayoritas', key: 'lingkunganSuku' },
    { label: 'Bahasa Sehari-hari Masyarakat', key: 'lingkunganBahasa' },
    { label: 'Tingkat Interaksi Sosial', key: 'lingkunganInteraksi' },
    { label: 'Tradisi/Kegiatan Adat', key: 'lingkunganTradisi' },
    { label: 'Gotong Royong', key: 'lingkunganGotongRoyong' },
    { label: 'Pandangan Politik (Partai)', key: 'lingkunganPolitik' },
    { label: 'Organisasi Masyarakat (Umum)', key: 'lingkunganOrmasMasyarakat' },
    { label: 'Organisasi Keagamaan', key: 'lingkunganOrmasKeagamaan' },
    { label: 'Kehidupan Beragama', key: 'lingkunganBeragama' },
    { label: 'Jarak Rumah ke Masjid/Mushalla', key: 'lingkunganJarakMasjid' },
    { label: 'Kegiatan Keagamaan Rutin', key: 'lingkunganKeagamaan' },
    { label: 'Jumlah Masjid/Mushalla', key: 'lingkunganJumlahMasjid' },
    { label: 'Shalat Berjamaah', key: 'lingkunganShalatJamaah' },
    { label: 'Pendidikan Mayoritas', key: 'lingkunganPendidikanMayoritas' },
    { label: 'Lembaga Pendidikan di Sekitar', key: 'lingkunganLembagaPendidikan' },
    { label: 'Budaya Belajar Anak', key: 'lingkunganBudayaBelajar' },
    { label: 'Akses Internet', key: 'lingkunganAksesInternet' },
    { label: 'Penggunaan Gadget Remaja', key: 'lingkunganGadget' },
    { label: 'Media Sosial Dominan', key: 'lingkunganMedsos' },
    { label: 'Organisasi Aktif', key: 'lingkunganOrganisasi' },
    { label: 'Kegiatan Kepemudaan', key: 'lingkunganKepemudaan' },
    { label: 'Kondisi Keamanan', key: 'lingkunganKeamanan' },
    { label: 'Ronda/Siskamling', key: 'lingkunganRonda' },
    { label: 'Pengaruh Pergaulan Remaja', key: 'lingkunganPergaulanRemaja' },
  ]},
  { title: 'Prestasi, Kegiatan & Minat', fields: [
    { label: 'Prestasi', key: 'prestasi' },
    { label: 'Kegiatan Organisasi (Internal/Eksternal)', key: 'kegiatanOrganisasi' },
    { label: 'Kegiatan Ekstrakurikuler', key: 'kegiatanEkskul' },
    { label: 'Subjek yang Digemari', key: 'subjekDigemari' },
  ]},
  { title: 'Preferensi Pelajaran', fields: [
    { label: 'Bahasa yang Lebih Disukai', key: 'preferensiBahasa' },
    { label: 'Jenis Pelajaran yang Disukai', key: 'preferensiPelajaran' },
    { label: 'Pelajaran B. Arab Disukai', key: 'pelajaranArabDisukai' },
    { label: 'Pelajaran B. Inggris Disukai', key: 'pelajaranInggrisDisukai' },
    { label: 'Pelajaran Eksakta Disukai', key: 'pelajaranEksaktaDisukai' },
    { label: 'Pelajaran Tidak Disukai', key: 'pelajaranTidakDisukai' },
  ]},
  { title: 'Ekstrakurikuler & Kegiatan Besar', fields: [
    { label: 'Ekskul Disukai', key: 'ekskulDisukai' },
    { label: 'Ekskul Tidak Disukai', key: 'ekskulTidakDisukai' },
    { label: 'Kegiatan Besar Disukai', key: 'kegiatanBesarDisukai' },
    { label: 'Kegiatan Besar Tidak Disukai', key: 'kegiatanBesarTidakDisukai' },
  ]},
  { title: 'Rencana Masa Depan', fields: [
    { label: 'Rencana Lanjut MA/SMA', key: 'rencanaMA' },
    { label: 'Rencana Kuliah (Universitas & Jurusan)', key: 'rencanaKuliah' },
    { label: 'Rencana Karier', key: 'rencanaKarier' },
    { label: 'Tempat Kerja yang Diinginkan', key: 'tempatKerjaDiinginkan' },
    { label: 'Profesi Cita-cita', key: 'profesiCitaCita' },
    { label: 'Skill yang Ingin Dipelajari', key: 'skillDipelajari' },
    { label: 'Target 10 Tahun ke Depan', key: 'target10Tahun' },
  ]},
  { title: 'Administrasi', fields: [
    { label: 'Di-input Oleh', key: 'diInputOleh' },
    { label: 'Tanggal Input', key: 'tanggalInput', type: 'date' },
    { label: 'Catatan Sekpim', key: 'catatanSekpim' },
  ]},
];
