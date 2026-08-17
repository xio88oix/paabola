-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BetWeek" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "week" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "seasonId" INTEGER NOT NULL,
    CONSTRAINT "BetWeek_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BetWeek" ("id", "seasonId", "status", "week") SELECT "id", "seasonId", "status", "week" FROM "BetWeek";
DROP TABLE "BetWeek";
ALTER TABLE "new_BetWeek" RENAME TO "BetWeek";
CREATE UNIQUE INDEX "BetWeek_seasonId_week_key" ON "BetWeek"("seasonId", "week");
CREATE TABLE "new_Matchweek" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "week" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "seasonId" INTEGER NOT NULL,
    CONSTRAINT "Matchweek_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Matchweek" ("id", "seasonId", "status", "week") SELECT "id", "seasonId", "status", "week" FROM "Matchweek";
DROP TABLE "Matchweek";
ALTER TABLE "new_Matchweek" RENAME TO "Matchweek";
CREATE UNIQUE INDEX "Matchweek_seasonId_week_key" ON "Matchweek"("seasonId", "week");
CREATE TABLE "new_Pick" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "points" INTEGER,
    CONSTRAINT "Pick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pick_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Pick" ("awayScore", "homeScore", "id", "points", "scheduleId", "userId") SELECT "awayScore", "homeScore", "id", "points", "scheduleId", "userId" FROM "Pick";
DROP TABLE "Pick";
ALTER TABLE "new_Pick" RENAME TO "Pick";
CREATE UNIQUE INDEX "Pick_userId_scheduleId_key" ON "Pick"("userId", "scheduleId");
CREATE TABLE "new_Schedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "seasonId" INTEGER NOT NULL,
    "matchweekId" INTEGER NOT NULL,
    "betWeekId" INTEGER NOT NULL,
    "externalId" INTEGER,
    "gameNumber" INTEGER NOT NULL,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    CONSTRAINT "Schedule_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Schedule_matchweekId_fkey" FOREIGN KEY ("matchweekId") REFERENCES "Matchweek" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Schedule_betWeekId_fkey" FOREIGN KEY ("betWeekId") REFERENCES "BetWeek" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Schedule_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Schedule_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Schedule" ("awayScore", "awayTeamId", "betWeekId", "externalId", "gameNumber", "homeScore", "homeTeamId", "id", "matchweekId", "seasonId") SELECT "awayScore", "awayTeamId", "betWeekId", "externalId", "gameNumber", "homeScore", "homeTeamId", "id", "matchweekId", "seasonId" FROM "Schedule";
DROP TABLE "Schedule";
ALTER TABLE "new_Schedule" RENAME TO "Schedule";
CREATE UNIQUE INDEX "Schedule_externalId_key" ON "Schedule"("externalId");
CREATE UNIQUE INDEX "Schedule_matchweekId_gameNumber_key" ON "Schedule"("matchweekId", "gameNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
