-- CreateTable
CREATE TABLE "Model3dFile" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT '',
    "format" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Model3dFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Model3dFile_modelId_idx" ON "Model3dFile"("modelId");

-- AddForeignKey
ALTER TABLE "Model3dFile" ADD CONSTRAINT "Model3dFile_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model3d"("id") ON DELETE CASCADE ON UPDATE CASCADE;
