"use client";
import { useState, useCallback, useMemo } from "react";
import { MatchCard } from "@/components/MatchCard";
import { Button } from "@/components/ui/button";
import { rollScoreline } from "@/lib/random-scores";

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

type Entry = { home: string; away: string };
type PickState = Record<number, Entry>;

const BLANK: Entry = { home: "", away: "" };

// Build the editable state from the picks saved on the server.
function stateFromSchedules(schedules: Schedule[]): PickState {
  const state: PickState = {};
  for (const s of schedules) {
    const p = s.picks[0];
    state[s.id] = {
      home: p?.homeScore != null ? String(p.homeScore) : "",
      away: p?.awayScore != null ? String(p.awayScore) : "",
    };
  }
  return state;
}

// Deep copy so reverting can't share references with live state.
function clone(state: PickState): PickState {
  const next: PickState = {};
  for (const id of Object.keys(state)) next[Number(id)] = { ...state[Number(id)] };
  return next;
}

// Canonical form for change detection (order-independent).
function serialize(state: PickState): string {
  return Object.keys(state)
    .map(Number)
    .sort((a, b) => a - b)
    .map((id) => `${id}:${state[id].home}|${state[id].away}`)
    .join(";");
}

// A game is a real pick only when BOTH scores are filled with a valid number.
function toSavedPick(scheduleId: number, entry: Entry): { scheduleId: number; homeScore: number; awayScore: number } | null {
  if (entry.home === "" || entry.away === "") return null;
  const h = parseInt(entry.home);
  const a = parseInt(entry.away);
  if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return null;
  return { scheduleId, homeScore: h, awayScore: a };
}

export function PicksClient({ activeBetWeek, activeSchedules }: Props) {
  const [picks, setPicks] = useState<PickState>(() => stateFromSchedules(activeSchedules));
  // Last-saved on-screen state, used to detect and revert unsaved changes.
  const [savedState, setSavedState] = useState<PickState>(() => stateFromSchedules(activeSchedules));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const savedSnapshot = useMemo(() => serialize(savedState), [savedState]);
  const dirty = useMemo(() => serialize(picks) !== savedSnapshot, [picks, savedSnapshot]);

  const setScore = useCallback((scheduleId: number, home: string, away: string) => {
    setPicks((prev) => ({ ...prev, [scheduleId]: { home, away } }));
  }, []);

  const reset = useCallback(() => {
    setPicks((prev) => {
      const next: PickState = {};
      for (const id of Object.keys(prev)) next[Number(id)] = { ...BLANK };
      return next;
    });
  }, []);

  // Discard unsaved edits: revert to the last-saved state.
  const cancel = useCallback(() => {
    setPicks(clone(savedState));
  }, [savedState]);

  const rollTheDice = useCallback(() => {
    setPicks((prev) => {
      const next: PickState = {};
      for (const id of Object.keys(prev)) {
        const { home, away } = rollScoreline();
        next[Number(id)] = { home: String(home), away: String(away) };
      }
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    if (!activeBetWeek) return;
    setSaving(true);
    try {
      const filled = Object.entries(picks)
        .map(([id, entry]) => toSavedPick(Number(id), entry))
        .filter((p): p is NonNullable<typeof p> => p !== null);

      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betWeekId: activeBetWeek.id, picks: filled }),
      });
      if (!res.ok) return;

      setSavedState(clone(picks));
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  }, [activeBetWeek, picks]);

  return (
    <div className="space-y-8">
      {activeBetWeek ? (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-semibold">Betweek {activeBetWeek.week} — Active</h2>
            <div className="flex items-center gap-2">
              {saving && <span className="text-sm text-muted-foreground">Saving…</span>}
              {!saving && dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
              {!saving && !dirty && savedAt && (
                <span className="text-sm text-muted-foreground">Saved at {savedAt}</span>
              )}
              <Button variant="outline" size="sm" onClick={rollTheDice} disabled={saving}>
                Roll the dice
              </Button>
              <Button variant="outline" size="sm" onClick={reset} disabled={saving}>
                Reset
              </Button>
              <Button variant="outline" size="sm" onClick={cancel} disabled={saving || !dirty}>
                Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={saving || !dirty}>
                Save
              </Button>
            </div>
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
                homeScore={picks[s.id]?.home ?? ""}
                awayScore={picks[s.id]?.away ?? ""}
                onScoreChange={setScore}
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
