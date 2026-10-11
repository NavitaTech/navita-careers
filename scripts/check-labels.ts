/**
 * Finds a clear place for every city name.
 *
 * The brief says the university list will be swapped for the real partner
 * schools, and a new city can push a name on top of a neighbouring marker. This
 * prints the label sides that are collision-free for one city, so the fix is a
 * lookup rather than an afternoon of nudging numbers.
 *
 * Run: npm run labels -- Bristol
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { geoTransverseMercator } from 'd3-geo'
import { buildCities } from '../src/lib/geo-core.ts'
import { labelBox, overlapArea, boxCoversPoint, DOT_RADIUS } from '../src/lib/labels.ts'
import type { City, LabelSide } from '../src/lib/types.ts'

const read = (p: string) => JSON.parse(readFileSync(resolve(process.cwd(), p), 'utf8'))
const map = read('src/data/uk-map.json')
const universities = read('src/data/universities.json').universities
const config = read('src/data/cities.json').cities

const projection = geoTransverseMercator()
  .rotate(map.projection.rotate)
  .scale(map.projection.scale)
  .translate(map.projection.translate)

const SIDES: LabelSide[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

function problems(cities: City[]): string[] {
  const found: string[] = []
  for (let i = 0; i < cities.length; i += 1) {
    for (let j = i + 1; j < cities.length; j += 1) {
      if (overlapArea(labelBox(cities[i]), labelBox(cities[j])) > 0) {
        found.push(`${cities[i].name} overlaps ${cities[j].name}`)
      }
    }
  }
  for (const label of cities) {
    for (const marker of cities) {
      if (boxCoversPoint(labelBox(label), marker.x, marker.y, DOT_RADIUS)) {
        found.push(`${label.name} covers the ${marker.name} marker`)
      }
    }
  }
  return found
}

const build = (cfg: Record<string, unknown>): City[] =>
  buildCities(universities, cfg as never, (lon, lat) => projection([lon, lat])!, map.nations)

const target = process.argv[3]

if (!target) {
  const current = problems(build(config))
  if (current.length === 0) {
    console.log('Every city name is clear of every other name and marker.')
  } else {
    console.log(`${current.length} placement problem(s):`)
    for (const problem of current) console.log(`  - ${problem}`)
    console.log('\nRe-run with a city name to see where it could go instead:')
    console.log('  npm run labels -- Bristol')
  }
  process.exit(current.length === 0 ? 0 : 1)
}

console.log(`Placement options for ${target}:\n`)
let clean = 0
for (const side of SIDES) {
  for (const leader of [false, true]) {
    const trial = { ...config, [target]: { ...(config[target] ?? {}), label: side, leader } }
    const found = problems(build(trial))
    if (found.length === 0) clean += 1
    console.log(
      `  ${side.padEnd(3)} leader=${String(leader).padEnd(5)} ${
        found.length === 0 ? 'clear' : `${found.length} problem(s): ${found.join('; ')}`
      }`,
    )
  }
}
console.log(`\n${clean} of 16 placements are clear. Set it in src/data/cities.json.`)
