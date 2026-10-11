/**
 * Everything the booth remembers, on the device only.
 *
 * IndexedDB is the store of record. It is also mirrored into localStorage on
 * every write, because iPadOS Safari evicts IndexedDB for sites it considers
 * idle and an exhibition day's leads are not something to lose to a storage
 * heuristic. On startup the two are reconciled and the larger set wins.
 */
import { openDB, type IDBPDatabase } from 'idb'
import type { Lead, ScoreEntry, Settings } from './types'
import { DEFAULT_SETTINGS, clampSettings } from './config'
import { compareScores } from './scoring'
import { phoneKey } from './device'

const DB_NAME = 'uk-campus-drop'
const DB_VERSION = 1
const MIRROR_LEADS = 'ukcd.mirror.leads'
const MIRROR_SCORES = 'ukcd.mirror.scores'
const MIRROR_SETTINGS = 'ukcd.mirror.settings'
const EXPORTED_AT = 'ukcd.lastExportCount'

let dbPromise: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const leads = database.createObjectStore('leads', { keyPath: 'id' })
      leads.createIndex('timestamp', 'timestamp')
      leads.createIndex('phone', 'phone', { unique: false })
      const scores = database.createObjectStore('scores', { keyPath: 'id' })
      scores.createIndex('timestamp', 'timestamp')
      database.createObjectStore('settings')
    },
  })
  return dbPromise
}

// --- localStorage mirror ---------------------------------------------------

function readMirror<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function writeMirror(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota or private mode. IndexedDB is still authoritative; the admin screen
    // surfaces the lead count either way.
  }
}

// --- leads -----------------------------------------------------------------

export async function allLeads(): Promise<Lead[]> {
  const stored = (await db()).getAll('leads') as Promise<Lead[]>
  const fromDb = await stored
  const mirrored = readMirror<Lead>(MIRROR_LEADS)

  // Reconcile: anything in the mirror the database lost is written back.
  const byId = new Map(fromDb.map((l) => [l.id, l]))
  const recovered: Lead[] = []
  for (const lead of mirrored) {
    if (!byId.has(lead.id)) {
      byId.set(lead.id, lead)
      recovered.push(lead)
    }
  }
  if (recovered.length) {
    const tx = (await db()).transaction('leads', 'readwrite')
    await Promise.all(recovered.map((lead) => tx.store.put(lead)))
    await tx.done
  }

  return [...byId.values()].sort((a, b) => b.timestamp - a.timestamp)
}

export type SaveLeadOutcome = { lead: Lead; replacedPrevious: boolean; attempts: number }

/**
 * Saves a lead, keeping one row per phone number. A student who plays five
 * times is one lead with their best score and an attempt count, not five rows
 * the counselling team has to de-duplicate by hand.
 */
export async function saveLead(lead: Lead): Promise<SaveLeadOutcome> {
  const key = phoneKey(lead.phone)
  const existing = (await allLeads()).find((l) => phoneKey(l.phone) === key)

  let toStore = lead
  let replacedPrevious = false
  if (existing) {
    replacedPrevious = true
    toStore = {
      ...lead,
      id: existing.id,
      timestamp: existing.timestamp,
      attempts: existing.attempts + 1,
      // Keep the better round, but always take the newest contact details and
      // city picks - those are what the counsellor acts on.
      score: Math.max(existing.score, lead.score),
      correct: lead.score >= existing.score ? lead.correct : existing.correct,
      misses: lead.score >= existing.score ? lead.misses : existing.misses,
    }
  }

  await (await db()).put('leads', toStore)
  const all = await allLeads()
  writeMirror(MIRROR_LEADS, all)
  return { lead: toStore, replacedPrevious, attempts: toStore.attempts }
}

export async function clearLeads(): Promise<void> {
  await (await db()).clear('leads')
  writeMirror(MIRROR_LEADS, [])
  try {
    localStorage.removeItem(EXPORTED_AT)
  } catch {
    /* nothing to clean up */
  }
}

// --- scores ----------------------------------------------------------------

export async function allScores(): Promise<ScoreEntry[]> {
  const fromDb = (await (await db()).getAll('scores')) as ScoreEntry[]
  const mirrored = readMirror<ScoreEntry>(MIRROR_SCORES)
  const byId = new Map(fromDb.map((s) => [s.id, s]))
  for (const entry of mirrored) if (!byId.has(entry.id)) byId.set(entry.id, entry)
  return [...byId.values()].sort(compareScores)
}

export async function saveScore(entry: ScoreEntry): Promise<void> {
  const database = await db()
  if (entry.phoneKey) {
    // One row per claimed player: keep their best, so nobody farms the board.
    const existing = (await allScores()).find((s) => s.phoneKey === entry.phoneKey)
    if (existing) {
      if (entry.score <= existing.score) return
      await database.delete('scores', existing.id)
    }
  }
  await database.put('scores', entry)
  writeMirror(MIRROR_SCORES, await allScores())
}

export async function deleteScore(id: string): Promise<void> {
  await (await db()).delete('scores', id)
  writeMirror(MIRROR_SCORES, await allScores())
}

export async function clearScores(): Promise<void> {
  await (await db()).clear('scores')
  writeMirror(MIRROR_SCORES, [])
}

/** Midnight local time, which is where "today's board" resets. */
export function startOfToday(now: number = Date.now()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function startOfHour(now: number = Date.now()): number {
  const d = new Date(now)
  d.setMinutes(0, 0, 0)
  return d.getTime()
}

// --- settings --------------------------------------------------------------

export async function loadSettings(): Promise<Settings> {
  try {
    const stored = (await (await db()).get('settings', 'current')) as Settings | undefined
    if (stored) return clampSettings({ ...DEFAULT_SETTINGS, ...stored })
  } catch {
    /* fall through to the mirror */
  }
  try {
    const raw = localStorage.getItem(MIRROR_SETTINGS)
    if (raw) return clampSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) })
  } catch {
    /* fall through to defaults */
  }
  return DEFAULT_SETTINGS
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const safe = clampSettings(settings)
  await (await db()).put('settings', safe, 'current')
  writeMirror(MIRROR_SETTINGS, safe)
  return safe
}

// --- export bookkeeping ----------------------------------------------------

export function leadsExportedCount(): number {
  try {
    return Number(localStorage.getItem(EXPORTED_AT) ?? '0')
  } catch {
    return 0
  }
}

export function markLeadsExported(count: number): void {
  try {
    localStorage.setItem(EXPORTED_AT, String(count))
  } catch {
    /* non-fatal: the counter just restarts */
  }
}

/** Rough percentage of the storage quota in use, for the admin health panel. */
export async function storageHealth(): Promise<{ usedMb: number; quotaMb: number } | null> {
  if (!navigator.storage?.estimate) return null
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  return { usedMb: usage / 1048576, quotaMb: quota / 1048576 }
}

/**
 * Asks the browser to exempt this origin from eviction. Granted silently on
 * installed PWAs, which is the configuration the booth runs in.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted?.()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
