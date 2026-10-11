/**
 * CSV export. The only way data leaves the device.
 *
 * Written UTF-8 with a byte-order mark: without it Excel on Windows reads
 * Arabic student names as mojibake, and the counselling team works in Excel.
 */
import type { Lead, ScoreEntry } from './types'
import { formatPhone } from './device'

const BOM = '﻿'

/** Quotes a field, and defuses the leading characters Excel treats as formulas. */
function cell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function toCsv(headers: string[], rows: unknown[][]): string {
  // CRLF line endings, which is what Excel expects from a .csv.
  return BOM + [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
}

const stamp = (ms: number): string => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function leadsToCsv(leads: Lead[], cityName: (id: string) => string): string {
  return toCsv(
    [
      'Timestamp',
      'Full name',
      'Mobile',
      'Grade',
      'Preferred major',
      'School',
      'Cities of interest',
      'Best score',
      'Correct',
      'Misses',
      'Attempts',
      'Assisted entry',
      'Language',
      'Device',
      'Device ID',
      'Consent',
    ],
    leads.map((lead) => [
      stamp(lead.timestamp),
      lead.fullName,
      formatPhone(lead.phone),
      lead.grade,
      lead.major,
      lead.school,
      lead.interestedCities.map(cityName).join(' | '),
      lead.score,
      lead.correct,
      lead.misses,
      lead.attempts,
      lead.assisted ? 'yes' : 'no',
      lead.lang,
      lead.deviceName,
      lead.deviceId,
      'yes',
    ]),
  )
}

export function scoresToCsv(scores: ScoreEntry[]): string {
  return toCsv(
    ['Timestamp', 'Name', 'School', 'Score', 'Correct', 'Full clear', 'Device'],
    scores.map((s) => [
      stamp(s.timestamp),
      s.displayName,
      s.school,
      s.score,
      s.correct,
      s.fullClear ? 'yes' : 'no',
      s.deviceName,
    ]),
  )
}

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Give Safari a moment to start the download before the blob is reclaimed.
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function leadsFilename(deviceName: string, when = Date.now()): string {
  const d = new Date(when)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `leads-${slug(deviceName)}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.csv`
}
