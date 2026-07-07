/**
 * Next selection index for an up/down key press over a list of length `len`,
 * clamped to [0, len-1]. With no active selection (`current < 0`) the first key
 * press lands on the FIRST item (index 0), not the second. Returns -1 for an
 * empty list. Pure — the single shared source for the activity/commit list
 * keyboard navigation in status-backend and builds-backend.
 */
export function stepIndex(
  len: number,
  current: number,
  key: "ArrowUp" | "ArrowDown",
): number {
  if (len === 0) return -1
  if (current < 0) return 0
  return key === "ArrowDown" ? Math.min(len - 1, current + 1) : Math.max(0, current - 1)
}
