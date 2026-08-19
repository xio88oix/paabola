import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = "https://api.football-data.org/v4";
const PL = "PL"; // Premier League competition code

export interface FdTeam {
  id: number;
  name: string;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
}

export interface FdMatch {
  id: number;
  utcDate: string;
  status: string; // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | ...
  matchday: number;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: { fullTime: { home: number | null; away: number | null } };
}

export class FootballDataError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    throw new FootballDataError(
      "FOOTBALL_DATA_TOKEN is not set. Add it to your environment (.env / docker-compose).",
      400
    );
  }
  return token;
}

async function fdFetch(query: string): Promise<{ matches: FdMatch[] }> {
  const res = await fetch(`${BASE}/competitions/${PL}/matches${query}`, {
    headers: { "X-Auth-Token": getToken() },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const msg =
      res.status === 403
        ? "football-data.org rejected the request (invalid token or competition not in your plan)."
        : res.status === 429
          ? "football-data.org rate limit reached — wait a minute and try again."
          : `football-data.org request failed (${res.status}). ${detail}`.trim();
    throw new FootballDataError(msg, res.status);
  }
  return res.json();
}

/** "2026/27" or "2026" -> 2026 (football-data uses the starting year). */
export function seasonStartYear(year: string): number {
  const match = year.match(/\d{4}/);
  if (!match) throw new FootballDataError(`Cannot parse a start year from season "${year}".`, 400);
  return parseInt(match[0]);
}

/** All Premier League fixtures for a season (by starting year). */
export async function fetchSeasonMatches(startYear: number): Promise<FdMatch[]> {
  const { matches } = await fdFetch(`?season=${startYear}`);
  return matches;
}

/** Finished fixtures for one matchday of a season. */
export async function fetchMatchdayResults(
  startYear: number,
  matchday: number
): Promise<FdMatch[]> {
  const { matches } = await fdFetch(`?season=${startYear}&matchday=${matchday}&status=FINISHED`);
  return matches;
}

// --- Team name normalization / matching -----------------------------------

const ALIASES: Record<string, string> = {
  "man city": "manchester city",
  "man united": "manchester united",
  "newcastle": "newcastle united",
  "wolverhampton": "wolves",
  "wolverhampton wanderers": "wolves",
  "brighton hove": "brighton",
  "brighton hove albion": "brighton",
  "nottingham": "nottingham forest",
  "tottenham hotspur": "tottenham",
  "spurs": "tottenham",
  "west ham united": "west ham",
};

/** Lowercase, strip FC/AFC/punctuation, collapse spaces, then apply aliases. */
export function normalizeClub(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[.'’]/g, "")
    .replace(/\bf\.?c\.?\b/g, "")
    .replace(/\bafc\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return ALIASES[base] ?? base;
}

/** A readable display name for a freshly imported team. */
export function displayName(team: FdTeam): string {
  return (team.shortName || team.name || "").replace(/\s+FC$/i, "").trim();
}

export function logoSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Downloads a crest into /public/logos and returns the public path
 * (e.g. "/logos/arsenal.png"). Returns null if there's no crest URL or the
 * download fails (caller keeps the existing logo).
 */
export async function downloadCrest(url: string | null, slug: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const ext = (url.split("?")[0].match(/\.(png|svg|jpg|jpeg|gif|webp)$/i)?.[1] ?? "png").toLowerCase();
    const dir = path.join(process.cwd(), "public", "logos");
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(dir, `${slug}.${ext}`), buf);
    return `/logos/${slug}.${ext}`;
  } catch {
    return null;
  }
}
