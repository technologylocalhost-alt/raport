-- ============================================================
-- MIGRATION: Add Raport Mental tables
-- Jalankan SQL ini di Supabase SQL Editor
-- URL: https://app.supabase.com → SQL Editor
-- ============================================================

-- 1. Buat enum TipeNilaiRaportMental
CREATE TYPE "TipeNilaiRaportMental" AS ENUM (
  'NILAI_ABCD',
  'NILAI_ABCDE',
  'NILAI_PLUS_MINUS',
  'TEXT',
  'ANGKA'
);

-- 2. Buat tabel RaportMentalSeksi (master seksi)
CREATE TABLE "RaportMentalSeksi" (
  "id"        TEXT NOT NULL,
  "nama"      TEXT NOT NULL,
  "kode"      TEXT NOT NULL,
  "deskripsi" TEXT,
  "urutan"    INTEGER NOT NULL DEFAULT 0,
  "tipeNilai" "TipeNilaiRaportMental" NOT NULL DEFAULT 'NILAI_ABCD',
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RaportMentalSeksi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RaportMentalSeksi_kode_key" ON "RaportMentalSeksi"("kode");
CREATE INDEX "RaportMentalSeksi_urutan_idx" ON "RaportMentalSeksi"("urutan");

-- 3. Buat tabel RaportMentalAspek (master aspek per seksi)
CREATE TABLE "RaportMentalAspek" (
  "id"             TEXT NOT NULL,
  "seksiId"        TEXT NOT NULL,
  "nama"           TEXT NOT NULL,
  "keterangan"     TEXT,
  "urutan"         INTEGER NOT NULL DEFAULT 0,
  "punyaFieldData" BOOLEAN NOT NULL DEFAULT false,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RaportMentalAspek_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RaportMentalAspek_seksiId_fkey"
    FOREIGN KEY ("seksiId") REFERENCES "RaportMentalSeksi"("id") ON DELETE CASCADE
);

CREATE INDEX "RaportMentalAspek_seksiId_idx" ON "RaportMentalAspek"("seksiId");
CREATE INDEX "RaportMentalAspek_urutan_idx" ON "RaportMentalAspek"("urutan");

-- 4. Buat tabel RaportMentalNilai (nilai per santri)
CREATE TABLE "RaportMentalNilai" (
  "id"           TEXT NOT NULL,
  "studentNo"    TEXT NOT NULL,
  "seksiId"      TEXT NOT NULL,
  "aspekId"      TEXT NOT NULL,
  "schoolYearId" TEXT NOT NULL,
  "semesterId"   TEXT NOT NULL,
  "nilai"        TEXT,
  "dataEkstra"   TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RaportMentalNilai_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RaportMentalNilai_seksiId_fkey"
    FOREIGN KEY ("seksiId") REFERENCES "RaportMentalSeksi"("id") ON DELETE CASCADE,
  CONSTRAINT "RaportMentalNilai_aspekId_fkey"
    FOREIGN KEY ("aspekId") REFERENCES "RaportMentalAspek"("id") ON DELETE CASCADE,
  CONSTRAINT "RaportMentalNilai_schoolYearId_fkey"
    FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE,
  CONSTRAINT "RaportMentalNilai_semesterId_fkey"
    FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "RaportMentalNilai_studentNo_aspekId_schoolYearId_semesterId_key"
  ON "RaportMentalNilai"("studentNo", "aspekId", "schoolYearId", "semesterId");
CREATE INDEX "RaportMentalNilai_studentNo_idx" ON "RaportMentalNilai"("studentNo");
CREATE INDEX "RaportMentalNilai_seksiId_idx" ON "RaportMentalNilai"("seksiId");
CREATE INDEX "RaportMentalNilai_aspekId_idx" ON "RaportMentalNilai"("aspekId");
CREATE INDEX "RaportMentalNilai_schoolYearId_idx" ON "RaportMentalNilai"("schoolYearId");
CREATE INDEX "RaportMentalNilai_semesterId_idx" ON "RaportMentalNilai"("semesterId");

-- Konfirmasi berhasil
SELECT 'Migration Raport Mental berhasil!' AS status;
