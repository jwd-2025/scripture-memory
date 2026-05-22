/**
 * Simple SM-2-inspired interval calculator.
 *
 * Given the current interval (days) and whether the review was "good" (recalled correctly),
 * returns the next interval.
 *
 *  First review:  3 days
 *  Second review: 7 days
 *  Subsequent:    prev * 2.5  (capped at 90 days)
 */
const INTERVALS = [3, 7]
const GROWTH    = 2.5
const MAX_DAYS  = 90

export function nextInterval(currentIntervalDays, good = true) {
  if (!good) return 3 // reset on failure

  if (currentIntervalDays <= 3) return INTERVALS[1]  // 7
  if (currentIntervalDays <= 7) return Math.round(currentIntervalDays * GROWTH) // ~18
  return Math.min(Math.round(currentIntervalDays * GROWTH), MAX_DAYS)
}

export function nextReviewDate(currentIntervalDays, good = true) {
  const days = nextInterval(currentIntervalDays, good)
  const d    = new Date()
  d.setDate(d.getDate() + days)
  return { date: d.toISOString().split('T')[0], intervalDays: days }
}
