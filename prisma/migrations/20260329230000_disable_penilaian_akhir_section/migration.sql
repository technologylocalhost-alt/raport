UPDATE "RaportMentalAspek" a
SET
  "isActive" = false,
  "updatedAt" = NOW()
FROM "RaportMentalSeksi" s
WHERE s."kode" = 'PENILAIAN_AKHIR'
  AND a."seksiId" = s."id";

UPDATE "RaportMentalSeksi"
SET
  "isActive" = false,
  "updatedAt" = NOW()
WHERE "kode" = 'PENILAIAN_AKHIR';
