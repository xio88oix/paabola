export interface ScoringValues {
  exactScorePoints: number;
  correctResultPoints: number;
}

export const DEFAULT_SCORING: ScoringValues = {
  exactScorePoints: 10,
  correctResultPoints: 4,
};

export function calculatePoints(
  pickHome: number | null | undefined,
  pickAway: number | null | undefined,
  actualHome: number | null | undefined,
  actualAway: number | null | undefined,
  scoring: ScoringValues = DEFAULT_SCORING
): number {
  if (
    pickHome == null ||
    pickAway == null ||
    actualHome == null ||
    actualAway == null
  ) {
    return 0;
  }

  if (pickHome === actualHome && pickAway === actualAway) {
    return scoring.exactScorePoints;
  }

  const pickResult = Math.sign(pickHome - pickAway);
  const actualResult = Math.sign(actualHome - actualAway);
  if (pickResult === actualResult) {
    return scoring.correctResultPoints;
  }

  return 0;
}
