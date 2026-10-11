import type { City, UniversityRecord } from './geo-core'

export type { City, UniversityRecord, LabelSide, Nation } from './geo-core'

export type Grade = '10' | '11' | '12' | 'University' | 'Parent'
export type Major = 'Medicine' | 'Engineering' | 'Business' | 'Computer Science' | 'Law' | 'Other'
export type Lang = 'en' | 'ar'

export const GRADES: Grade[] = ['10', '11', '12', 'University', 'Parent']
export const MAJORS: Major[] = ['Medicine', 'Engineering', 'Business', 'Computer Science', 'Law', 'Other']

/** The outcome of one card leaving the tray. */
export type DropVerdict = 'correct' | 'near' | 'wrong' | 'sea'

export type Placement = {
  universityId: string
  cityId: string
  verdict: DropVerdict
  points: number
  /** Seconds elapsed in the round when this drop happened. */
  at: number
}

export type RoundResult = {
  score: number
  correct: number
  near: number
  misses: number
  /** Whole seconds left when the round ended; 0 if it ran out. */
  timeLeft: number
  durationUsed: number
  fullClear: boolean
  placements: Placement[]
  /** Cities the player got right, in the order they got them. */
  citiesPlaced: string[]
  playedAt: number
}

export type Lead = {
  id: string
  timestamp: number
  fullName: string
  /** Stored in +965xxxxxxxx form; the digits only are the dedupe key. */
  phone: string
  grade: Grade
  major: Major
  school: string
  consent: true
  /** Cities the player tapped as places they would like to study. */
  interestedCities: string[]
  score: number
  correct: number
  misses: number
  attempts: number
  deviceId: string
  deviceName: string
  /** Set when a counsellor filled the form on the student's behalf. */
  assisted: boolean
  lang: Lang
}

export type ScoreEntry = {
  id: string
  /** First name plus last initial, as shown publicly. */
  displayName: string
  school: string
  score: number
  correct: number
  fullClear: boolean
  timestamp: number
  /** Present only when the player claimed their place with a phone number. */
  phoneKey?: string
  deviceName: string
}

export type Settings = {
  universitiesPerRound: number
  roundSeconds: number
  showNamesOnCards: boolean
  soundOn: boolean
  activeUniversityIds: string[]
  pin: string
  deviceName: string
  idleSeconds: number
  /** Nation-level and near-miss partial credit. Off makes wrong drops cost full. */
  partialCredit: boolean
  /** Reveals the target city after a few seconds of hesitation. */
  hintsEnabled: boolean
  hintDelaySeconds: number
  /** Magnifying lens over crowded clusters while a card is in the air. */
  lensEnabled: boolean
  /** WhatsApp number counsellors receive student messages on, digits only. */
  whatsappNumber: string
  /** Downloads a CSV automatically once this many new leads have accumulated. */
  autoExportEvery: number
  autoExportEnabled: boolean
  /** Hides lead capture - for the pre-event version shared on social. */
  webMode: boolean
  defaultLang: Lang
}

export type Universities = {
  all: UniversityRecord[]
  byId: Map<string, UniversityRecord>
  cities: City[]
  cityById: Map<string, City>
  cityByName: Map<string, City>
}
