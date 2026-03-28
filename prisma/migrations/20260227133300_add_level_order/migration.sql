/*
  Warnings:

  - The values [DAILY] on the enum `AssessmentType` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[subjectId,teacherId,code]` on the table `Competency` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AssessmentType_new" AS ENUM ('UTS_1', 'UAS_1', 'UTS_2', 'UAS_2', 'FINAL_EXAM_1', 'FINAL_EXAM_2');
ALTER TABLE "Grade" ALTER COLUMN "assessmentType" TYPE "AssessmentType_new" USING ("assessmentType"::text::"AssessmentType_new");
ALTER TABLE "NilaiApprove" ALTER COLUMN "assessmentType" TYPE "AssessmentType_new" USING ("assessmentType"::text::"AssessmentType_new");
ALTER TYPE "AssessmentType" RENAME TO "AssessmentType_old";
ALTER TYPE "AssessmentType_new" RENAME TO "AssessmentType";
DROP TYPE "public"."AssessmentType_old";
COMMIT;

-- DropIndex
DROP INDEX "Competency_subjectId_code_key";

-- AlterTable
ALTER TABLE "Competency" ADD COLUMN     "teacherId" TEXT;

-- AlterTable
ALTER TABLE "Level" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Competency_teacherId_idx" ON "Competency"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "Competency_subjectId_teacherId_code_key" ON "Competency"("subjectId", "teacherId", "code");

-- AddForeignKey
ALTER TABLE "Competency" ADD CONSTRAINT "Competency_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
