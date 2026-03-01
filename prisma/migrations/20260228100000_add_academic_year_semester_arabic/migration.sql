-- Add Arabic columns for academic year and semester labels
-- These are optional (nullable) to avoid affecting existing data

ALTER TABLE "SchoolYear" ADD COLUMN "tahunAkademik" TEXT;
ALTER TABLE "SchoolYear" ADD COLUMN "tahunAkademikArabic" TEXT;

ALTER TABLE "Semester" ADD COLUMN "semesterLabel" TEXT;
ALTER TABLE "Semester" ADD COLUMN "semesterLabelArabic" TEXT;
