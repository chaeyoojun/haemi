-- CreateTable
CREATE TABLE "Model3dPreview" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Model3dPreview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Model3dPreview_fileId_idx" ON "Model3dPreview"("fileId");

-- AddForeignKey
ALTER TABLE "Model3dPreview" ADD CONSTRAINT "Model3dPreview_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "Model3dFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
