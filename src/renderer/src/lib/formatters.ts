/**
 * Basis-points (bp) convention used throughout the app:
 *   1 bp  = 0.01%
 *   100 bp = 1%
 *   1000 bp = 10%  → stored as integer 1000, represents factor 0.10
 *
 * All profitPctBp / taxRateBp fields in the DB use this unit.
 */

/** Convert basis points to a plain percentage number (e.g. 1000 → 10). */
export function bpToPercent(bp: number): number {
  return bp / 100
}

/** Convert a plain percentage number to basis points (e.g. 10 → 1000). */
export function percentToBp(pct: number): number {
  return Math.round(pct * 100)
}

/** Format basis points as a trimmed decimal string for UI display (e.g. 1000 → "10", 1050 → "10.5"). */
export function bpToPctString(bp: number): string {
  const pct = bpToPercent(bp)
  return pct.toFixed(2).replace(/\.?0+$/, '')
}

/** Strip trailing decimal zeros for generic number display. */
export function formatNumber(n: number, decimals = 2): string {
  return n.toFixed(decimals).replace(/\.?0+$/, '')
}
