export function calculatePoints(
  pickHome: number | null | undefined,
  pickAway: number | null | undefined,
  actualHome: number | null | undefined,
  actualAway: number | null | undefined
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
    return 10;
  }

  const pickResult = Math.sign(pickHome - pickAway);
  const actualResult = Math.sign(actualHome - actualAway);
  if (pickResult === actualResult) {
    return 4;
  }

  return 0;
}
