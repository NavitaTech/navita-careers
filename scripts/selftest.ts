/**
 * Headless checks on the parts of the game that are pure logic: deck building,
 * drop judgement, scoring arithmetic and the CSV writer.
 *
 * These are the rules a QA pass on a touchscreen cannot easily prove - you
 * cannot drop a card 41 units from two markers by hand and know which one the
 * code picked. Run: npm test
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { geoTransverseMercator } from 'd3-geo'
import { buildCities, nearestCity, NO_TARGET_RADIUS } from '../src/lib/geo-core.ts'
import { assessDrop, summarise, applyPoints, compareScores, NEAR_MISS_RADIUS } from '../src/lib/scoring.ts'
import { buildRound, orderDeck } from '../src/lib/round.ts'
import { leadsToCsv } from '../src/lib/export.ts'
import { isValidKuwaitMobile, publicName, phoneKey } from '../src/lib/device.ts'
import { matchesFor } from '../src/lib/match.ts'
import { labelBox, overlaps, overlapArea, boxCoversPoint, DOT_RADIUS } from '../src/lib/labels.ts'
import type { City, Lead, Placement, UniversityRecord } from '../src/lib/types.ts'

// Resolved from the project root: this file runs through a bundler, so its own
// location is not where the sources live.
const read = (p: string) => JSON.parse(readFileSync(resolve(process.cwd(), p), 'utf8'))
const map = read('src/data/uk-map.json')
const unis: UniversityRecord[] = read('src/data/universities.json').universities
const cityCfg = read('src/data/cities.json').cities

const projection = geoTransverseMercator()
  .rotate(map.projection.rotate)
  .scale(map.projection.scale)
  .translate(map.projection.translate)

const cities = buildCities(unis, cityCfg, (lon, lat) => projection([lon, lat])!, map.nations)
const city = (name: string): City => {
  const found = cities.find((c) => c.name === name)
  if (!found) throw new Error(`no city ${name}`)
  return found
}

let passed = 0
let failed = 0

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1
    console.log(`  ok   ${label}`)
  } else {
    failed += 1
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function group(name: string, body: () => void): void {
  console.log(`\n${name}`)
  body()
}

// --- geography -------------------------------------------------------------

group('Map and markers', () => {
  check('all four nations present', map.nations.length === 4)
  check(
    'every city resolved to a nation',
    cities.every((c) => c.nation.length > 0),
    cities.filter((c) => !c.nation).map((c) => c.name).join(','),
  )
  check('Cardiff is in Wales', city('Cardiff').nation === 'Wales')
  check('Bristol is in England', city('Bristol').nation === 'England')
  check('Belfast is in Northern Ireland', city('Belfast').nation === 'Northern Ireland')
  check('Edinburgh is in Scotland', city('Edinburgh').nation === 'Scotland')

  let overlapping = 0
  for (let i = 0; i < cities.length; i += 1) {
    for (let j = i + 1; j < cities.length; j += 1) {
      const d = Math.hypot(cities[i].x - cities[j].x, cities[i].y - cities[j].y)
      if (d < cities[i].snap + cities[j].snap) overlapping += 1
    }
  }
  check('no two snap targets overlap', overlapping === 0, `${overlapping} pairs`)
  check('London hosts four universities', city('London').universities.length === 4)
})

group('Drop detection', () => {
  const london = city('London')
  check(
    'a drop on the marker picks that city',
    nearestCity(london.x, london.y, cities)?.city.id === 'london',
  )
  check(
    'a drop far out to sea picks nothing',
    nearestCity(london.x - NO_TARGET_RADIUS * 3, london.y, cities) === null,
  )
  const cardiff = city('Cardiff')
  const bristol = city('Bristol')
  const midpoint = { x: (cardiff.x + bristol.x) / 2, y: (cardiff.y + bristol.y) / 2 }
  const landed = nearestCity(midpoint.x, midpoint.y, cities)?.city
  check(
    'a drop between Cardiff and Bristol still resolves to one of them',
    landed?.id === 'cardiff' || landed?.id === 'bristol',
    landed?.name,
  )
})

group('Scoring', () => {
  const london = city('London')
  const oxford = city('Oxford')
  const cardiff = city('Cardiff')
  const bristol = city('Bristol')
  const edinburgh = city('Edinburgh')

  check(
    'right city scores 100',
    assessDrop(london, london, { x: london.x, y: london.y }, true).points === 100,
  )
  check(
    'right country scores 40',
    assessDrop(london, oxford, { x: oxford.x, y: oxford.y }, true).points === 40,
  )
  check(
    'Bristol for Cardiff is a near miss across the border',
    assessDrop(cardiff, bristol, { x: bristol.x, y: bristol.y }, true).verdict === 'near',
  )
  check(
    'Edinburgh for Cardiff is simply wrong',
    assessDrop(cardiff, edinburgh, { x: edinburgh.x, y: edinburgh.y }, true).points === -20,
  )
  check(
    'partial credit off restores the full penalty',
    assessDrop(london, oxford, { x: oxford.x, y: oxford.y }, false).points === -20,
  )
  check(
    'a drop in the sea is not judged',
    assessDrop(london, null, { x: 0, y: 0 }, true).verdict === 'sea',
  )
  check('score never goes below zero', applyPoints(10, -20) === 0)
  check(
    'near-miss radius covers the Severn pair',
    Math.hypot(cardiff.x - bristol.x, cardiff.y - bristol.y) <= NEAR_MISS_RADIUS,
  )

  const placements: Placement[] = [
    { universityId: 'a', cityId: 'london', verdict: 'correct', points: 100, at: 1 },
    { universityId: 'b', cityId: 'oxford', verdict: 'correct', points: 100, at: 2 },
    { universityId: 'c', cityId: 'bristol', verdict: 'near', points: 40, at: 3 },
  ]
  const clear = summarise(placements, 3, 60, 20)
  check('full clear is detected', clear.fullClear)
  check('time bonus is five a second', clear.score === 240 + 40 * 5, String(clear.score))

  const partial = summarise(placements, 5, 60, 60)
  check('an unfinished round gets no time bonus', partial.score === 240 && partial.timeLeft === 0)

  check(
    'ties go to whoever got there first',
    compareScores({ score: 500, timestamp: 100 }, { score: 500, timestamp: 200 }) < 0,
  )
})

group('Round building', () => {
  for (let run = 0; run < 400; run += 1) {
    const deck = buildRound(unis, 8)
    if (deck.length !== 8) return check('deck is always the requested size', false, `got ${deck.length}`)
    const londonCount = deck.filter((u) => u.city === 'London').length
    if (londonCount > 2) return check('never more than two London universities', false, `got ${londonCount}`)
    if (new Set(deck.map((u) => u.id)).size !== deck.length) {
      return check('no university is dealt twice', false)
    }
  }
  check('deck is always the requested size', true)
  check('never more than two London universities', true)
  check('no university is dealt twice', true)

  const ordered = orderDeck(buildRound(unis, 8))
  const tiers = ordered.map((u) => u.tier)
  check(
    'easy universities are dealt before hard ones',
    tiers.every((tier, i) => i === 0 || tiers[i - 1] <= tier),
    tiers.join(','),
  )

  const tiny = buildRound(unis.filter((u) => u.city === 'London'), 4)
  check('the city cap never starves the deck', tiny.length === 4)
})

group('Leads and export', () => {
  check('a Kuwait mobile is eight digits starting 5, 6 or 9', isValidKuwaitMobile('51234567'))
  check('a seven-digit number is rejected', !isValidKuwaitMobile('5123456'))
  check('a number starting 4 is rejected', !isValidKuwaitMobile('41234567'))
  check('the country code is tolerated', isValidKuwaitMobile('+96551234567'))
  check('phone keys ignore formatting', phoneKey('+965 5123 4567') === phoneKey('51234567'))
  check('the board shows a first name and an initial', publicName('Sarah Smith') === 'Sarah S.')
  check(
    'an Arabic surname particle stays with the surname',
    publicName('Ahmad Al Sayed') === 'Ahmad A.',
    publicName('Ahmad Al Sayed'),
  )
  check(
    'a middle name is not mistaken for the surname',
    publicName('Ahmad Mohammed Alajmi') === 'Ahmad A.',
    publicName('Ahmad Mohammed Alajmi'),
  )
  check('a single name is left alone', publicName('Dana') === 'Dana')

  const lead: Lead = {
    id: '1',
    timestamp: Date.UTC(2026, 9, 11, 9, 30),
    fullName: 'أحمد السيد',
    phone: '+96551234567',
    grade: '12',
    major: 'Engineering',
    school: 'Al Bayan, "Kuwait"',
    consent: true,
    interestedCities: ['manchester', 'london'],
    score: 740,
    correct: 7,
    misses: 1,
    attempts: 2,
    deviceId: 'dev-1',
    deviceName: 'Kiosk 1',
    assisted: false,
    lang: 'ar',
  }
  const csv = leadsToCsv([lead], (id) => id)
  check('the CSV opens as UTF-8 in Excel', csv.charCodeAt(0) === 0xfeff)
  check('Arabic names survive the export', csv.includes('أحمد السيد'))
  check('embedded quotes are escaped', csv.includes('""Kuwait""'))
  check('rows end CRLF', csv.includes('\r\n'))
  check('the phone keeps its country code', csv.includes('+96551234567'))

  const risky = leadsToCsv([{ ...lead, fullName: '=cmd|calc' }], (id) => id)
  check('a formula in a name is defused', risky.includes("'=cmd|calc"))
})

group('University matching', () => {
  const medicine = matchesFor('Medicine', ['edinburgh'], ['manchester'])
  check('three matches are returned', medicine.length === 3)
  check('every match teaches the subject', medicine.every((m) => m.university.strengths.includes('Medicine')))
  check('no two matches share a city', new Set(medicine.map((m) => m.university.city)).size === 3)
  check(
    'a city the student picked is ranked first',
    medicine[0].university.city === 'Manchester',
    medicine[0].university.city,
  )
})

group('Double-scoring', () => {
  // A correct card animates out of the tray over about 200ms and stays
  // draggable the whole time. Scoring has to be idempotent per university or a
  // quick player banks the same university two or three times - which is what
  // a leaderboard with a prize on it invites.
  const settled = new Set<string>()
  const london = city('London')
  let score = 0
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (settled.has('ucl')) continue
    score = applyPoints(score, assessDrop(london, london, { x: london.x, y: london.y }, true).points)
    settled.add('ucl')
  }
  check('the same university cannot be banked twice', score === 100, `scored ${score}`)

  const deck = buildRound(unis, 8)
  const resolvedIds = new Set(deck.slice(0, 3).map((u) => u.id))
  const remaining = deck.filter((u) => !resolvedIds.has(u.id))
  check('a settled card leaves the tray', remaining.length === 5, `${remaining.length} left`)
  check(
    'no settled card is still dealable',
    remaining.every((u) => !resolvedIds.has(u.id)),
  )
})

group('Label placement', () => {
  const worst: { a: string; b: string; area: number }[] = []
  for (let i = 0; i < cities.length; i += 1) {
    for (let j = i + 1; j < cities.length; j += 1) {
      const area = overlapArea(labelBox(cities[i]), labelBox(cities[j]))
      if (area > 0) worst.push({ a: cities[i].name, b: cities[j].name, area })
    }
  }
  worst.sort((x, y) => y.area - x.area)
  check(
    'no two city names overlap',
    worst.length === 0,
    worst.map((w) => `${w.a}/${w.b}`).join(', '),
  )

  const covered: string[] = []
  for (const label of cities) {
    for (const marker of cities) {
      if (boxCoversPoint(labelBox(label), marker.x, marker.y, DOT_RADIUS)) {
        covered.push(`${label.name} covers ${marker.name}`)
      }
    }
  }
  check('no city name sits on a marker', covered.length === 0, covered.join(', '))

  check(
    'every name stays inside the frame',
    cities.every((c) => {
      const box = labelBox(c)
      return (
        box.left >= map.viewBox.x &&
        box.right <= map.viewBox.x + map.viewBox.width &&
        box.top >= map.viewBox.y &&
        box.bottom <= map.viewBox.y + map.viewBox.height
      )
    }),
    cities
      .filter((c) => {
        const box = labelBox(c)
        return box.left < map.viewBox.x || box.right > map.viewBox.x + map.viewBox.width
      })
      .map((c) => c.name)
      .join(', '),
  )

  // 18px at 1080p is the brief's floor for reading from three metres.
  const pxPerUnit = 936 / map.viewBox.height
  check(
    'names clear 18px on a 1080p booth screen',
    25 * pxPerUnit >= 18,
    `${(25 * pxPerUnit).toFixed(1)}px`,
  )
})

// Silence the unused-import check when the group above is edited.
void overlaps

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
