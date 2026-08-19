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
