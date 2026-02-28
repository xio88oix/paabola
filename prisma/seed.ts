import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import { calculatePoints } from "../lib/scoring";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

const PL_TEAMS = [
  "Arsenal",
  "Aston Villa",
  "Bournemouth",
  "Brentford",
  "Brighton",
  "Chelsea",
  "Crystal Palace",
  "Everton",
  "Fulham",
  "Ipswich Town",
  "Leicester City",
  "Liverpool",
  "Manchester City",
  "Manchester United",
  "Newcastle United",
  "Nottingham Forest",
  "Southampton",
  "Tottenham",
  "West Ham",
  "Wolves",
];

// 5 matchweeks × 10 games each — fixed fixtures
const FIXTURES: Array<[string, string][]> = [
  // Matchweek 1 (completed)
  [
    ["Arsenal", "Manchester City"],
    ["Liverpool", "Chelsea"],
    ["Tottenham", "Newcastle United"],
    ["Aston Villa", "Brighton"],
    ["West Ham", "Brentford"],
    ["Everton", "Fulham"],
    ["Crystal Palace", "Wolves"],
    ["Bournemouth", "Southampton"],
    ["Leicester City", "Nottingham Forest"],
    ["Ipswich Town", "Manchester United"],
  ],
  // Matchweek 2 (completed)
  [
    ["Manchester City", "Liverpool"],
    ["Chelsea", "Arsenal"],
    ["Newcastle United", "Aston Villa"],
    ["Brighton", "Tottenham"],
    ["Brentford", "Everton"],
    ["Fulham", "West Ham"],
    ["Wolves", "Crystal Palace"],
    ["Southampton", "Leicester City"],
    ["Nottingham Forest", "Ipswich Town"],
    ["Manchester United", "Bournemouth"],
  ],
  // Matchweek 3 (completed)
  [
    ["Arsenal", "Tottenham"],
    ["Liverpool", "Everton"],
    ["Manchester City", "Chelsea"],
    ["Aston Villa", "West Ham"],
    ["Newcastle United", "Brighton"],
    ["Brentford", "Fulham"],
    ["Crystal Palace", "Southampton"],
    ["Leicester City", "Bournemouth"],
    ["Nottingham Forest", "Manchester United"],
    ["Ipswich Town", "Wolves"],
  ],
  // Matchweek 4 (active)
  [
    ["Chelsea", "Liverpool"],
    ["Arsenal", "Aston Villa"],
    ["Tottenham", "Manchester City"],
    ["Brighton", "Newcastle United"],
    ["West Ham", "Everton"],
    ["Fulham", "Brentford"],
    ["Wolves", "Leicester City"],
    ["Bournemouth", "Crystal Palace"],
    ["Southampton", "Nottingham Forest"],
    ["Manchester United", "Ipswich Town"],
  ],
  // Matchweek 5 (open)
  [
    ["Liverpool", "Arsenal"],
    ["Manchester City", "Aston Villa"],
    ["Everton", "Tottenham"],
    ["Newcastle United", "West Ham"],
    ["Brentford", "Chelsea"],
    ["Fulham", "Crystal Palace"],
    ["Leicester City", "Southampton"],
    ["Nottingham Forest", "Bournemouth"],
    ["Ipswich Town", "Brighton"],
    ["Wolves", "Manchester United"],
  ],
];

// Actual scores for completed matchweeks (MW1, MW2, MW3)
const ACTUAL_SCORES: Array<Array<[number, number]>> = [
  // MW1
  [
    [2, 1], [1, 1], [0, 2], [3, 1], [1, 0],
    [0, 2], [1, 1], [2, 0], [0, 1], [1, 3],
  ],
  // MW2
  [
    [0, 2], [1, 2], [3, 0], [1, 1], [2, 1],
    [0, 0], [2, 2], [1, 0], [3, 1], [2, 1],
  ],
  // MW3
  [
    [2, 2], [4, 0], [1, 0], [2, 1], [1, 2],
    [0, 1], [3, 0], [1, 1], [2, 0], [1, 0],
  ],
];

// Alice's picks for MW1–4
const ALICE_PICKS: Array<Array<[number, number]>> = [
  // MW1
  [
    [2, 0], [1, 1], [1, 2], [3, 1], [1, 0],
    [1, 1], [0, 1], [2, 0], [0, 1], [2, 2],
  ],
  // MW2
  [
    [1, 1], [0, 2], [2, 0], [1, 1], [2, 1],
    [1, 0], [2, 2], [1, 0], [2, 1], [1, 1],
  ],
  // MW3
  [
    [1, 2], [3, 0], [2, 0], [1, 0], [2, 1],
    [0, 0], [2, 0], [1, 1], [2, 0], [0, 0],
  ],
  // MW4 (active — picks exist but no points yet)
  [
    [1, 2], [2, 1], [1, 1], [0, 1], [2, 0],
    [1, 0], [0, 2], [1, 1], [2, 1], [0, 0],
  ],
];

// Bob's picks for MW1–4
const BOB_PICKS: Array<Array<[number, number]>> = [
  // MW1
  [
    [1, 1], [2, 0], [0, 1], [2, 2], [1, 0],
    [0, 2], [1, 1], [2, 0], [1, 0], [0, 2],
  ],
  // MW2
  [
    [0, 1], [1, 1], [3, 0], [0, 1], [1, 1],
    [0, 0], [1, 2], [2, 0], [3, 1], [2, 0],
  ],
  // MW3
  [
    [2, 2], [3, 1], [0, 1], [2, 1], [0, 2],
    [1, 1], [3, 0], [0, 0], [1, 0], [1, 0],
  ],
  // MW4 (active)
  [
    [2, 1], [1, 0], [0, 2], [1, 1], [1, 0],
    [0, 1], [1, 2], [2, 0], [0, 1], [1, 1],
  ],
];

async function main() {
  console.log("Seeding database...");

  // Clear existing data
  await prisma.pick.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.matchweek.deleteMany();
  await prisma.season.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();

  // Create teams
  const teams: Record<string, number> = {};
  for (const club of PL_TEAMS) {
    const team = await prisma.team.create({ data: { club } });
    teams[club] = team.id;
  }
  console.log(`Created ${PL_TEAMS.length} teams`);

  // Create season
  const season = await prisma.season.create({ data: { year: 2026 } });
  console.log("Created season 2026");

  // Create users
  const hash = await bcrypt.hash("password123", 10);
  const adminUser = await prisma.user.create({
    data: { name: "admin", password: hash, isAdmin: true },
  });
  const alice = await prisma.user.create({
    data: { name: "alice", password: hash, isAdmin: false },
  });
  const bob = await prisma.user.create({
    data: { name: "bob", password: hash, isAdmin: false },
  });
  console.log("Created users: admin, alice, bob");

  const statuses = ["completed", "completed", "completed", "active", "open"];

  for (let mwIdx = 0; mwIdx < 5; mwIdx++) {
    const mw = await prisma.matchweek.create({
      data: {
        week: mwIdx + 1,
        status: statuses[mwIdx],
        seasonId: season.id,
      },
    });

    const fixtures = FIXTURES[mwIdx];
    const actualScores = ACTUAL_SCORES[mwIdx] ?? null;

    for (let gameIdx = 0; gameIdx < fixtures.length; gameIdx++) {
      const [homeClub, awayClub] = fixtures[gameIdx];
      const score = actualScores ? actualScores[gameIdx] : null;

      const schedule = await prisma.schedule.create({
        data: {
          seasonId: season.id,
          matchweekId: mw.id,
          gameNumber: gameIdx + 1,
          homeTeamId: teams[homeClub],
          awayTeamId: teams[awayClub],
          homeScore: score ? score[0] : null,
          awayScore: score ? score[1] : null,
        },
      });

      // Create picks for MW1-4
      if (mwIdx < 4) {
        const alicePick = ALICE_PICKS[mwIdx][gameIdx];
        const bobPick = BOB_PICKS[mwIdx][gameIdx];

        // Calculate points for completed weeks (MW1-3)
        const alicePoints =
          mwIdx < 3
            ? calculatePoints(alicePick[0], alicePick[1], score![0], score![1])
            : null;
        const bobPoints =
          mwIdx < 3
            ? calculatePoints(bobPick[0], bobPick[1], score![0], score![1])
            : null;

        await prisma.pick.create({
          data: {
            userId: alice.id,
            scheduleId: schedule.id,
            homeScore: alicePick[0],
            awayScore: alicePick[1],
            points: alicePoints,
          },
        });

        await prisma.pick.create({
          data: {
            userId: bob.id,
            scheduleId: schedule.id,
            homeScore: bobPick[0],
            awayScore: bobPick[1],
            points: bobPoints,
          },
        });
      }
    }

    console.log(`Created matchweek ${mwIdx + 1} (${statuses[mwIdx]})`);
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
