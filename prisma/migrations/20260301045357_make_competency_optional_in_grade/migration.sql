-- DropForeignKey
ALTER TABLE "Grade" DROP CONSTRAINT "Grade_competencyId_fkey";

-- DropIndex
DROP INDEX "Grade_studentId_competencyId_teacherId_assessmentType_key";

-- AlterTable
ALTER TABLE "Grade" ALTER COLUMN "competencyId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
