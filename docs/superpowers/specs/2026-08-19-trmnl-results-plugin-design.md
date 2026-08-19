# TRMNL "Latest Results" Plugin — Design

**Date:** 2026-08-19
**Status:** Approved for planning

## Goal

Display each player's latest Premier League results on their own TRMNL e-ink
device. Two fixed personal users only (no outside/self-serve users). The screen
shows the most-recently-completed BetWeek scorecard (their picks vs actuals +
points) as the main area, with a season-cumulative standings strip at the bottom.

## Strategy: Polling

Paabola will be published publicly via Cloudflare tunnel (e.g. `epl.eusoof.com`,
mirroring the existing `f1.eusoof.com` / `../siglulutamu` setup). Because the
server is reachable from the internet, we use TRMNL's **polling** private-plugin
strategy: TRMNL's cloud calls a read-only Paabola endpoint on a schedule, gets
JSON back, and renders it to a 1-bit 800×480 PNG via a Liquid template.

Rejected alternative — **webhook/push**: only needed when the server is behind
NAT with no public URL. Adds outbound-push code and rate/size limits (12/hr,
2 kb) for no benefit here. Not used.

Each of the two users creates their own TRMNL private plugin pointing at the same
endpoint but authenticated with their own token.

## Components

### 1. Data model change — `User.trmnlToken`

Add a nullable, unique column to `User`:

```prisma
trmnlToken String? @unique
```

- Migration adds the column (all existing rows `NULL`).
- An opaque random token is provisioned per user (see Provisioning below).
- The token is the only credential the polling endpoint accepts; it scopes the
  response to that user's results view.

### 2. Token provisioning + polling URL surfacing

- A helper generates a random opaque token (e.g. `randomUUID()`-based) and stores
  it on the user.
- The Admin area (existing `/admin`) surfaces, per user, the **full polling URL**
  ready to paste into TRMNL, e.g.
  `https://epl.eusoof.com/api/trmnl/results?token=<TOKEN>`, plus a
  "generate / regenerate token" action. This lets the admin copy one URL for
  themselves and hand the other to the second player. No public self-serve UI.

### 3. Endpoint — `GET /api/trmnl/results`

- Public (no NextAuth session), read-only.
- Auth: `token` query param (TRMNL polling supports custom query/headers).
  Missing/unknown token → `401`.
- Resolve token → `userId`.
- Find the open season (`status: "open"`).
- Select the **most-recently-completed BetWeek** using the exact logic already in
  `app/(main)/results/page.tsx:27-30` (last `status === "completed"`, else latest,
  else none).
- Scorecard: call `getBetWeekResults(betWeekId, userId)` (`lib/results.ts`) for the
  fixtures (pick vs actual + per-pick points). Derive `week_points` (sum of that
  user's pick points this week) and `week_rank` from its per-week `standings`.
- Season standings: season-cumulative leaderboard aggregation currently inline in
  `app/(main)/leaderboard/page.tsx:15-32`. **Extract this into a shared helper**
  (e.g. `getSeasonStandings()` in `lib/results.ts` or a new `lib/standings.ts`) so
  the leaderboard page and this endpoint share one source of truth. Refactor the
  page to use the helper.
- Shape and return a flat `merge_variables` JSON payload (below).

### 4. Response payload

Lean JSON (team abbreviations, no logos — 1-bit screen). Example:

```json
{
  "season": "2026/27",
  "week": 3,
  "player": "alice",
  "week_points": 14,
  "week_rank": 2,
  "fixtures": [
    {"home":"ARS","away":"CHE","actual":"2-1","pick":"2-1","points":10,"outcome":"exact"},
    {"home":"LIV","away":"MUN","actual":"0-0","pick":"1-0","points":4,"outcome":"result"},
    {"home":"TOT","away":"NEW","actual":"3-2","pick":"1-1","points":0,"outcome":"miss"}
  ],
  "standings": [
    {"name":"bob","total":142,"you":false},
    {"name":"alice","total":128,"you":true}
  ]
}
```

- `outcome` ∈ `exact | result | miss`, derived from pick points (exact-score
  points → `exact`; correct-result points → `result`; else `miss`). Point *values*
  come from `ScoringConfig`, so derive `outcome` by comparing pick vs actual, not
  by hardcoding 10/4.
- `home`/`away`: short team abbreviations. Derive from `Team.club` (a small
  abbreviation map, or first 3 letters uppercased as a fallback).
- Empty state: no completed week → `"week": null`, empty `fixtures`, but still
  include `standings` (may be empty early in the season). Template shows
  "No results yet."

### 5. Liquid template (TRMNL side)

- `view--full` layout using TRMNL's framework CSS/JS
  (`https://trmnl.com/css/latest/plugins.css`, `.../plugins.js`).
- Title row: `{{ player }} — {{ season }} · Week {{ week }}`.
- Main area: scorecard table over `fixtures` (home, score `actual`, your `pick`,
  `points`, an `outcome` marker).
- Bottom strip: season `standings`, with the `you: true` row emphasized.
- Lives in the TRMNL plugin editor, but a copy is **committed to the repo** at
  `trmnl/results.liquid` for version control and reproducibility.

## Refresh & edge cases

- Refresh interval ~30 min (set in TRMNL UI); results change only on results-sync
  or BetWeek completion.
- No open season → endpoint returns the empty state (`week: null`, empty
  standings), not an error.
- Endpoint is read-only and per-user scoped; the token exposes only that user's
  own results — the same data every logged-in user already sees in-app.

## Out of scope (YAGNI)

Self-serve device linking for arbitrary users, multi-season selection, live
in-progress scores, team logos/graphics, webhook/push path.

## Reused / touched code

- `lib/results.ts` — reuse `getBetWeekResults`; add/host `getSeasonStandings`.
- `app/(main)/results/page.tsx:27-30` — reuse BetWeek-selection logic.
- `app/(main)/leaderboard/page.tsx:15-32` — extract to shared helper, refactor page.
- `prisma/schema.prisma` + migration — add `User.trmnlToken`.
- New: `app/api/trmnl/results/route.ts`, Admin token surfacing, `trmnl/results.liquid`.
