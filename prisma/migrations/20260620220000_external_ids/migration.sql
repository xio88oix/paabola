-- AlterTable: add external id mapping for football-data.org
ALTER TABLE "Team" ADD COLUMN "externalId" INTEGER;
ALTER TABLE "Schedule" ADD COLUMN "externalId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Team_externalId_key" ON "Team"("externalId");
CREATE UNIQUE INDEX "Schedule_externalId_key" ON "Schedule"("externalId");
