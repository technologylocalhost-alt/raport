-- DropForeignKey
ALTER TABLE "NilaiApprove" DROP CONSTRAINT "NilaiApprove_competencyId_fkey";

-- DropIndex
DROP INDEX "NilaiApprove_studentId_competencyId_teacherId_assessmentTyp_key";

-- AlterTable
ALTER TABLE "NilaiApprove" ALTER COLUMN "competencyId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "NilaiApprove" ADD CONSTRAINT "NilaiApprove_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
