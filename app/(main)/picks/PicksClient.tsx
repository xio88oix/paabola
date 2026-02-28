"use client";
import { useState, useCallback } from "react";
import { MatchCard } from "@/components/MatchCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Team { id: number; club: string }
interface Pick { homeScore: number | null; awayScore: number | null; points: number | null }
interface Schedule {
  id: number;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  picks: Pick[];
}
interface Matchweek { id: number; week: number; status: string }

interface Props {
  userId: number;
  matchweeks: Matchweek[];
  activeMatchweek: Matchweek | null;
  activeSchedules: Schedule[];
  completedMatchweeks: Matchweek[];
  defaultCompletedId: number | null;
  initialCompletedSchedules: Schedule[];
}

export function PicksClient({
  userId,
  activeMatchweek,
  activeSchedules,
  completedMatchweeks,
  defaultCompletedId,
  initialCompletedSchedules,
}: Props) {
  const [selectedCompletedId, setSelectedCompletedId] = useState<number | null>(defaultCompletedId);
  const [completedSchedules, setCompletedSchedules] = useState<Schedule[]>(initialCompletedSchedules);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function loadCompleted(mwId: number) {
    const res = await fetch(`/api/picks?matchweekId=${mwId}&userId=${userId}`);
    const picks = await res.json();

    const schedRes = await fetch(`/api/admin/schedule?matchweekId=${mwId}`);
    const schedules: Schedule[] = await schedRes.json();

    const merged = schedules.map((s) => ({
      ...s,
      picks: picks.filter((p: { schedule: { id: number } }) => p.schedule?.id === s.id).map((p: Pick & { schedule: { id: number } }) => ({
        homeScore: p.homeScore,
        awayScore: p.awayScore,
        points: p.points,
      })),
    }));
    setCompletedSchedules(merged);
  }

  function handleCompletedSelect(val: string) {
    const id = parseInt(val);
    setSelectedCompletedId(id);
    loadCompleted(id);
  }

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
      {/* Active matchweek */}
      {activeMatchweek && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Matchweek {activeMatchweek.week} — Active</h2>
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
      )}

      {/* Completed matchweeks */}
      {completedMatchweeks.length > 0 && (
        <section>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xl font-semibold">Past Results</h2>
            <Select
              value={selectedCompletedId?.toString() ?? ""}
              onValueChange={handleCompletedSelect}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select matchweek" />
              </SelectTrigger>
              <SelectContent>
                {completedMatchweeks.map((mw) => (
                  <SelectItem key={mw.id} value={mw.id.toString()}>
                    Matchweek {mw.week}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedCompletedId && (
            <div className="border rounded-lg px-4">
              {completedSchedules.map((s) => (
                <MatchCard
                  key={s.id}
                  scheduleId={s.id}
                  homeTeam={s.homeTeam}
                  awayTeam={s.awayTeam}
                  actualHome={s.homeScore}
                  actualAway={s.awayScore}
                  initialPick={s.picks[0] ?? null}
                  isEditable={false}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {!activeMatchweek && completedMatchweeks.length === 0 && (
        <p className="text-muted-foreground">No matchweeks available.</p>
      )}
    </div>
  );
}
