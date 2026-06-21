// Runs the seed only when the database has no users yet, so container
// restarts never wipe existing data. Invoked from the Docker start command
// after `prisma migrate deploy` has created the tables.
import Database from "better-sqlite3";
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const file = url.replace(/^file:/, "");

let needSeed = true;
try {
  const db = new Database(file, { fileMustExist: true });
  const row = db.prepare("SELECT COUNT(*) AS c FROM User").get();
  needSeed = !row || row.c === 0;
  db.close();
} catch {
  // File or table missing → treat as empty and seed
  needSeed = true;
}

if (needSeed) {
  console.log("Database is empty — seeding...");
  execSync("npx prisma db seed", { stdio: "inherit" });
} else {
  console.log("Database already seeded — skipping seed.");
}
