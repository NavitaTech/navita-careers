/**
 * Label geometry.
 *
 * City names are placed by hand in src/data/cities.json, which is the only way
 * to get a map that reads well. Hand placement needs a check, though: the test
 * suite uses these boxes to prove no two names collide and no name sits on a
 * marker, so editing the data file cannot quietly ruin the map.
 */
import type { City, LabelSide } from './geo-core'

export const LABEL_SIZE = 25
export const DOT_RADIUS = 7.5
export const LABEL_GAP = 12
export const LEADER_DISTANCE = 50

/**
 * Barlow Semi Condensed at weight 700 averages about 0.47 em per character
 * across mixed-case city names. Measured from the shipped font rather than
 * assumed, and deliberately a little generous so the check errs towards
 * flagging a collision.
 */
const AVERAGE_CHAR_WIDTH = 0.5
/** The white halo painted behind every label. */
const HALO = 3.5

export type Box = { left: number; right: number; top: number; bottom: number }

export const DIRECTIONS: Record<LabelSide, { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }> = {
  n: { dx: 0, dy: -1, anchor: 'middle' },
  ne: { dx: 0.72, dy: -0.72, anchor: 'start' },
  e: { dx: 1, dy: 0, anchor: 'start' },
  se: { dx: 0.72, dy: 0.72, anchor: 'start' },
  s: { dx: 0, dy: 1, anchor: 'middle' },
  sw: { dx: -0.72, dy: 0.72, anchor: 'end' },
  w: { dx: -1, dy: 0, anchor: 'end' },
  nw: { dx: -0.72, dy: -0.72, anchor: 'end' },
}

export function labelPosition(city: City): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const direction = DIRECTIONS[city.label] ?? DIRECTIONS.s
  const distance = city.leader ? LEADER_DISTANCE : DOT_RADIUS + LABEL_GAP
  const baseline = direction.dy > 0.5 ? LABEL_SIZE * 0.52 : direction.dy < -0.5 ? -LABEL_SIZE * 0.6 : 0
  return {
    x: city.x + direction.dx * distance,
    y: city.y + direction.dy * distance + baseline,
    anchor: direction.anchor,
  }
}

/** The rectangle a city's name occupies, halo included. */
export function labelBox(city: City): Box {
  const { x, y, anchor } = labelPosition(city)
  const width = city.name.length * AVERAGE_CHAR_WIDTH * LABEL_SIZE
  const left = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2
  return {
    left: left - HALO,
    right: left + width + HALO,
    top: y - LABEL_SIZE * 0.56 - HALO,
    bottom: y + LABEL_SIZE * 0.44 + HALO,
  }
}

export function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

/** How far two boxes overlap, for reporting which pair is worst. */
export function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return w > 0 && h > 0 ? w * h : 0
}

export function boxCoversPoint(box: Box, x: number, y: number, radius: number): boolean {
  return (
    box.left < x + radius && x - radius < box.right && box.top < y + radius && y - radius < box.bottom
  )
}
