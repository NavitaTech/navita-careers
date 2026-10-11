/**
 * Turns a finished round into something a counsellor can open with.
 *
 * A score alone gives them "you placed Edinburgh". A major plus the cities the
 * student chose gives them "you want Engineering and you picked Manchester -
 * here is what that costs and what grades it needs". That is the whole point of
 * capturing a lead at a booth.
 */
import type { Major, UniversityRecord } from './types'
import { universities } from './geo'

export type Match = {
  university: UniversityRecord
  /** Why this one surfaced, in the student's own terms. */
  reason: string
}

/**
 * Up to three universities for a student, ranked by: they placed it correctly
 * this round, then they named its city as somewhere they want to study, then it
 * is simply strong in their subject.
 */
export function matchesFor(
  major: Major,
  placedCityIds: string[],
  interestedCityIds: string[],
  limit = 3,
): Match[] {
  const placed = new Set(placedCityIds)
  const wanted = new Set(interestedCityIds)

  const scored = universities.all
    .filter((u) => (major === 'Other' ? true : u.strengths.includes(major)))
    .map((u) => {
      const city = universities.cityByName.get(u.city)
      const cityId = city?.id ?? ''
      let weight = 0
      let reason = `Strong in ${major}`
      if (wanted.has(cityId)) {
        weight += 3
        reason = `In ${u.city}, one of your picks`
      }
      if (placed.has(cityId)) {
        weight += 2
        if (weight === 2) reason = `You placed ${u.city} on the map`
      }
      // Nudge the broadly recognised names up when nothing else separates them.
      weight += (4 - u.tier) * 0.1
      return { university: u, reason, weight }
    })
    .sort((a, b) => b.weight - a.weight)

  // At most one per city, so three matches are three different places.
  const seen = new Set<string>()
  const out: Match[] = []
  for (const entry of scored) {
    if (seen.has(entry.university.city)) continue
    seen.add(entry.university.city)
    out.push({ university: entry.university, reason: entry.reason })
    if (out.length >= limit) break
  }
  return out
}
