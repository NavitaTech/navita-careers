import type { Settings } from './types'
import universitiesData from '../data/universities.json'

const ALL_IDS = universitiesData.universities.map((u) => u.id)

export const DEFAULT_SETTINGS: Settings = {
  universitiesPerRound: 8,
  roundSeconds: 60,
  showNamesOnCards: true,
  soundOn: true,
  activeUniversityIds: ALL_IDS,
  pin: '2026',
  deviceName: 'Kiosk 1',
  idleSeconds: 45,
  partialCredit: true,
  hintsEnabled: true,
  hintDelaySeconds: 4,
  lensEnabled: true,
  whatsappNumber: '',
  autoExportEvery: 10,
  autoExportEnabled: true,
  webMode: false,
  defaultLang: 'en',
}

/** Never let an edited setting push the kiosk into an unusable state. */
export function clampSettings(s: Settings): Settings {
  return {
    ...s,
    universitiesPerRound: Math.max(3, Math.min(14, Math.round(s.universitiesPerRound))),
    roundSeconds: Math.max(20, Math.min(180, Math.round(s.roundSeconds))),
    idleSeconds: Math.max(15, Math.min(300, Math.round(s.idleSeconds))),
    hintDelaySeconds: Math.max(2, Math.min(15, Math.round(s.hintDelaySeconds))),
    autoExportEvery: Math.max(1, Math.min(500, Math.round(s.autoExportEvery))),
    pin: /^\d{4}$/.test(s.pin) ? s.pin : DEFAULT_SETTINGS.pin,
    activeUniversityIds: s.activeUniversityIds.filter((id) => ALL_IDS.includes(id)),
  }
}

/** Never more than this many universities from one city in a single round. */
export const MAX_PER_CITY = 2
