-- AlterTable: add nullable unique trmnlToken for TRMNL device authentication
ALTER TABLE "User" ADD COLUMN "trmnlToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_trmnlToken_key" ON "User"("trmnlToken");
