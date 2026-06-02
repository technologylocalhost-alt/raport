UPDATE "RaportMentalSeksi"
SET
  "nama" = 'Akumulasi Hukuman dan Pelanggaran',
  "tipeNilai" = 'ANGKA',
  "updatedAt" = NOW()
WHERE "kode" = 'AKUMULASI';

INSERT INTO "RaportMentalSeksi" (
  "id", "nama", "kode", "deskripsi", "urutan", "tipeNilai", "isActive", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'Akumulasi Hukuman dan Pelanggaran',
  'AKUMULASI',
  'Seksi O sesuai dokumen raport mental',
  14,
  'ANGKA'::"TipeNilaiRaportMental",
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "RaportMentalSeksi" WHERE "kode" = 'AKUMULASI'
);

WITH target_aspek AS (
  SELECT 0 AS urutan, 'Pelanggaran Ringan'::text AS nama
  UNION ALL SELECT 1, 'Pelanggaran Sedang'
  UNION ALL SELECT 2, 'Pelanggaran Berat'
  UNION ALL SELECT 3, 'Hukuman Ringan SP-1'
  UNION ALL SELECT 4, 'Hukuman Sedang SP-2 (Botak)'
  UNION ALL SELECT 5, 'Hukuman Berat SP-3 (Pemanggilan Orang Tua)'
  UNION ALL SELECT 6, 'Lain-lain (1)'
  UNION ALL SELECT 7, 'Lain-lain (2)'
)
UPDATE "RaportMentalAspek" a
SET
  "nama" = t.nama,
  "punyaFieldData" = true,
  "fieldDataType" = 'TEXT'::"RaportMentalFieldDataType",
  "isActive" = true,
  "updatedAt" = NOW()
FROM target_aspek t
JOIN "RaportMentalSeksi" s
  ON s."kode" = 'AKUMULASI'
WHERE a."seksiId" = s."id"
  AND a."urutan" = t.urutan;

WITH target_aspek AS (
  SELECT 0 AS urutan, 'Pelanggaran Ringan'::text AS nama
  UNION ALL SELECT 1, 'Pelanggaran Sedang'
  UNION ALL SELECT 2, 'Pelanggaran Berat'
  UNION ALL SELECT 3, 'Hukuman Ringan SP-1'
  UNION ALL SELECT 4, 'Hukuman Sedang SP-2 (Botak)'
  UNION ALL SELECT 5, 'Hukuman Berat SP-3 (Pemanggilan Orang Tua)'
  UNION ALL SELECT 6, 'Lain-lain (1)'
  UNION ALL SELECT 7, 'Lain-lain (2)'
)
INSERT INTO "RaportMentalAspek" (
  "id", "seksiId", "nama", "keterangan", "urutan", "punyaFieldData", "fieldDataType", "isActive", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  s."id",
  t.nama,
  'Kolom jumlah + keterangan sesuai dokumen',
  t.urutan,
  true,
  'TEXT'::"RaportMentalFieldDataType",
  true,
  NOW(),
  NOW()
FROM target_aspek t
JOIN "RaportMentalSeksi" s
  ON s."kode" = 'AKUMULASI'
LEFT JOIN "RaportMentalAspek" a
  ON a."seksiId" = s."id"
 AND a."urutan" = t.urutan
WHERE a."id" IS NULL;

UPDATE "RaportMentalSeksi"
SET
  "nama" = 'Penilaian Akhir',
  "tipeNilai" = 'TEXT',
  "updatedAt" = NOW()
WHERE "kode" = 'PENILAIAN_AKHIR';

INSERT INTO "RaportMentalSeksi" (
  "id", "nama", "kode", "deskripsi", "urutan", "tipeNilai", "isActive", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'Penilaian Akhir',
  'PENILAIAN_AKHIR',
  'Seksi Q sesuai dokumen raport mental',
  17,
  'TEXT'::"TipeNilaiRaportMental",
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "RaportMentalSeksi" WHERE "kode" = 'PENILAIAN_AKHIR'
);

WITH target_aspek AS (
  SELECT 0 AS urutan, 'Positif'::text AS nama
  UNION ALL SELECT 1, 'Negatif'
)
UPDATE "RaportMentalAspek" a
SET
  "nama" = t.nama,
  "punyaFieldData" = false,
  "fieldDataType" = 'NONE'::"RaportMentalFieldDataType",
  "isActive" = true,
  "updatedAt" = NOW()
FROM target_aspek t
JOIN "RaportMentalSeksi" s
  ON s."kode" = 'PENILAIAN_AKHIR'
WHERE a."seksiId" = s."id"
  AND a."urutan" = t.urutan;

WITH target_aspek AS (
  SELECT 0 AS urutan, 'Positif'::text AS nama
  UNION ALL SELECT 1, 'Negatif'
)
INSERT INTO "RaportMentalAspek" (
  "id", "seksiId", "nama", "keterangan", "urutan", "punyaFieldData", "fieldDataType", "isActive", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  s."id",
  t.nama,
  'Catatan akhir raport mental',
  t.urutan,
  false,
  'NONE'::"RaportMentalFieldDataType",
  true,
  NOW(),
  NOW()
FROM target_aspek t
JOIN "RaportMentalSeksi" s
  ON s."kode" = 'PENILAIAN_AKHIR'
LEFT JOIN "RaportMentalAspek" a
  ON a."seksiId" = s."id"
 AND a."urutan" = t.urutan
WHERE a."id" IS NULL;

UPDATE "RaportMentalAspek" a
SET
  "isActive" = false,
  "updatedAt" = NOW()
FROM "RaportMentalSeksi" s
WHERE s."kode" = 'PENILAIAN_AKHIR'
  AND a."seksiId" = s."id"
  AND a."urutan" > 1;
