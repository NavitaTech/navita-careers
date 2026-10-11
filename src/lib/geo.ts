/**
 * Runtime map access: loads the generated map, rebuilds the exact projection
 * used at build time, and derives the city markers from universities.json.
 *
 * Because the projection is rebuilt here rather than baked in, adding a
 * university to the data file is enough - no rebuild of the map is needed.
 */
import { geoTransverseMercator } from 'd3-geo'
import mapData from '../data/uk-map.json'
import universitiesData from '../data/universities.json'
import cityData from '../data/cities.json'
import { buildCities, ringToPath } from './geo-core'
import type { City, Nation, UniversityRecord, CityConfig } from './geo-core'
import type { Universities } from './types'

export const viewBox = mapData.viewBox
export const nations: Nation[] = mapData.nations

const projection = geoTransverseMercator()
  .rotate(mapData.projection.rotate as [number, number])
  .scale(mapData.projection.scale)
  .translate(mapData.projection.translate as [number, number])

/** Longitude/latitude to viewBox units. */
export function project(lon: number, lat: number): [number, number] {
  const p = projection([lon, lat])
  if (!p) throw new Error(`Coordinate outside the UK projection: ${lon}, ${lat}`)
  return [p[0], p[1]]
}

/** The four nation outlines, pre-rendered as path strings. Static for the session. */
export const nationPaths: { id: string; name: string; d: string }[] = nations.map((nation) => ({
  id: nation.id,
  name: nation.name,
  d: nation.rings.map(ringToPath).join(' '),
}))

const records = universitiesData.universities as UniversityRecord[]
const cities = buildCities(records, cityData.cities as Record<string, CityConfig>, project, nations)

export const universities: Universities = {
  all: records,
  byId: new Map(records.map((u) => [u.id, u])),
  cities,
  cityById: new Map(cities.map((c) => [c.id, c])),
  cityByName: new Map(cities.map((c) => [c.name, c])),
}

/** The city that hosts a university. */
export function cityOf(universityId: string): City {
  const record = universities.byId.get(universityId)
  if (!record) throw new Error(`Unknown university: ${universityId}`)
  const city = universities.cityByName.get(record.city)
  if (!city) throw new Error(`University ${universityId} names a city with no marker: ${record.city}`)
  return city
}

/**
 * Cities crowded enough that a fingertip cannot separate them. These are the
 * clusters the magnifier opens over.
 */
export const CROWDED_THRESHOLD = 30
export const crowdedCities = cities.filter((c) => c.snap < CROWDED_THRESHOLD)

/**
 * Converts a viewport point into viewBox units. The SVG is laid out with
 * preserveAspectRatio="xMidYMid meet", so one shared scale applies and the
 * unused axis is letterboxed evenly.
 */
export function clientToViewBox(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { x: number; y: number } {
  const scale = Math.min(rect.width / viewBox.width, rect.height / viewBox.height)
  const drawnWidth = viewBox.width * scale
  const drawnHeight = viewBox.height * scale
  const offsetX = rect.left + (rect.width - drawnWidth) / 2
  const offsetY = rect.top + (rect.height - drawnHeight) / 2
  return {
    x: viewBox.x + (clientX - offsetX) / scale,
    y: viewBox.y + (clientY - offsetY) / scale,
  }
}

/** How many screen pixels one viewBox unit currently occupies. */
export function scaleFor(rect: DOMRect): number {
  return Math.min(rect.width / viewBox.width, rect.height / viewBox.height)
}
