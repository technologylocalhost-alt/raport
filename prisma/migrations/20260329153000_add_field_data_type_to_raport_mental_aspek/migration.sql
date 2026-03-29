CREATE TYPE "RaportMentalFieldDataType" AS ENUM ('NONE', 'TEXT', 'PRESTASI');

ALTER TABLE "RaportMentalAspek"
ADD COLUMN "fieldDataType" "RaportMentalFieldDataType" NOT NULL DEFAULT 'NONE';

UPDATE "RaportMentalAspek"
SET "fieldDataType" = CASE
  WHEN "punyaFieldData" = true THEN 'TEXT'::"RaportMentalFieldDataType"
  ELSE 'NONE'::"RaportMentalFieldDataType"
END;
