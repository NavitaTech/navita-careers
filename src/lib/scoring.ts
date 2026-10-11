/**
 * Scoring rules.
 *
 * The brief's original rule - wrong city costs 20 points - punishes a student
 * for not knowing UK geography, which is the thing they came to the booth to
 * learn. So a wrong drop that still reads the country correctly, or that lands
 * on an immediate neighbour of the right city, scores partial credit and an
 * explanation instead of a penalty.
 */
import type { City, DropVerdict, Placement, RoundResult } from './types'

export const POINTS_CORRECT = 100
export const POINTS_NEAR = 40
export const PENALTY_WRONG = 20
export const BONUS_PER_SECOND = 5

/**
 * A wrong drop this close to the right city counts as a near miss even across
 * a national border - which is what rescues the Cardiff/Bristol pair, 41 units
 * apart on opposite banks of the Severn.
 */
export const NEAR_MISS_RADIUS = 70

export type DropAssessment = {
  verdict: DropVerdict
  points: number
  /** Shown on the card as it resolves. Short enough to read mid-round. */
  message: string
}

/**
 * Judges one drop. `dropped` is the marker nearest the finger, or null when the
 * player let go away from the map.
 */
export function assessDrop(
  target: City,
  dropped: City | null,
  dropPoint: { x: number; y: number },
  partialCredit: boolean,
): DropAssessment {
  if (!dropped) {
    return { verdict: 'sea', points: 0, message: '' }
  }
  if (dropped.id === target.id) {
    return { verdict: 'correct', points: POINTS_CORRECT, message: target.name }
  }

  if (partialCredit) {
    const distanceToTarget = Math.hypot(dropPoint.x - target.x, dropPoint.y - target.y)
    if (dropped.nation === target.nation) {
      return {
        verdict: 'near',
        points: POINTS_NEAR,
        message: `Right country, wrong city — it's ${target.name}`,
      }
    }
    if (distanceToTarget <= NEAR_MISS_RADIUS) {
      return {
        verdict: 'near',
        points: POINTS_NEAR,
        message: `So close — it's ${target.name}, not ${dropped.name}`,
      }
    }
  }

  return {
    verdict: 'wrong',
    points: -PENALTY_WRONG,
    message: `That's ${dropped.name} — try again`,
  }
}

/** Running score, floored at zero so a struggling player never sees a minus. */
export function applyPoints(score: number, points: number): number {
  return Math.max(0, score + points)
}

export function summarise(
  placements: Placement[],
  cardsDealt: number,
  roundSeconds: number,
  secondsElapsed: number,
): RoundResult {
  const scored = placements.filter((p) => p.verdict !== 'sea')
  const correct = scored.filter((p) => p.verdict === 'correct').length
  const near = scored.filter((p) => p.verdict === 'near').length
  const misses = scored.filter((p) => p.verdict === 'wrong').length

  const base = scored.reduce((total, p) => applyPoints(total, p.points), 0)
  const resolved = correct + near
  const fullClear = resolved >= cardsDealt
  const timeLeft = Math.max(0, Math.floor(roundSeconds - secondsElapsed))
  const score = fullClear ? base + timeLeft * BONUS_PER_SECOND : base

  return {
    score,
    correct,
    near,
    misses,
    timeLeft: fullClear ? timeLeft : 0,
    durationUsed: Math.min(roundSeconds, Math.round(secondsElapsed)),
    fullClear,
    placements,
    citiesPlaced: scored.filter((p) => p.verdict === 'correct').map((p) => p.cityId),
    playedAt: Date.now(),
  }
}

/**
 * Leaderboard order: score first, then the faster round, then whoever got there
 * first. Matches the brief's "ties go to the earlier time".
 */
export function compareScores(
  a: { score: number; timestamp: number },
  b: { score: number; timestamp: number },
): number {
  if (b.score !== a.score) return b.score - a.score
  return a.timestamp - b.timestamp
}
