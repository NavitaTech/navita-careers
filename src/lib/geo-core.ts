/**
 * Geometry shared by the build scripts and the running game.
 *
 * Everything here works in the projected viewBox space of src/data/uk-map.json,
 * never in longitude/latitude, so distances are directly comparable to the
 * numbers used for snap targets and drop detection.
 */

export type Nation = { id: string; name: string; rings: number[][] }

export type UniversityRecord = {
  id: string
  name: string
  short: string
  city: string
  lon: number
  lat: number
  tier: 1 | 2 | 3
  strengths: string[]
  fact: string
}

export type LabelSide = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

export type CityConfig = {
  lon?: number
  lat?: number
  label?: LabelSide
  leader?: boolean
}

export type City = {
  /** Slug form of the name, safe for DOM ids. */
  id: string
  name: string
  /** Projected position in viewBox units. */
  x: number
  y: number
  lon: number
  lat: number
  label: LabelSide
  leader: boolean
  /** England / Scotland / Wales / Northern Ireland, resolved from the coastline. */
  nation: string
  /** University ids hosted here, in the order they appear in the data file. */
  universities: string[]
  /** Exact-hit radius in viewBox units, sized so neighbouring targets never meet. */
  snap: number
}

/** A flat [x,y,x,y,...] ring as an SVG path. */
export function ringToPath(ring: number[]): string {
  if (ring.length < 4) return ''
  let d = `M${ring[0]} ${ring[1]}`
  for (let i = 2; i < ring.length; i += 2) d += `L${ring[i]} ${ring[i + 1]}`
  return `${d}Z`
}

/** Ray-casting point-in-polygon against a flat ring. */
function pointInRing(x: number, y: number, ring: number[]): boolean {
  let inside = false
  const n = ring.length / 2
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const xi = ring[i * 2]
    const yi = ring[i * 2 + 1]
    const xj = ring[j * 2]
    const yj = ring[j * 2 + 1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Shortest distance from a point to a ring's edge. */
function distanceToRing(x: number, y: number, ring: number[]): number {
  let best = Infinity
  const n = ring.length / 2
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const ax = ring[j * 2]
    const ay = ring[j * 2 + 1]
    const bx = ring[i * 2]
    const by = ring[i * 2 + 1]
    const dx = bx - ax
    const dy = by - ay
    const len = dx * dx + dy * dy
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len))
    const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy))
    if (d < best) best = d
  }
  return best
}

/**
 * Which nation a projected point sits in. Falls back to the nearest coastline
 * when a point lands just outside the simplified outline, which happens for
 * harbour cities like Southampton and Belfast.
 */
export function nationAt(x: number, y: number, nations: Nation[]): string {
  for (const nation of nations) {
    for (const ring of nation.rings) {
      if (pointInRing(x, y, ring)) return nation.name
    }
  }
  let best = ''
  let bestDist = Infinity
  for (const nation of nations) {
    for (const ring of nation.rings) {
      const d = distanceToRing(x, y, ring)
      if (d < bestDist) {
        bestDist = d
        best = nation.name
      }
    }
  }
  return best
}

/** Smallest exact-hit radius we will ever hand a player, in viewBox units. */
const SNAP_MIN = 19
/** Largest, so an isolated city like Aberdeen does not get an absurd target. */
const SNAP_MAX = 58
/**
 * Fraction of the gap to the nearest neighbour. Below 0.5 so two adjacent
 * targets always keep a visible gap between them.
 */
const SNAP_SHARE = 0.46

/** Exact-hit radius for a city, given how close its nearest neighbour is. */
export function snapRadiusFor(nearestNeighbourDistance: number): number {
  return Math.max(SNAP_MIN, Math.min(SNAP_MAX, nearestNeighbourDistance * SNAP_SHARE))
}

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/**
 * Derives the city markers from the university list. A city appears for every
 * distinct `city` value; its position is the mean of its universities unless
 * src/data/cities.json pins it, which is what London needs so the marker sits
 * on the city centre rather than between four campuses.
 */
export function buildCities(
  universities: UniversityRecord[],
  config: Record<string, CityConfig>,
  project: (lon: number, lat: number) => [number, number],
  nations: Nation[],
): City[] {
  const grouped = new Map<string, { lon: number; lat: number; ids: string[] }>()
  for (const u of universities) {
    const g = grouped.get(u.city) ?? { lon: 0, lat: 0, ids: [] }
    g.lon += u.lon
    g.lat += u.lat
    g.ids.push(u.id)
    grouped.set(u.city, g)
  }

  const cities: City[] = [...grouped].map(([name, g]) => {
    const cfg = config[name] ?? {}
    const lon = cfg.lon ?? g.lon / g.ids.length
    const lat = cfg.lat ?? g.lat / g.ids.length
    const [x, y] = project(lon, lat)
    return {
      id: slug(name),
      name,
      x,
      y,
      lon,
      lat,
      label: cfg.label ?? 's',
      leader: cfg.leader ?? false,
      nation: nationAt(x, y, nations),
      universities: g.ids,
      snap: SNAP_MAX,
    }
  })

  for (const city of cities) {
    let nearest = Infinity
    for (const other of cities) {
      if (other === city) continue
      const d = Math.hypot(city.x - other.x, city.y - other.y)
      if (d < nearest) nearest = d
    }
    city.snap = snapRadiusFor(nearest)
  }

  return cities
}

/** Beyond this distance from every marker, a drop counts as "in the sea". */
export const NO_TARGET_RADIUS = 115

/**
 * The nearest marker to a drop point, or null when the drop was nowhere near
 * the map. Nearest-marker beats strict radius testing: a player aiming between
 * Cardiff and Bristol always gets a verdict instead of a silent bounce-back.
 */
export function nearestCity(
  x: number,
  y: number,
  cities: City[],
): { city: City; distance: number } | null {
  let best: City | null = null
  let bestDist = Infinity
  for (const city of cities) {
    const d = Math.hypot(city.x - x, city.y - y)
    if (d < bestDist) {
      bestDist = d
      best = city
    }
  }
  if (!best || bestDist > NO_TARGET_RADIUS) return null
  return { city: best, distance: bestDist }
}
