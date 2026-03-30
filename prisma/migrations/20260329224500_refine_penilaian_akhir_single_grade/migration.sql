UPDATE "RaportMentalSeksi"
SET
  "nama" = 'Penilaian Akhir',
  "tipeNilai" = 'NILAI_ABCDE',
  "updatedAt" = NOW()
WHERE "kode" = 'PENILAIAN_AKHIR';

UPDATE "RaportMentalAspek" a
SET
  "nama" = 'Penilaian Akhir',
  "punyaFieldData" = false,
  "fieldDataType" = 'NONE'::"RaportMentalFieldDataType",
  "isActive" = true,
  "updatedAt" = NOW()
FROM "RaportMentalSeksi" s
WHERE s."kode" = 'PENILAIAN_AKHIR'
  AND a."seksiId" = s."id"
  AND a."urutan" = 0;

UPDATE "RaportMentalAspek" a
SET
  "isActive" = false,
  "updatedAt" = NOW()
FROM "RaportMentalSeksi" s
WHERE s."kode" = 'PENILAIAN_AKHIR'
  AND a."seksiId" = s."id"
  AND a."urutan" > 0;
