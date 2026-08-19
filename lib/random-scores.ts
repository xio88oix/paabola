// Pure helpers for the picks page "Roll the dice" button.
// No imports / no `@/` alias so this stays trivially testable via tsx.

// Probability weights for a single team's goal tally (index = goals scored).
// Weighted toward realistic low scores: 1-0 / 2-1 common, blowouts rare.
const GOAL_WEIGHTS = [0.3, 0.34, 0.22, 0.1, 0.04];

/** Roll a single team's goal count (0–4) using the weighted distribution. */
export function rollGoals(rand: () => number = Math.random): number {
  const r = rand();
  let cumulative = 0;
  for (let goals = 0; goals < GOAL_WEIGHTS.length; goals++) {
    cumulative += GOAL_WEIGHTS[goals];
    if (r < cumulative) return goals;
  }
  return GOAL_WEIGHTS.length - 1; // guard against float rounding
}

/** Roll a full scoreline; both sides are always filled. */
export function rollScoreline(rand: () => number = Math.random): { home: number; away: number } {
  return { home: rollGoals(rand), away: rollGoals(rand) };
}
