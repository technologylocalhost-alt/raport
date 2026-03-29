UPDATE "RaportMentalSeksi"
SET
  "nama" = 'Penilaian Akhir',
  "tipeNilai" = 'TEXT',
  "updatedAt" = NOW()
WHERE "kode" = 'PENILAIAN_AKHIR';

WITH target_aspek AS (
  SELECT 0 AS urutan, 'Positif'::text AS nama
  UNION ALL
  SELECT 1, 'Negatif'
)
UPDATE "RaportMentalAspek" a
SET
  "nama" = t.nama,
  "punyaFieldData" = false,
  "isActive" = true,
  "updatedAt" = NOW()
FROM target_aspek t
JOIN "RaportMentalSeksi" s
  ON s."kode" = 'PENILAIAN_AKHIR'
WHERE a."seksiId" = s."id"
  AND a."urutan" = t.urutan;

UPDATE "RaportMentalAspek" a
SET
  "isActive" = false,
  "updatedAt" = NOW()
FROM "RaportMentalSeksi" s
WHERE s."kode" = 'PENILAIAN_AKHIR'
  AND a."seksiId" = s."id"
  AND a."urutan" > 1;
