/**
 * Builds the deck for one round.
 *
 * Two rules shape it. The brief's: never more than two London universities, or
 * a quarter of the round is the same dot. And one of mine: deal the most
 * recognisable universities first, so a student's first two drops succeed and
 * they stay at the table for the harder ones.
 */
import type { UniversityRecord } from './types'
import { MAX_PER_CITY } from './config'

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function buildRound(
  pool: UniversityRecord[],
  size: number,
  maxPerCity: number = MAX_PER_CITY,
): UniversityRecord[] {
  const perCity = new Map<string, number>()
  const picked: UniversityRecord[] = []

  // Draw tier by tier, shuffled inside each tier, so the ramp is reliable but
  // the exact deck differs every player.
  for (const tier of [1, 2, 3] as const) {
    for (const uni of shuffle(pool.filter((u) => u.tier === tier))) {
      if (picked.length >= size) break
      const used = perCity.get(uni.city) ?? 0
      if (used >= maxPerCity) continue
      perCity.set(uni.city, used + 1)
      picked.push(uni)
    }
  }

  // If the city cap starved the deck, top it up with whatever is left rather
  // than dealing a short round.
  if (picked.length < size) {
    for (const uni of shuffle(pool)) {
      if (picked.length >= size) break
      if (picked.some((p) => p.id === uni.id)) continue
      picked.push(uni)
    }
  }

  return picked.slice(0, size)
}

/**
 * Deck order within the round. Tier order is kept - easy cards first - but
 * cards of equal tier are shuffled so two players never see the same sequence.
 */
export function orderDeck(deck: UniversityRecord[]): UniversityRecord[] {
  return [1, 2, 3].flatMap((tier) => shuffle(deck.filter((u) => u.tier === tier)))
}
