/**
 * University logo resolution.
 *
 * Logos are partner brand assets, so they are never drawn, traced or recreated
 * here - only loaded from public/assets/logos/.
 *
 * Which files exist is decided at build time by scripts/build-logo-manifest.ts
 * rather than discovered in the browser. Probing for them at runtime meant
 * ninety-five requests that were expected to fail, on every load, on a stand
 * where the network is the least reliable thing in the room.
 *
 * A university with no file shows a neutral initials card and is listed in the
 * admin logo check, which is how the team finds out before a student does.
 */
import type { UniversityRecord } from './types'
import logoData from '../data/logos.json'

const MANIFEST = logoData.logos as Record<string, string>

const urlFor = (file: string): string =>
  new URL(`assets/logos/${file}`, document.baseURI).href

/** The logo URL for a university, or null when no file has been supplied. */
export function cachedLogo(id: string): string | null {
  const file = MANIFEST[id]
  return file ? urlFor(file) : null
}

export const resolveLogo = cachedLogo

/** Every university mapped to its logo URL or null. Used by the admin check. */
export function resolveAll(universities: UniversityRecord[]): Map<string, string | null> {
  return new Map(universities.map((u) => [u.id, cachedLogo(u.id)]))
}

export function missingLogoIds(universities: UniversityRecord[]): string[] {
  return universities.filter((u) => !MANIFEST[u.id]).map((u) => u.id)
}

/** Files sitting in the folder that no university claims - usually a typo'd id. */
export function unusedLogoFiles(universities: UniversityRecord[]): string[] {
  const ids = new Set(universities.map((u) => u.id))
  return Object.keys(MANIFEST).filter((id) => !ids.has(id))
}

/** "University of Manchester" becomes "UM"; "LSE" stays "LSE". */
export function initialsFor(record: UniversityRecord): string {
  const stop = new Set(['of', 'the', 'and', 'college', 'university', 'school'])
  const words = record.name.split(/\s+/).filter((w) => !stop.has(w.toLowerCase()))
  const letters = words.map((w) => w[0]).join('').toUpperCase()
  return letters.slice(0, 3) || record.short.slice(0, 3).toUpperCase()
}
