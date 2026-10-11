/**
 * Per-device identity. Leads are exported per kiosk and merged later, so every
 * row has to say which machine it came from.
 */
const KEY = 'ukcd.deviceId'

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function deviceId(): string {
  try {
    const existing = localStorage.getItem(KEY)
    if (existing) return existing
    const fresh = randomId()
    localStorage.setItem(KEY, fresh)
    return fresh
  } catch {
    // Private browsing, or storage blocked. A per-session id still keeps rows
    // from one kiosk distinguishable within a single export.
    return randomId()
  }
}

export const newId = randomId

/** Kuwait numbers are eight digits; this is the dedupe key for a lead. */
export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^965/, '')
}

export function isValidKuwaitMobile(phone: string): boolean {
  const digits = phoneKey(phone)
  // Kuwaiti mobile ranges start 5, 6 or 9 and are eight digits long.
  return /^[569]\d{7}$/.test(digits)
}

export function formatPhone(phone: string): string {
  const digits = phoneKey(phone)
  return digits ? `+965${digits}` : ''
}

/**
 * Particles that belong to the surname rather than standing on their own, so
 * "Ahmad Al Sayed" shows as "Ahmad A." and not "Ahmad S." - the family name is
 * "Al Sayed", and getting that wrong on a public board in Kuwait is noticed.
 */
const SURNAME_PARTICLES = new Set([
  'al', 'el', 'bin', 'ben', 'ibn', 'bint', 'abu', 'abd', 'abdul',
  'van', 'von', 'de', 'der', 'da', 'di', 'la', 'le',
])

/** First name plus the surname's initial, which is all the board ever shows. */
export function publicName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Guest'
  if (parts.length === 1) return parts[0]

  let surnameStart = parts.length - 1
  while (surnameStart > 1 && SURNAME_PARTICLES.has(parts[surnameStart - 1].toLowerCase())) {
    surnameStart -= 1
  }
  return `${parts[0]} ${parts[surnameStart][0].toUpperCase()}.`
}
