-- CreateTable
CREATE TABLE "GameScore" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameScore_name_key" ON "GameScore"("name");

-- CreateIndex
CREATE INDEX "GameScore_score_idx" ON "GameScore"("score");
