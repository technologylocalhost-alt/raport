UPDATE "RaportMentalSeksi"
SET
  "nama" = CASE "kode"
    WHEN 'CATATAN_POSITIF' THEN 'Penilaian Umum - Catatan Positif'
    WHEN 'CATATAN_NEGATIF' THEN 'Penilaian Umum - Catatan Negatif'
    WHEN 'PENILAIAN_AKHIR' THEN 'Penilaian Umum - Kesimpulan Akhir'
    ELSE "nama"
  END,
  "updatedAt" = NOW()
WHERE "kode" IN ('CATATAN_POSITIF', 'CATATAN_NEGATIF', 'PENILAIAN_AKHIR');

WITH target_names AS (
  SELECT 'CATATAN_POSITIF'::text AS kode, 0 AS urutan, 'Keunggulan Utama'::text AS nama
  UNION ALL SELECT 'CATATAN_POSITIF', 1, 'Sikap yang Menonjol'
  UNION ALL SELECT 'CATATAN_POSITIF', 2, 'Perkembangan Positif'
  UNION ALL SELECT 'CATATAN_POSITIF', 3, 'Prestasi / Kontribusi'
  UNION ALL SELECT 'CATATAN_POSITIF', 4, 'Keteladanan Harian'
  UNION ALL SELECT 'CATATAN_NEGATIF', 0, 'Hal yang Perlu Diperbaiki'
  UNION ALL SELECT 'CATATAN_NEGATIF', 1, 'Catatan Kedisiplinan'
  UNION ALL SELECT 'CATATAN_NEGATIF', 2, 'Catatan Adab dan Sikap'
  UNION ALL SELECT 'CATATAN_NEGATIF', 3, 'Catatan Tanggung Jawab'
  UNION ALL SELECT 'CATATAN_NEGATIF', 4, 'Pembinaan Lanjutan'
  UNION ALL SELECT 'PENILAIAN_AKHIR', 0, 'Nilai Akhir'
  UNION ALL SELECT 'PENILAIAN_AKHIR', 1, 'Predikat'
  UNION ALL SELECT 'PENILAIAN_AKHIR', 2, 'Deskripsi / Narasi Penilaian Umum'
  UNION ALL SELECT 'PENILAIAN_AKHIR', 3, 'Nama Pengasuhan'
  UNION ALL SELECT 'PENILAIAN_AKHIR', 4, 'Catatan / Motivasi Walisantri'
)
UPDATE "RaportMentalAspek" a
SET
  "nama" = t.nama,
  "updatedAt" = NOW()
FROM target_names t
JOIN "RaportMentalSeksi" s
  ON s."kode" = t.kode
WHERE a."seksiId" = s."id"
  AND a."urutan" = t.urutan;
