-- AlterTable
ALTER TABLE "Folder" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "Folder" ADD COLUMN "minViewRole" "Role" NOT NULL DEFAULT 'LECTEUR';

-- CreateIndex
CREATE INDEX "Folder_departmentId_idx" ON "Folder"("departmentId");

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
