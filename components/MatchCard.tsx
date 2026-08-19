"use client";
import { Dices, Eraser } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { rollScoreline } from "@/lib/random-scores";

interface Team { id: number; club: string; logo?: string | null }

function TeamLogo({ team }: { team: Team }) {
  if (!team.logo) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={team.logo}
      alt={team.club}
      width={24}
      height={24}
      className="h-6 w-6 shrink-0 object-contain"
    />
  );
}
interface Pick { homeScore: number | null; awayScore: number | null; points: number | null }

interface MatchCardProps {
  scheduleId: number;
  homeTeam: Team;
  awayTeam: Team;
  actualHome: number | null;
  actualAway: number | null;
  initialPick?: Pick | null;
  isEditable: boolean;
  // Editable mode only: score inputs are fully controlled by the parent.
  homeScore?: string;
  awayScore?: string;
  // Editable mode only: this game differs from what was last saved.
  isDirty?: boolean;
  onScoreChange?: (scheduleId: number, homeScore: string, awayScore: string) => void;
}

export function MatchCard({
  scheduleId,
  homeTeam,
  awayTeam,
  actualHome,
  actualAway,
  initialPick,
  isEditable,
  homeScore = "",
  awayScore = "",
  isDirty = false,
  onScoreChange,
}: MatchCardProps) {
  const points = initialPick?.points;
  const unsaved = isEditable && isDirty;

  return (
    <div
      className={
        "relative flex items-center gap-3 py-3 border-b last:border-b-0" +
        (unsaved
          ? " before:absolute before:inset-y-0 before:-left-3 before:w-1 before:rounded-full before:bg-amber-500"
          : "")
      }
      title={unsaved ? "Unsaved changes" : undefined}
    >
      {/* Home team */}
      <div className="flex-1 flex items-center justify-end gap-2 font-medium text-sm">
        <span className="text-right">{homeTeam.club}</span>
        <TeamLogo team={homeTeam} />
      </div>

      {/* Scores */}
      <div className="flex items-center gap-2">
        {isEditable ? (
          <>
            <Input
              type="number"
              min={0}
              max={20}
              value={homeScore}
              onChange={(e) => onScoreChange?.(scheduleId, e.target.value, awayScore)}
              className={"w-14 text-center" + (unsaved ? " border-amber-500" : "")}
              placeholder="–"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="number"
              min={0}
              max={20}
              value={awayScore}
              onChange={(e) => onScoreChange?.(scheduleId, homeScore, e.target.value)}
              className={"w-14 text-center" + (unsaved ? " border-amber-500" : "")}
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
      <div className="flex-1 flex items-center gap-2 font-medium text-sm">
        <TeamLogo team={awayTeam} />
        <span>{awayTeam.club}</span>
      </div>

      {/* Per-game actions (edit mode): roll a random score / clear this game */}
      {isEditable && (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Roll a random score for this game"
            aria-label="Roll a random score for this game"
            onClick={() => {
              const { home, away } = rollScoreline();
              onScoreChange?.(scheduleId, String(home), String(away));
            }}
          >
            <Dices className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Clear this game"
            aria-label="Clear this game"
            onClick={() => onScoreChange?.(scheduleId, "", "")}
          >
            <Eraser className="h-4 w-4" />
          </Button>
        </div>
      )}

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
