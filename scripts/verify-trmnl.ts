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
    { home: "Liverpool", away: "Manchester United", homeScore: 2, awayScore: 0, pickHome: 1, pickAway: 0, points: 4 },
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
