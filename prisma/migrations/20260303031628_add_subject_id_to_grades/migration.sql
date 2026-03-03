-- AlterTable
-- First add the column as nullable
ALTER TABLE "Grade" ADD COLUMN "subjectId" TEXT;

-- Populate subjectId from competency relationship
UPDATE "Grade" g
SET "subjectId" = c."subjectId"
FROM "Competency" c
WHERE g."competencyId" = c."id" AND g."subjectId" IS NULL;

-- Keep subjectId nullable to allow grades without competency AND without explicit subject
-- Create index
CREATE INDEX "Grade_subjectId_idx" ON "Grade"("subjectId");

-- Add foreign key constraint (with SetNull on delete)
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_subjectId_fkey"
FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
