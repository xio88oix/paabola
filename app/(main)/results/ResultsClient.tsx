"use client";
import { useState } from "react";
import { MatchCard } from "@/components/MatchCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { BetWeekResults } from "@/lib/results";

interface BetWeek { id: number; week: number; status: string }
interface User { id: number; name: string }

interface Props {
  betweeks: BetWeek[];
  users: User[];
  currentUserId: number;
  defaultBetWeekId: number | null;
  initialResults: BetWeekResults;
}

export function ResultsClient({
  betweeks,
  users,
  currentUserId,
  defaultBetWeekId,
  initialResults,
}: Props) {
  const [betWeekId, setBetWeekId] = useState<number | null>(defaultBetWeekId);
  const [userId, setUserId] = useState<number>(currentUserId);
  const [results, setResults] = useState<BetWeekResults>(initialResults);
  const [loading, setLoading] = useState(false);

  async function refresh(nextBetWeekId: number | null, nextUserId: number) {
    if (nextBetWeekId == null) {
      setResults({ schedules: [], standings: [] });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/results?betWeekId=${nextBetWeekId}&userId=${nextUserId}`
      );
      setResults(await res.json());
    } finally {
      setLoading(false);
    }
  }

  function handleBetWeek(val: string) {
    const id = parseInt(val);
    setBetWeekId(id);
    refresh(id, userId);
  }

  function handleUser(val: string) {
    const id = parseInt(val);
    setUserId(id);
    refresh(betWeekId, id);
  }

  const myStanding = results.standings.find((s) => s.userId === userId);
  const playerCount = results.standings.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="text-2xl font-bold mr-2">Results</h1>
        <div>
          <label className="text-sm font-medium block mb-1">Betweek</label>
          <Select value={betWeekId?.toString() ?? ""} onValueChange={handleBetWeek}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select betweek" />
            </SelectTrigger>
            <SelectContent>
              {betweeks.map((b) => (
                <SelectItem key={b.id} value={b.id.toString()}>
                  Betweek {b.week}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Player</label>
          <Select value={userId.toString()} onValueChange={handleUser}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id.toString()}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Total + placement */}
      <div className="flex items-center gap-6 rounded-lg border p-4">
        <div>
          <div className="text-sm text-muted-foreground">Total points</div>
          <div className="text-2xl font-bold">{myStanding?.total ?? 0}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Placement</div>
          <div className="text-2xl font-bold">
            {myStanding ? `${myStanding.rank} / ${playerCount}` : "—"}
          </div>
        </div>
      </div>

      {betWeekId == null ? (
        <p className="text-muted-foreground">No betweeks available.</p>
      ) : loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : results.schedules.length === 0 ? (
        <p className="text-muted-foreground">No fixtures for this betweek.</p>
      ) : (
        <div className="border rounded-lg px-4">
          {/* Column header — aligned to MatchCard's flex-1 / w-32 / flex-1 / w-10 columns */}
          <div className="flex items-center gap-3 py-2 border-b text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <div className="flex-1 text-right">Home</div>
            <div className="w-32 text-center">Pick / Result</div>
            <div className="flex-1 text-left">Away</div>
            <div className="w-10 text-center">Pts</div>
          </div>
          {results.schedules.map((s) => (
            <MatchCard
              key={s.id}
              scheduleId={s.id}
              homeTeam={{ id: s.id * 2, club: s.homeTeam.club, logo: s.homeTeam.logo }}
              awayTeam={{ id: s.id * 2 + 1, club: s.awayTeam.club, logo: s.awayTeam.logo }}
              actualHome={s.homeScore}
              actualAway={s.awayScore}
              initialPick={s.pick}
              isEditable={false}
            />
          ))}
        </div>
      )}

      {/* Standings for this betweek */}
      {results.standings.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Standings</h2>
          <div className="rounded-lg border divide-y">
            {results.standings.map((st) => (
              <div
                key={st.userId}
                className="flex items-center justify-between px-4 py-2"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={st.rank === 1 ? "default" : "outline"} className="w-7 justify-center">
                    {st.rank}
                  </Badge>
                  <span className={st.userId === userId ? "font-semibold" : ""}>
                    {st.name}
                  </span>
                </div>
                <span className="font-medium">{st.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
