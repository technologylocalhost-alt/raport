UPDATE "RaportMentalSeksi"
SET
  "urutan" = CASE
    WHEN "kode" = 'PENILAIAN_AKHIR' THEN 17
    WHEN "kode" = 'AKUMULASI' THEN 18
    ELSE "urutan"
  END,
  "updatedAt" = NOW()
WHERE "kode" IN ('PENILAIAN_AKHIR', 'AKUMULASI');
