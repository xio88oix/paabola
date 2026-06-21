/*
  Warnings:

  - Added the required column `betWeekId` to the `Schedule` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Team" ADD COLUMN "logo" TEXT;

-- CreateTable
CREATE TABLE "BetWeek" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "week" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "seasonId" INTEGER NOT NULL,
    CONSTRAINT "BetWeek_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScoringConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "exactScorePoints" INTEGER NOT NULL DEFAULT 10,
    "correctResultPoints" INTEGER NOT NULL DEFAULT 4
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Schedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "seasonId" INTEGER NOT NULL,
    "matchweekId" INTEGER NOT NULL,
    "betWeekId" INTEGER NOT NULL,
    "gameNumber" INTEGER NOT NULL,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    CONSTRAINT "Schedule_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Schedule_matchweekId_fkey" FOREIGN KEY ("matchweekId") REFERENCES "Matchweek" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Schedule_betWeekId_fkey" FOREIGN KEY ("betWeekId") REFERENCES "BetWeek" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Schedule_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Schedule_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Schedule" ("awayScore", "awayTeamId", "gameNumber", "homeScore", "homeTeamId", "id", "matchweekId", "seasonId") SELECT "awayScore", "awayTeamId", "gameNumber", "homeScore", "homeTeamId", "id", "matchweekId", "seasonId" FROM "Schedule";
DROP TABLE "Schedule";
ALTER TABLE "new_Schedule" RENAME TO "Schedule";
CREATE UNIQUE INDEX "Schedule_matchweekId_gameNumber_key" ON "Schedule"("matchweekId", "gameNumber");
CREATE TABLE "new_Season" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "year" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open'
);
INSERT INTO "new_Season" ("id", "year") SELECT "id", "year" FROM "Season";
DROP TABLE "Season";
ALTER TABLE "new_Season" RENAME TO "Season";
CREATE UNIQUE INDEX "Season_year_key" ON "Season"("year");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BetWeek_seasonId_week_key" ON "BetWeek"("seasonId", "week");
