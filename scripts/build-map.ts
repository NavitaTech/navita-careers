/**
 * Builds src/data/uk-map.json from Natural Earth admin-0 map_subunits data.
 *
 * Why this exists: the booth runs fully offline, so we project real geographic
 * data once at build time and ship plain numbers. No tiles, no runtime map API.
 *
 * Output contract (consumed by src/lib/geo.ts):
 *   viewBox    - the SVG viewBox the rings are expressed in
 *   projection - parameters so the runtime can project any lon/lat the same way
 *   nations    - England / Scotland / Wales / Northern Ireland as projected rings
 *
 * Rings are stored as flat number arrays rather than path strings so the runtime
 * can both draw them and run point-in-polygon tests (used for partial credit:
 * "right country, wrong city").
 *
 * Run: npm run map
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoTransverseMercator } from 'd3-geo'

const here = dirname(fileURLToPath(import.meta.url))
const SOURCE = resolve(here, 'gbr-source.geojson')
const OUT = resolve(here, '../src/data/uk-map.json')

/** Target canvas the projection is fitted into, before the viewBox is tightened. */
const FIT_WIDTH = 1000
const FIT_HEIGHT = 1560
/** Padding left around the coastline, in viewBox units. */
const PADDING = 12
/**
 * The UK silhouette is tall (roughly 0.62:1). A 16:9 booth screen gives the map
 * panel a landscape box, so we widen the viewBox with sea on both sides until it
 * matches the panel. That sea is not filler: coastal city labels extend into it
 * and the HUD sits over the Atlantic, so the landmass itself can stay as large
 * as the panel height allows.
 */
const TARGET_ASPECT = 1.15
/**
 * Douglas-Peucker tolerance in viewBox units. The map renders ~1000 units wide
 * across ~1150 screen px at 1080p, so 0.4 units is well under half a pixel.
 */
const SIMPLIFY_TOLERANCE = 0.4
/** Rings smaller than this (projected units squared) are dropped as specks. */
const MIN_RING_AREA = 6
/**
 * Shetland sits ~300km north of the mainland and would force the whole map to
 * shrink. The brief asks for it to be left out.
 */
const SHETLAND_MIN_LAT = 59.6

const NATION_ORDER = ['England', 'Scotland', 'Wales', 'Northern Ireland'] as const

type Ring = [number, number][]
type Geo = {
  type: 'FeatureCollection'
  features: { properties: { subunit: string }; geometry: GeoJSON.MultiPolygon | GeoJSON.Polygon }[]
}

const source: Geo = JSON.parse(readFileSync(SOURCE, 'utf8'))

/** Pulls every polygon out of a feature, tagged with its subunit name. */
function polygonsOf(geometry: GeoJSON.MultiPolygon | GeoJSON.Polygon): GeoJSON.Position[][][] {
  return geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates]
}

/** True when a polygon's outer ring lies entirely in Shetland latitudes. */
function isShetland(polygon: GeoJSON.Position[][]): boolean {
  return polygon[0].every(([, lat]) => lat >= SHETLAND_MIN_LAT)
}

// --- 1. Filter the source down to what we actually draw -------------------

const kept: { subunit: string; polygons: GeoJSON.Position[][][] }[] = []
let shetlandDropped = 0

for (const name of NATION_ORDER) {
  const feature = source.features.find((f) => f.properties.subunit === name)
  if (!feature) throw new Error(`Natural Earth source is missing subunit "${name}"`)
  const polygons = polygonsOf(feature.geometry).filter((p) => {
    if (isShetland(p)) {
      shetlandDropped += 1
      return false
    }
    return true
  })
  kept.push({ subunit: name, polygons })
}

// --- 2. Build the projection and fit it to the cropped coastline ----------

const cropped: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: kept.map((k) => ({
    type: 'Feature',
    properties: { subunit: k.subunit },
    geometry: { type: 'MultiPolygon', coordinates: k.polygons },
  })),
}

/**
 * Transverse Mercator rotated to a 2 degrees West central meridian - the same
 * basis as the Ordnance Survey British National Grid, so the UK keeps its
 * familiar proportions instead of the north-stretching of plain Mercator.
 */
const projection = geoTransverseMercator()
  .rotate([2, 0])
  .fitExtent(
    [
      [PADDING, PADDING],
      [FIT_WIDTH - PADDING, FIT_HEIGHT - PADDING],
    ],
    cropped,
  )

const project = (lon: number, lat: number): [number, number] => {
  const p = projection([lon, lat])
  if (!p) throw new Error(`Point outside projection: ${lon},${lat}`)
  return [p[0], p[1]]
}

// --- 3. Project, simplify, and drop specks --------------------------------

/** Perpendicular distance from p to the segment a-b. */
function segmentDistance(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/** Classic Douglas-Peucker, iterative so long coastlines cannot blow the stack. */
function simplify(ring: Ring, tolerance: number): Ring {
  if (ring.length < 4) return ring
  const keep = new Uint8Array(ring.length)
  keep[0] = 1
  keep[ring.length - 1] = 1
  const stack: [number, number][] = [[0, ring.length - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()!
    let maxDist = 0
    let index = -1
    for (let i = first + 1; i < last; i += 1) {
      const d = segmentDistance(ring[i], ring[first], ring[last])
      if (d > maxDist) {
        maxDist = d
        index = i
      }
    }
    if (maxDist > tolerance && index > 0) {
      keep[index] = 1
      stack.push([first, index], [index, last])
    }
  }
  return ring.filter((_, i) => keep[i] === 1)
}

/** Shoelace area, unsigned. */
function ringArea(ring: Ring): number {
  let sum = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  }
  return Math.abs(sum / 2)
}

const round = (n: number): number => Math.round(n * 10) / 10

type NationOut = { id: string; name: string; rings: number[][] }

const nations: NationOut[] = []
let specksDropped = 0
let pointsBefore = 0
let pointsAfter = 0

for (const { subunit, polygons } of kept) {
  const rings: number[][] = []
  for (const polygon of polygons) {
    // Outer ring only. The UK has no holes worth drawing at this scale, and
    // keeping rings flat simplifies the point-in-polygon test downstream.
    const projected: Ring = polygon[0].map(([lon, lat]) => project(lon, lat))
    pointsBefore += projected.length
    if (ringArea(projected) < MIN_RING_AREA) {
      specksDropped += 1
      continue
    }
    const thinned = simplify(projected, SIMPLIFY_TOLERANCE)
    pointsAfter += thinned.length
    rings.push(thinned.flatMap(([x, y]) => [round(x), round(y)]))
  }
  // Largest landmass first so the mainland paints under its islands.
  rings.sort((a, b) => b.length - a.length)
  nations.push({ id: subunit.toLowerCase().replace(/\s+/g, '-'), name: subunit, rings })
}

// --- 4. Tighten the viewBox to the actual ink -----------------------------

let minX = Infinity
let minY = Infinity
let maxX = -Infinity
let maxY = -Infinity
for (const nation of nations) {
  for (const ring of nation.rings) {
    for (let i = 0; i < ring.length; i += 2) {
      if (ring[i] < minX) minX = ring[i]
      if (ring[i] > maxX) maxX = ring[i]
      if (ring[i + 1] < minY) minY = ring[i + 1]
      if (ring[i + 1] > maxY) maxY = ring[i + 1]
    }
  }
}

const inkWidth = maxX - minX + PADDING * 2
const inkHeight = maxY - minY + PADDING * 2
// Widen symmetrically to TARGET_ASPECT. Never narrow: the coastline must fit.
const gutter = Math.max(0, (inkHeight * TARGET_ASPECT - inkWidth) / 2)

const viewBox = {
  x: round(minX - PADDING - gutter),
  y: round(minY - PADDING),
  width: round(inkWidth + gutter * 2),
  height: round(inkHeight),
}

// --- 5. Emit --------------------------------------------------------------

const translate = projection.translate()
const output = {
  $comment:
    'Generated by scripts/build-map.ts from Natural Earth 10m admin-0 map_subunits. Do not edit by hand - run `npm run map`.',
  source: 'Natural Earth 1:10m Admin 0 map subunits (public domain)',
  generatedAt: new Date().toISOString().slice(0, 10),
  viewBox,
  projection: {
    type: 'transverseMercator' as const,
    rotate: projection.rotate(),
    scale: projection.scale(),
    translate: [translate[0], translate[1]],
  },
  nations,
}

writeFileSync(OUT, JSON.stringify(output))

const sizeKb = (JSON.stringify(output).length / 1024).toFixed(0)
console.log(`UK map built -> src/data/uk-map.json (${sizeKb} KB)`)
console.log(`  nations     : ${nations.map((n) => `${n.name} (${n.rings.length})`).join(', ')}`)
console.log(`  coastline   : ${pointsBefore} -> ${pointsAfter} points (tolerance ${SIMPLIFY_TOLERANCE})`)
console.log(`  dropped     : ${shetlandDropped} Shetland polygons, ${specksDropped} specks`)
console.log(`  viewBox     : ${viewBox.width} x ${viewBox.height} (aspect ${(viewBox.width / viewBox.height).toFixed(2)})`)
console.log(`  sea gutter  : ${gutter.toFixed(0)} units each side`)
