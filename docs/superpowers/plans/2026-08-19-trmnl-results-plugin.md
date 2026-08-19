# TRMNL "Latest Results" Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose a public, per-user polling endpoint that a TRMNL e-ink device fetches on a schedule to show a player's latest BetWeek results scorecard plus the season-cumulative standings.

**Architecture:** A pure, DB-free module (`lib/trmnl.ts`) shapes already-fetched data into the TRMNL JSON payload (testable in isolation). A public route handler (`app/api/trmnl/results/route.ts`) authenticates a per-user token, reuses `getBetWeekResults` and a new `getSeasonStandings` helper, and returns that payload. Admin surfaces each user's polling URL. A committed Liquid template renders the payload on-device.

**Tech Stack:** Next.js 16 (App Router, route handlers), Prisma 7 + SQLite (better-sqlite3 adapter), TypeScript, `tsx` for standalone script verification, TRMNL private plugin (polling strategy) + Liquid templating.

## Global Constraints

- Node 22: run `source ~/.nvm/nvm.sh && nvm use 22` before any npm/npx command.
- Prisma 7: generated client is imported as `@/app/generated/prisma/client`; DB access goes through the `prisma` singleton in `lib/db.ts`. Migrations via `npx prisma migrate dev --name <name>` (regenerates the client).
- After ANY migration, RESTART `npm run dev` — the dev server caches a stale Prisma client and API routes will 500 otherwise.
- `tsx`-executed files (seed scripts, `scripts/*.ts`) CANNOT resolve the `@/` path alias. Any module a `tsx` script imports must be free of `@/` imports. `lib/trmnl.ts` MUST stay DB-free and `@/`-free for this reason (same rule as `lib/scoring.ts`).
- Any Next.js page or route handler that reads the database must set `export const dynamic = "force-dynamic"` so `next build` does not try to prerender it (no DB exists at image build time).
- Team names in the DB (`Team.club`) are full names, e.g. "Arsenal", "Manchester City", "Tottenham", "Wolves".

---

### Task 1: Pure payload logic (`lib/trmnl.ts`)

Build the DB-free transform that turns fixture rows + standings into the TRMNL JSON payload, plus the `deriveOutcome` and `abbreviate` helpers. Verified with a `tsx` assertion script (the repo has no test framework; this matches the existing `tsx`-based tooling).

**Files:**
- Create: `lib/trmnl.ts`
- Create (verification script): `scripts/verify-trmnl.ts`

**Interfaces:**
- Consumes: nothing (pure, standalone).
- Produces:
  - `abbreviate(club: string): string`
  - `deriveOutcome(pickHome: number|null, pickAway: number|null, homeScore: number|null, awayScore: number|null): "exact" | "result" | "miss" | null`
  - `interface BuildInput { season: string; week: number|null; player: string; userId: number; weekRank: number|null; fixtures: Array<{ home: string; away: string; homeScore: number|null; awayScore: number|null; pickHome: number|null; pickAway: number|null; points: number|null }>; standings: Array<{ userId: number; name: string; total: number }> }`
  - `interface TrmnlPayload { season: string; week: number|null; player: string; week_points: number; week_rank: number|null; fixtures: TrmnlFixture[]; standings: TrmnlStanding[] }`
  - `buildTrmnlPayload(input: BuildInput): TrmnlPayload`

- [ ] **Step 1: Write the failing verification script**

Create `scripts/verify-trmnl.ts` (imports via RELATIVE path — `tsx` can't resolve `@/`):

```ts
import assert from "node:assert/strict";
import { buildTrmnlPayload, deriveOutcome, abbreviate } from "../lib/trmnl";

// abbreviate: known map + 3-letter fallback
assert.equal(abbreviate("Arsenal"), "ARS");
assert.equal(abbreviate("Tottenham"), "TOT");
assert.equal(abbreviate("Madeup FC"), "MAD");

// deriveOutcome
assert.equal(deriveOutcome(2, 1, 2, 1), "exact");
assert.equal(deriveOutcome(1, 0, 3, 1), "result"); // home win predicted & actual
assert.equal(deriveOutcome(1, 1, 3, 1), "miss");   // draw predicted, home win actual
assert.equal(deriveOutcome(null, null, 2, 1), null); // no pick
assert.equal(deriveOutcome(2, 1, null, null), null); // no actual yet

// buildTrmnlPayload: full week
const payload = buildTrmnlPayload({
  season: "2026/27", week: 3, player: "alice", userId: 1, weekRank: 2,
  fixtures: [
    { home: "Arsenal", away: "Chelsea", homeScore: 2, awayScore: 1, pickHome: 2, pickAway: 1, points: 10 },
    { home: "Liverpool", away: "Manchester United", homeScore: 0, awayScore: 0, pickHome: 1, pickAway: 0, points: 4 },
    { home: "Tottenham", away: "Newcastle United", homeScore: 3, awayScore: 2, pickHome: 1, pickAway: 1, points: 0 },
  ],
  standings: [
    { userId: 2, name: "bob", total: 142 },
    { userId: 1, name: "alice", total: 128 },
  ],
});
assert.equal(payload.week_points, 14);
assert.equal(payload.week_rank, 2);
assert.equal(payload.fixtures[0].home, "ARS");
assert.equal(payload.fixtures[0].actual, "2-1");
assert.equal(payload.fixtures[0].pick, "2-1");
assert.equal(payload.fixtures[0].outcome, "exact");
assert.equal(payload.fixtures[1].outcome, "result");
assert.equal(payload.fixtures[2].outcome, "miss");
assert.equal(payload.standings[1].you, true);
assert.equal(payload.standings[0].you, false);

// buildTrmnlPayload: empty state (no completed week)
const empty = buildTrmnlPayload({
  season: "2026/27", week: null, player: "bob", userId: 2, weekRank: null,
  fixtures: [], standings: [],
});
assert.equal(empty.week, null);
assert.equal(empty.week_points, 0);
assert.deepEqual(empty.fixtures, []);

console.log("✓ trmnl payload logic OK");
```

- [ ] **Step 2: Run the script to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx tsx scripts/verify-trmnl.ts`
Expected: FAIL — `Cannot find module '../lib/trmnl'` (or "is not a function"), because `lib/trmnl.ts` does not exist yet.

- [ ] **Step 3: Implement `lib/trmnl.ts`**

Create `lib/trmnl.ts` (NO `@/` imports, NO DB access):

```ts
export const TEAM_ABBREVIATIONS: Record<string, string> = {
  "Arsenal": "ARS",
  "Aston Villa": "AVL",
  "Bournemouth": "BOU",
  "Brentford": "BRE",
  "Brighton": "BHA",
  "Chelsea": "CHE",
  "Crystal Palace": "CRY",
  "Everton": "EVE",
  "Fulham": "FUL",
  "Ipswich Town": "IPS",
  "Leicester City": "LEI",
  "Liverpool": "LIV",
  "Manchester City": "MCI",
  "Manchester United": "MUN",
  "Newcastle United": "NEW",
  "Nottingham Forest": "NFO",
  "Southampton": "SOU",
  "Tottenham": "TOT",
  "West Ham": "WHU",
  "Wolves": "WOL",
};

export function abbreviate(club: string): string {
  return TEAM_ABBREVIATIONS[club] ?? club.slice(0, 3).toUpperCase();
}

export function deriveOutcome(
  pickHome: number | null,
  pickAway: number | null,
  homeScore: number | null,
  awayScore: number | null
): "exact" | "result" | "miss" | null {
  if (pickHome === null || pickAway === null) return null; // no pick made
  if (homeScore === null || awayScore === null) return null; // no actual result yet
  if (pickHome === homeScore && pickAway === awayScore) return "exact";
  if (Math.sign(pickHome - pickAway) === Math.sign(homeScore - awayScore)) return "result";
  return "miss";
}

function score(a: number | null, b: number | null): string {
  return a === null || b === null ? "–" : `${a}-${b}`;
}

export interface TrmnlFixture {
  home: string;
  away: string;
  actual: string;
  pick: string;
  points: number;
  outcome: "exact" | "result" | "miss" | "none";
}

export interface TrmnlStanding {
  name: string;
  total: number;
  you: boolean;
}

export interface TrmnlPayload {
  season: string;
  week: number | null;
  player: string;
  week_points: number;
  week_rank: number | null;
  fixtures: TrmnlFixture[];
  standings: TrmnlStanding[];
}

export interface BuildInput {
  season: string;
  week: number | null;
  player: string;
  userId: number;
  weekRank: number | null;
  fixtures: Array<{
    home: string;
    away: string;
    homeScore: number | null;
    awayScore: number | null;
    pickHome: number | null;
    pickAway: number | null;
    points: number | null;
  }>;
  standings: Array<{ userId: number; name: string; total: number }>;
}

export function buildTrmnlPayload(input: BuildInput): TrmnlPayload {
  const fixtures: TrmnlFixture[] = input.fixtures.map((f) => ({
    home: abbreviate(f.home),
    away: abbreviate(f.away),
    actual: score(f.homeScore, f.awayScore),
    pick: score(f.pickHome, f.pickAway),
    points: f.points ?? 0,
    outcome: deriveOutcome(f.pickHome, f.pickAway, f.homeScore, f.awayScore) ?? "none",
  }));

  const week_points = fixtures.reduce((sum, f) => sum + f.points, 0);

  const standings: TrmnlStanding[] = input.standings.map((s) => ({
    name: s.name,
    total: s.total,
    you: s.userId === input.userId,
  }));

  return {
    season: input.season,
    week: input.week,
    player: input.player,
    week_points,
    week_rank: input.weekRank,
    fixtures,
    standings,
  };
}
```

- [ ] **Step 4: Run the script to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx tsx scripts/verify-trmnl.ts`
Expected: PASS — prints `✓ trmnl payload logic OK`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add lib/trmnl.ts scripts/verify-trmnl.ts
git commit -m "Add DB-free TRMNL payload shaping logic with verification script"
```

---

### Task 2: Add `User.trmnlToken` column + migration

**Files:**
- Modify: `prisma/schema.prisma` (the `model User` block, currently lines 10-16)
- Create (auto-generated): `prisma/migrations/<timestamp>_add_trmnl_token/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `User.trmnlToken` — a nullable, unique `String?` column usable in Prisma queries (`where: { trmnlToken }`, `data: { trmnlToken }`).

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, change the `User` model from:

```prisma
model User {
  id       Int     @id @default(autoincrement())
  name     String  @unique
  password String
  isAdmin  Boolean @default(false)
  picks    Pick[]
}
```

to:

```prisma
model User {
  id         Int     @id @default(autoincrement())
  name       String  @unique
  password   String
  isAdmin    Boolean @default(false)
  trmnlToken String? @unique
  picks      Pick[]
}
```

- [ ] **Step 2: Create and apply the migration**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx prisma migrate dev --name add_trmnl_token`
Expected: creates `prisma/migrations/<timestamp>_add_trmnl_token/`, applies it, and prints "Your database is now in sync with your schema" + "Generated Prisma Client".

- [ ] **Step 3: Verify the column exists**

Run: `sqlite3 dev.db ".schema User"`
Expected: the `CREATE TABLE "User"` output includes a `"trmnlToken" TEXT` column and a unique index on it.
(If `sqlite3` is unavailable, run `source ~/.nvm/nvm.sh && nvm use 22 && npx prisma migrate status` and confirm the `add_trmnl_token` migration is applied.)

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add nullable unique User.trmnlToken column"
```

---

### Task 3: `getSeasonStandings` helper + leaderboard refactor

Extract the season-cumulative standings query (currently inline in the leaderboard page) into a reusable helper so the leaderboard page and the TRMNL endpoint share one source of truth.

**Files:**
- Modify: `lib/results.ts` (append the helper + its interface)
- Modify: `app/(main)/leaderboard/page.tsx` (replace the inline query, lines 14-33 of the current file)

**Interfaces:**
- Consumes: `prisma` from `@/lib/db` (already imported in `lib/results.ts`).
- Produces:
  - `interface SeasonStanding { userId: number; name: string; total: number }`
  - `getSeasonStandings(seasonId?: number): Promise<SeasonStanding[]>` — users sorted by total points (desc, then name asc) across `completed` betweeks; optionally scoped to one season.

- [ ] **Step 1: Add the helper to `lib/results.ts`**

Append to the end of `lib/results.ts`:

```ts
export interface SeasonStanding {
  userId: number;
  name: string;
  total: number;
}

/**
 * Season-cumulative standings: total points per player across all COMPLETED
 * betweeks. Pass a seasonId to scope to a single season; omit for all seasons
 * (matches the historical leaderboard behavior). Sorted by total desc, name asc.
 */
export async function getSeasonStandings(seasonId?: number): Promise<SeasonStanding[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      picks: {
        where: {
          points: { not: null },
          schedule: {
            betWeek: {
              status: "completed",
              ...(seasonId ? { seasonId } : {}),
            },
          },
        },
        select: { points: true },
      },
    },
  });

  return users
    .map((u) => ({
      userId: u.id,
      name: u.name,
      total: u.picks.reduce((sum, p) => sum + (p.points ?? 0), 0),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
```

- [ ] **Step 2: Refactor the leaderboard page to use the helper**

Replace the entire contents of `app/(main)/leaderboard/page.tsx` with:

```tsx
import { getSeasonStandings } from "@/lib/results";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Reads live data from the database; never prerender at build time.
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const ranked = await getSeasonStandings();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leaderboard</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Total Points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranked.map((user, i) => (
            <TableRow key={user.userId} className={i === 0 ? "font-bold" : ""}>
              <TableCell>{i + 1}</TableCell>
              <TableCell>{user.name}</TableCell>
              <TableCell className="text-right">{user.total}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Verify the leaderboard renders unchanged**

Start the dev server (if not already running): `source ~/.nvm/nvm.sh && nvm use 22 && npm run dev`
Run: `curl -s http://localhost:3000/leaderboard | grep -Eo 'admin|alice|bob' | sort -u`
Expected: player names (e.g. `alice`, `bob`) appear — the page still renders the standings table with no error. (The prior behavior aggregated the same completed-betweek points; totals are unchanged.)

- [ ] **Step 4: Commit**

```bash
git add lib/results.ts "app/(main)/leaderboard/page.tsx"
git commit -m "Extract getSeasonStandings helper; reuse in leaderboard page"
```

---

### Task 4: Public polling endpoint `GET /api/trmnl/results`

**Files:**
- Create: `app/api/trmnl/results/route.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/db`), `getBetWeekResults` + `getSeasonStandings` (`@/lib/results`), `buildTrmnlPayload` (`@/lib/trmnl`).
- Produces: `GET /api/trmnl/results?token=<TOKEN>` → `200` with a `TrmnlPayload` JSON body; `401` for missing/invalid token.

- [ ] **Step 1: Create the route handler**

Create `app/api/trmnl/results/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBetWeekResults, getSeasonStandings } from "@/lib/results";
import { buildTrmnlPayload } from "@/lib/trmnl";

// Reads live data + request query; never prerender.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { trmnlToken: token } });
  if (!user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const season = await prisma.season.findFirst({ where: { status: "open" } });
  if (!season) {
    return NextResponse.json(
      buildTrmnlPayload({
        season: "",
        week: null,
        player: user.name,
        userId: user.id,
        weekRank: null,
        fixtures: [],
        standings: [],
      })
    );
  }

  const betweeks = await prisma.betWeek.findMany({
    where: { seasonId: season.id },
    orderBy: { week: "asc" },
  });
  // Most recently completed betweek, else the latest available, else none.
  const completed = betweeks.filter((b) => b.status === "completed");
  const betWeek = completed[completed.length - 1] ?? betweeks[betweeks.length - 1] ?? null;

  const standings = await getSeasonStandings(season.id);

  if (!betWeek) {
    return NextResponse.json(
      buildTrmnlPayload({
        season: season.year,
        week: null,
        player: user.name,
        userId: user.id,
        weekRank: null,
        fixtures: [],
        standings,
      })
    );
  }

  const results = await getBetWeekResults(betWeek.id, user.id);
  const weekRank = results.standings.find((s) => s.userId === user.id)?.rank ?? null;

  const payload = buildTrmnlPayload({
    season: season.year,
    week: betWeek.week,
    player: user.name,
    userId: user.id,
    weekRank,
    fixtures: results.schedules.map((r) => ({
      home: r.homeTeam.club,
      away: r.awayTeam.club,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      pickHome: r.pick?.homeScore ?? null,
      pickAway: r.pick?.awayScore ?? null,
      points: r.pick?.points ?? null,
    })),
    standings,
  });

  return NextResponse.json(payload);
}
```

- [ ] **Step 2: Seed a test token and restart the dev server**

Set a known token directly on a seeded user (bypasses the not-yet-built admin UI):

Run: `sqlite3 dev.db "UPDATE User SET trmnlToken='tok_test123' WHERE name='alice';"`

Then RESTART the dev server so it picks up the post-migration Prisma client:
`source ~/.nvm/nvm.sh && nvm use 22 && npm run dev`

- [ ] **Step 3: Verify a valid token returns the payload**

Run: `curl -s "http://localhost:3000/api/trmnl/results?token=tok_test123" | python3 -m json.tool`
Expected: JSON with `"player": "alice"`, a numeric `"week"`, a `"fixtures"` array whose entries have `home`/`away`/`actual`/`pick`/`points`/`outcome`, and a `"standings"` array where exactly one entry has `"you": true`.

- [ ] **Step 4: Verify auth failures return 401**

Run: `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/trmnl/results"`
Expected: `401`

Run: `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/trmnl/results?token=nope"`
Expected: `401`

- [ ] **Step 5: Commit**

```bash
git add app/api/trmnl/results/route.ts
git commit -m "Add public per-user TRMNL results polling endpoint"
```

---

### Task 5: Admin token provisioning (API + UI)

Let the admin generate/regenerate a user's token and copy the ready-to-paste polling URL.

**Files:**
- Create: `app/api/admin/users/trmnl-token/route.ts`
- Modify: `app/api/admin/users/route.ts` (the `GET` handler's `select`, currently line 15)
- Modify: `app/admin/users/page.tsx`

**Interfaces:**
- Consumes: `requireAdmin` pattern from `app/api/admin/users/route.ts`; `prisma` (`@/lib/db`).
- Produces: `POST /api/admin/users/trmnl-token` with body `{ userId: number }` → `{ id: number, trmnlToken: string }` (admin-only, `403` otherwise). The `GET /api/admin/users` response now includes `trmnlToken`.

- [ ] **Step 1: Create the token-generation endpoint**

Create `app/api/admin/users/trmnl-token/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomUUID } from "node:crypto";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return null;
  return session;
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { userId } = await req.json();
  const token = `tok_${randomUUID().replace(/-/g, "")}`;
  const user = await prisma.user.update({
    where: { id: userId },
    data: { trmnlToken: token },
  });
  return NextResponse.json({ id: user.id, trmnlToken: user.trmnlToken });
}
```

- [ ] **Step 2: Include `trmnlToken` in the users list response**

In `app/api/admin/users/route.ts`, change the `GET` handler's query (currently line 15) from:

```ts
  const users = await prisma.user.findMany({ select: { id: true, name: true, isAdmin: true } });
```

to:

```ts
  const users = await prisma.user.findMany({ select: { id: true, name: true, isAdmin: true, trmnlToken: true } });
```

- [ ] **Step 3: Add the TRMNL URL dialog to the users admin page**

In `app/admin/users/page.tsx`, make these four edits:

(a) Extend the `User` interface (currently line 22):

```ts
interface User { id: number; name: string; isAdmin: boolean; trmnlToken?: string | null }
```

(b) Add state next to the other `useState` calls (after line 27, `const [editing, ...]`):

```ts
  const [tokenUser, setTokenUser] = useState<User | null>(null);
```

(c) Add these two functions inside the component (e.g. right after the `remove` function, before the `return`):

```ts
  function trmnlUrl(token: string | null | undefined): string {
    if (!token) return "";
    return `${window.location.origin}/api/trmnl/results?token=${token}`;
  }

  async function regenerateToken(u: User) {
    const res = await fetch("/api/admin/users/trmnl-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id }),
    });
    const data = await res.json();
    setTokenUser({ ...u, trmnlToken: data.trmnlToken });
    load();
  }
```

(d) Add a "TRMNL" button in each row's actions cell — change the actions `<TableCell>` (currently lines 101-104) to:

```tsx
              <TableCell className="text-right space-x-2">
                <Button variant="outline" size="sm" onClick={() => setTokenUser(u)}>TRMNL</Button>
                <Button variant="outline" size="sm" onClick={() => openEdit(u)}>Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => remove(u.id)}>Delete</Button>
              </TableCell>
```

(e) Add the TRMNL dialog right before the closing `</div>` of the component (after the existing edit `</Dialog>`, currently line 144):

```tsx
      <Dialog open={!!tokenUser} onOpenChange={(o) => !o && setTokenUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>TRMNL device URL — {tokenUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {tokenUser?.trmnlToken ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Paste this as the Polling URL in the TRMNL private plugin:
                </p>
                <Input
                  readOnly
                  value={trmnlUrl(tokenUser.trmnlToken)}
                  onFocus={(e) => e.target.select()}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No token yet. Generate one to get a polling URL.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTokenUser(null)}>Close</Button>
            <Button onClick={() => tokenUser && regenerateToken(tokenUser)}>
              {tokenUser?.trmnlToken ? "Regenerate" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 4: Verify end-to-end via the UI**

With the dev server running, log in as `admin` / `password123`, go to `/admin/users`.
1. Click **TRMNL** on the `bob` row → dialog opens.
2. Click **Generate** → the read-only URL field fills with `http://localhost:3000/api/trmnl/results?token=tok_...`.
3. Copy that URL and confirm it works:

Run: `curl -s "<paste the copied URL>" | python3 -m json.tool`
Expected: JSON payload with `"player": "bob"`.
4. Reopen the dialog and click **Regenerate**; confirm the token in the URL changes and the OLD url now returns `401`:

Run: `curl -s -o /dev/null -w "%{http_code}\n" "<the OLD url>"`
Expected: `401`

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/users/trmnl-token/route.ts app/api/admin/users/route.ts app/admin/users/page.tsx
git commit -m "Add admin TRMNL token generation and polling-URL dialog"
```

---

### Task 6: Liquid template + TRMNL setup docs

Commit the on-device template and setup instructions so the plugin is reproducible. (TRMNL rendering itself is verified manually in the TRMNL editor/virtual device — it cannot be automated from this repo.)

**Files:**
- Create: `trmnl/results.liquid`
- Create: `trmnl/README.md`

**Interfaces:**
- Consumes: the `TrmnlPayload` JSON shape from Task 4 (`season`, `week`, `player`, `week_points`, `week_rank`, `fixtures[]`, `standings[]`).
- Produces: nothing consumed by later code (documentation + template artifact).

- [ ] **Step 1: Create the Liquid template**

Create `trmnl/results.liquid`:

```liquid
<div class="view view--full">
  <div class="layout">
    <div class="columns">
      <div class="column">

        <div class="title_bar">
          <span class="title">{{ player }} · {{ season }}</span>
          {% if week %}<span class="instance">Week {{ week }}</span>{% endif %}
        </div>

        {% if week %}
          <table class="table">
            <thead>
              <tr>
                <th>Match</th>
                <th>Result</th>
                <th>Pick</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {% for f in fixtures %}
              <tr>
                <td>{{ f.home }} v {{ f.away }}</td>
                <td>{{ f.actual }}</td>
                <td>{{ f.pick }}{% if f.outcome == "exact" %} ★{% elsif f.outcome == "result" %} ●{% endif %}</td>
                <td>{{ f.points }}</td>
              </tr>
              {% endfor %}
            </tbody>
          </table>
          <p class="value value--small">
            Week points: {{ week_points }}{% if week_rank %} · Rank {{ week_rank }}{% endif %}
          </p>
        {% else %}
          <div class="content"><span class="value">No results yet</span></div>
        {% endif %}

        <div class="title_bar">
          <span class="title">Season standings</span>
        </div>
        <table class="table">
          <tbody>
            {% for s in standings %}
            <tr>
              <td>{{ forloop.index }}</td>
              <td>{{ s.name }}{% if s.you %} (you){% endif %}</td>
              <td>{{ s.total }}</td>
            </tr>
            {% endfor %}
          </tbody>
        </table>

      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Create the setup README**

Create `trmnl/README.md`:

```markdown
# TRMNL "Latest Results" plugin

Shows a player's most-recently-completed BetWeek scorecard plus the
season-cumulative standings on a TRMNL device. One private plugin per person.

## Prerequisites

- Paabola reachable over the public internet (Cloudflare tunnel, e.g.
  `https://epl.eusoof.com`), same pattern as `../siglulutamu` (`f1.eusoof.com`).
- Each player has a token: Admin → Users → **TRMNL** → **Generate**, then copy
  the shown Polling URL.

## Create the private plugin (per player)

1. In TRMNL: **Plugins → Private Plugin → Add New**.
2. **Strategy:** Polling.
3. **Polling URL:** the copied
   `https://<your-domain>/api/trmnl/results?token=tok_...` for that player.
4. **Refresh interval:** ~30 minutes (results only change when a BetWeek is
   completed or results are synced).
5. **Markup:** paste the contents of `results.liquid` (this folder). Use the
   `Full` layout. Adjust class names in TRMNL's live preview if needed — the
   payload fields are the contract; the exact framework CSS classes can be
   tweaked to taste.
6. Save, then **Force Refresh** / preview to render.

## Payload contract

`GET /api/trmnl/results?token=<TOKEN>` returns:

- `season` (string), `week` (number|null), `player` (string)
- `week_points` (number), `week_rank` (number|null)
- `fixtures[]`: `{ home, away, actual, pick, points, outcome }` where
  `outcome` ∈ `exact | result | miss | none`
- `standings[]`: `{ name, total, you }` (season-cumulative, `you` marks the
  device owner)

When no BetWeek is completed yet, `week` is `null` and `fixtures` is empty
(the template shows "No results yet").

## Keeping the template in sync

`results.liquid` here is the source of truth. If you edit the markup in the
TRMNL editor, paste it back into this file and commit so the repo stays
reproducible.
```

- [ ] **Step 3: Verify the template variables match the payload**

Cross-check that every `{{ ... }}` reference in `trmnl/results.liquid` exists in the payload produced by Task 4. Compare against a live payload:

Run: `curl -s "http://localhost:3000/api/trmnl/results?token=tok_test123" | python3 -m json.tool`
Expected: the JSON contains top-level `season`, `week`, `player`, `week_points`, `week_rank`, `fixtures`, `standings`; each fixture has `home`, `away`, `actual`, `pick`, `points`, `outcome`; each standing has `name`, `total`, `you`. (These are exactly the fields referenced in the template.)

Manual (cannot be automated here): paste `results.liquid` into the TRMNL plugin editor and confirm it renders on the virtual device.

- [ ] **Step 4: Commit**

```bash
git add trmnl/results.liquid trmnl/README.md
git commit -m "Add TRMNL Liquid template and plugin setup docs"
```

---

## Self-Review

**Spec coverage:**
- Polling strategy → Task 4 (endpoint) + Task 6 (README documents Polling setup). ✓
- `User.trmnlToken` column → Task 2. ✓
- Token provisioning + polling-URL surfacing in Admin → Task 5. ✓
- Endpoint auth (token → user, 401 on bad token) → Task 4 steps 1, 3, 4. ✓
- Reuse `getBetWeekResults` + most-recent-completed BetWeek selection → Task 4. ✓
- Season-cumulative standings extracted to shared helper + leaderboard refactor → Task 3. ✓
- Flat `merge_variables` payload with `outcome` derived (not hardcoded) + abbreviations → Task 1 (`deriveOutcome` compares scores, no ScoringConfig point values) + Task 4 (maps rows). ✓
- Empty state (`week: null`) → Task 1 (empty-state test) + Task 4 (both no-season and no-betweek branches). ✓
- Liquid template committed to repo (`trmnl/results.liquid`) → Task 6. ✓
- Out of scope items (self-serve linking, live scores, logos, webhook) → not implemented. ✓

**Placeholder scan:** No TBD/TODO/"add error handling"/"similar to Task N" — all code is shown in full. ✓

**Type consistency:** `buildTrmnlPayload`/`BuildInput`/`TrmnlPayload` names identical across Task 1 and Task 4. `getSeasonStandings(seasonId?)`/`SeasonStanding{userId,name,total}` identical across Task 3 and Task 4. `trmnlToken` field name identical across Tasks 2, 4, 5. Endpoint payload fields identical across Task 1, Task 4, and Task 6 template. `outcome` values (`exact|result|miss|none`) identical between `buildTrmnlPayload` and the template's `{% if %}` checks. ✓
