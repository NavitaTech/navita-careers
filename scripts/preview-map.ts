/**
 * Renders a standalone SVG + PNG of the map with every city dot and label, so
 * placement can be eyeballed before any app code runs. Step 2 of the brief.
 *
 * Run: npm run map:preview
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoTransverseMercator } from 'd3-geo'

const here = dirname(fileURLToPath(import.meta.url))
const map = JSON.parse(readFileSync(resolve(here, '../src/data/uk-map.json'), 'utf8'))
const unis = JSON.parse(readFileSync(resolve(here, '../src/data/universities.json'), 'utf8')).universities
const cityCfg = JSON.parse(readFileSync(resolve(here, '../src/data/cities.json'), 'utf8')).cities

const projection = geoTransverseMercator()
  .rotate(map.projection.rotate)
  .scale(map.projection.scale)
  .translate(map.projection.translate)

type City = { name: string; x: number; y: number; label: string; leader: boolean; count: number }

const grouped = new Map<string, { lon: number; lat: number; n: number }>()
for (const u of unis) {
  const g = grouped.get(u.city) ?? { lon: 0, lat: 0, n: 0 }
  g.lon += u.lon
  g.lat += u.lat
  g.n += 1
  grouped.set(u.city, g)
}

const cities: City[] = [...grouped].map(([name, g]) => {
  const cfg = cityCfg[name] ?? {}
  const lon = cfg.lon ?? g.lon / g.n
  const lat = cfg.lat ?? g.lat / g.n
  const [x, y] = projection([lon, lat])!
  return { name, x, y, label: cfg.label ?? 's', leader: !!cfg.leader, count: g.n }
})

const DIRS: Record<string, [number, number, string]> = {
  n: [0, -1, 'middle'], ne: [0.75, -0.75, 'start'], e: [1, 0, 'start'], se: [0.75, 0.75, 'start'],
  s: [0, 1, 'middle'], sw: [-0.75, 0.75, 'end'], w: [-1, 0, 'end'], nw: [-0.75, -0.75, 'end'],
}

const DOT = 9
const GAP = 14
const LEADER = 46
const FONT = 30

function ringToPath(ring: number[]): string {
  let d = `M${ring[0]} ${ring[1]}`
  for (let i = 2; i < ring.length; i += 2) d += `L${ring[i]} ${ring[i + 1]}`
  return `${d}Z`
}

const NATION_FILL: Record<string, string> = {
  england: '#FFFFFF', scotland: '#F7FAFC', wales: '#FBFCFE', 'northern-ireland': '#F4F8FC',
}

const vb = map.viewBox
let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.width} ${vb.height}" width="${Math.round(vb.width)}" height="${Math.round(vb.height)}" font-family="Verdana, DejaVu Sans, sans-serif">
<rect x="${vb.x}" y="${vb.y}" width="${vb.width}" height="${vb.height}" fill="#DCEAF6"/>`

for (const nation of map.nations) {
  svg += `\n<g id="${nation.id}" fill="${NATION_FILL[nation.id] ?? '#fff'}" stroke="#2A3F55" stroke-width="1.6" stroke-linejoin="round">`
  for (const ring of nation.rings) svg += `<path d="${ringToPath(ring)}"/>`
  svg += `</g>`
}

for (const c of cities) {
  const [dx, dy, anchor] = DIRS[c.label] ?? DIRS.s
  const dist = c.leader ? LEADER : DOT + GAP
  const lx = c.x + dx * dist
  const ly = c.y + dy * dist
  if (c.leader) {
    svg += `\n<line x1="${c.x + dx * DOT}" y1="${c.y + dy * DOT}" x2="${lx - dx * 4}" y2="${ly - dy * 4}" stroke="#2A3F55" stroke-width="1.4" opacity="0.55"/>`
  }
  const baseline = dy > 0.5 ? FONT * 0.85 : dy < -0.5 ? -FONT * 0.25 : FONT * 0.34
  svg += `\n<circle cx="${c.x}" cy="${c.y}" r="${DOT}" fill="#0B4F8A" stroke="#fff" stroke-width="3"/>`
  if (c.count > 1) {
    svg += `<circle cx="${c.x}" cy="${c.y}" r="${DOT + 7}" fill="none" stroke="#0B4F8A" stroke-width="2" opacity="0.45"/>`
  }
  svg += `\n<text x="${lx}" y="${ly + baseline - FONT * 0.34}" font-size="${FONT}" font-weight="700" text-anchor="${anchor}" fill="#13293D" stroke="#DCEAF6" stroke-width="5" paint-order="stroke" >${c.name}${c.count > 1 ? ` (${c.count})` : ''}</text>`
}

svg += `\n</svg>\n`
writeFileSync(resolve(here, '../map-preview.svg'), svg)
console.log(`map-preview.svg written - ${Math.round(vb.width)}x${Math.round(vb.height)}, ${cities.length} cities`)

// Report the tightest label-to-label and dot-to-dot distances so crowding is
// a number, not a guess.
const pairs: { a: string; b: string; d: number }[] = []
for (let i = 0; i < cities.length; i += 1) {
  for (let j = i + 1; j < cities.length; j += 1) {
    pairs.push({ a: cities[i].name, b: cities[j].name, d: Math.hypot(cities[i].x - cities[j].x, cities[i].y - cities[j].y) })
  }
}
pairs.sort((p, q) => p.d - q.d)
console.log('closest city pairs (viewBox units):')
for (const p of pairs.slice(0, 6)) console.log(`  ${p.a} <-> ${p.b}: ${p.d.toFixed(0)}`)
