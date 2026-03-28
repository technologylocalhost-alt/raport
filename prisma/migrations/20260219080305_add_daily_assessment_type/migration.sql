/*
  Warnings:

  - The values [FINAL_EXAM] on the enum `AssessmentType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AssessmentType_new" AS ENUM ('DAILY', 'UTS_1', 'UAS_1', 'UTS_2', 'UAS_2', 'FINAL_EXAM_1', 'FINAL_EXAM_2');
ALTER TABLE "Grade" ALTER COLUMN "assessmentType" TYPE "AssessmentType_new" USING ("assessmentType"::text::"AssessmentType_new");
ALTER TABLE "NilaiApprove" ALTER COLUMN "assessmentType" TYPE "AssessmentType_new" USING ("assessmentType"::text::"AssessmentType_new");
ALTER TYPE "AssessmentType" RENAME TO "AssessmentType_old";
ALTER TYPE "AssessmentType_new" RENAME TO "AssessmentType";
DROP TYPE "public"."AssessmentType_old";
COMMIT;
