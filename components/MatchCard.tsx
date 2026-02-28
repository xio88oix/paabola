"use client";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Team { id: number; club: string }
interface Pick { homeScore: number | null; awayScore: number | null; points: number | null }

interface MatchCardProps {
  scheduleId: number;
  homeTeam: Team;
  awayTeam: Team;
  actualHome: number | null;
  actualAway: number | null;
  initialPick?: Pick | null;
  isEditable: boolean;
  onPickChange?: (scheduleId: number, homeScore: number, awayScore: number) => void;
}

export function MatchCard({
  scheduleId,
  homeTeam,
  awayTeam,
  actualHome,
  actualAway,
  initialPick,
  isEditable,
  onPickChange,
}: MatchCardProps) {
  const [homeScore, setHomeScore] = useState(
    initialPick?.homeScore != null ? String(initialPick.homeScore) : ""
  );
  const [awayScore, setAwayScore] = useState(
    initialPick?.awayScore != null ? String(initialPick.awayScore) : ""
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isEditable || !onPickChange) return;
    if (homeScore === "" || awayScore === "") return;
    const h = parseInt(homeScore);
    const a = parseInt(awayScore);
    if (isNaN(h) || isNaN(a)) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onPickChange(scheduleId, h, a);
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [homeScore, awayScore, isEditable, scheduleId, onPickChange]);

  const points = initialPick?.points;

  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-b-0">
      {/* Home team */}
      <div className="flex-1 text-right font-medium text-sm">{homeTeam.club}</div>

      {/* Scores */}
      <div className="flex items-center gap-2">
        {isEditable ? (
          <>
            <Input
              type="number"
              min={0}
              max={20}
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              className="w-14 text-center"
              placeholder="–"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="number"
              min={0}
              max={20}
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              className="w-14 text-center"
              placeholder="–"
            />
          </>
        ) : (
          <div className="flex items-center gap-2">
            <div className="text-center w-32">
              <div className="flex items-center justify-center gap-2">
                {/* Pick */}
                <span className="text-muted-foreground text-sm">
                  {initialPick?.homeScore != null ? initialPick.homeScore : "–"}
                  {" – "}
                  {initialPick?.awayScore != null ? initialPick.awayScore : "–"}
                </span>
                {/* Actual */}
                {actualHome != null && actualAway != null && (
                  <span className="font-semibold">
                    {actualHome} – {actualAway}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Away team */}
      <div className="flex-1 font-medium text-sm">{awayTeam.club}</div>

      {/* Points badge */}
      {points != null && (
        <Badge
          variant={points === 10 ? "default" : points === 4 ? "secondary" : "outline"}
          className="w-10 text-center justify-center"
        >
          {points}
        </Badge>
      )}
      {points == null && !isEditable && (
        <div className="w-10" />
      )}
    </div>
  );
}
