-- DropColumn: remove `status` from Matchweek (rebuild table; SQLite has no simple DROP COLUMN with FK)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Matchweek" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "week" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    CONSTRAINT "Matchweek_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Matchweek" ("id", "seasonId", "week") SELECT "id", "seasonId", "week" FROM "Matchweek";
DROP TABLE "Matchweek";
ALTER TABLE "new_Matchweek" RENAME TO "Matchweek";
CREATE UNIQUE INDEX "Matchweek_seasonId_week_key" ON "Matchweek"("seasonId", "week");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
