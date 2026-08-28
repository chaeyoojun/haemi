-- AlterTable
ALTER TABLE "Spot" ADD COLUMN "author" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Repair" ADD COLUMN "author" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Notice" ADD COLUMN "author" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Vote" ADD COLUMN "author" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Model3d" ADD COLUMN "author" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "VoteBallot" (
    "id" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "voterKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoteBallot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoteBallot_voteId_optionId_voterKey_key" ON "VoteBallot"("voteId", "optionId", "voterKey");

-- CreateIndex
CREATE INDEX "VoteBallot_voteId_voterKey_idx" ON "VoteBallot"("voteId", "voterKey");

-- CreateIndex
CREATE INDEX "VoteBallot_optionId_idx" ON "VoteBallot"("optionId");

-- AddForeignKey
ALTER TABLE "VoteBallot" ADD CONSTRAINT "VoteBallot_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "Vote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteBallot" ADD CONSTRAINT "VoteBallot_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "VoteOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
