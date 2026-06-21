"use client";
import { useState, useCallback } from "react";
import { MatchCard } from "@/components/MatchCard";

interface Team { id: number; club: string; logo?: string | null }
interface Pick { homeScore: number | null; awayScore: number | null; points: number | null }
interface Schedule {
  id: number;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  picks: Pick[];
}
interface BetWeek { id: number; week: number; status: string }

interface Props {
  activeBetWeek: BetWeek | null;
  activeSchedules: Schedule[];
}

export function PicksClient({ activeBetWeek, activeSchedules }: Props) {
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const handlePickChange = useCallback(
    async (scheduleId: number, homeScore: number, awayScore: number) => {
      setSaving(true);
      try {
        await fetch("/api/picks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ picks: [{ scheduleId, homeScore, awayScore }] }),
        });
        setSavedAt(new Date().toLocaleTimeString());
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return (
    <div className="space-y-8">
      {activeBetWeek ? (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Betweek {activeBetWeek.week} — Active</h2>
            {saving && <span className="text-sm text-muted-foreground">Saving…</span>}
            {!saving && savedAt && (
              <span className="text-sm text-muted-foreground">Saved at {savedAt}</span>
            )}
          </div>
          <div className="border rounded-lg px-4">
            {activeSchedules.map((s) => (
              <MatchCard
                key={s.id}
                scheduleId={s.id}
                homeTeam={s.homeTeam}
                awayTeam={s.awayTeam}
                actualHome={s.homeScore}
                actualAway={s.awayScore}
                initialPick={s.picks[0] ?? null}
                isEditable={true}
                onPickChange={handlePickChange}
              />
            ))}
          </div>
        </section>
      ) : (
        <p className="text-muted-foreground">No active betweek to pick right now.</p>
      )}
    </div>
  );
}
