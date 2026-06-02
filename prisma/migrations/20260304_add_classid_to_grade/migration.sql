-- Add classId column to Grade table
ALTER TABLE "Grade" ADD COLUMN "classId" TEXT;

-- Add classId column to NilaiApprove table
ALTER TABLE "NilaiApprove" ADD COLUMN "classId" TEXT;

-- Populate classId from student's class relationship (preserve existing data)
UPDATE "Grade" g 
SET "classId" = s."classId"
FROM "Student" s
WHERE g."studentId" = s."id" AND g."classId" IS NULL;

UPDATE "NilaiApprove" na
SET "classId" = s."classId"
FROM "Student" s
WHERE na."studentId" = s."id" AND na."classId" IS NULL;

-- Make classId NOT NULL after populating
ALTER TABLE "Grade" ALTER COLUMN "classId" SET NOT NULL;
ALTER TABLE "NilaiApprove" ALTER COLUMN "classId" SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE;
ALTER TABLE "NilaiApprove" ADD CONSTRAINT "NilaiApprove_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE;

-- Add indexes
CREATE INDEX "Grade_classId_idx" ON "Grade"("classId");
CREATE INDEX "NilaiApprove_classId_idx" ON "NilaiApprove"("classId");
