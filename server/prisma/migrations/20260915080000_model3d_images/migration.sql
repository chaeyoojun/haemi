-- CreateTable
CREATE TABLE "Model3dImage" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'extra',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Model3dImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Model3dImage_modelId_idx" ON "Model3dImage"("modelId");

-- AddForeignKey
ALTER TABLE "Model3dImage" ADD CONSTRAINT "Model3dImage_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model3d"("id") ON DELETE CASCADE ON UPDATE CASCADE;
