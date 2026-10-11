/**
 * The map.
 *
 * Drawn in explicit layers rather than city by city. Painting each marker as a
 * self-contained group meant a later city's drop target covered an earlier
 * city's name - and the brief is specific that a label is never covered. So the
 * order is fixed here: targets, then leader lines, then logo pins, then dots,
 * and names last on top of all of it.
 *
 * The magnifying lens re-uses the same nodes through <use>, so the magnified
 * copy always reflects live marker state and the 3,590-point coastline is only
 * rasterised once per frame.
 */
import { memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { City, DropVerdict, UniversityRecord } from '../lib/types'
import { nationPaths, viewBox, universities } from '../lib/geo'
import { cachedLogo, initialsFor } from '../lib/logos'
// Shared with the test suite, so a label the tests prove is clear is the same
// label this component draws.
import { DIRECTIONS, DOT_RADIUS, LABEL_SIZE, LEADER_DISTANCE, labelPosition } from '../lib/labels'

export type PinState = {
  universityId: string
  cityId: string
  verdict: Extract<DropVerdict, 'correct' | 'near'>
}

type Props = {
  cities: City[]
  /** Cities still holding a card in this round; others are drawn at rest. */
  activeCityIds: Set<string>
  pins: PinState[]
  /** Marker the finger is currently over. */
  hoveredCityId: string | null
  /** Marker the hint system is pointing at. */
  hintCityId: string | null
  /** Marker that just resolved, with how it resolved. */
  flash: { cityId: string; verdict: DropVerdict } | null
  /** Pointer position in viewBox units while a card is in the air. */
  lensFocus: { x: number; y: number } | null
  lensEnabled: boolean
  reducedMotion: boolean
}

const LENS_RADIUS = 118
const LENS_ZOOM = 2.3
/** Lens opens only this close to a cluster tight enough to need it. */
const LENS_TRIGGER_DISTANCE = 150
const CROWDED_SNAP = 30

const directionOf = (city: City) => DIRECTIONS[city.label] ?? DIRECTIONS.s

/**
 * Logo pins fan out on the side away from the city's name, so four pins at
 * London never drift across "London".
 */
function pinOffset(city: City, count: number, index: number): { x: number; y: number } {
  const direction = directionOf(city)
  const base = Math.atan2(-direction.dy, -direction.dx)
  if (count === 1) return { x: Math.cos(base) * 30, y: Math.sin(base) * 30 }
  const spreadDegrees = Math.min(30, 86 / count)
  const offset = index - (count - 1) / 2
  const angle = base + (offset * spreadDegrees * Math.PI) / 180
  const radius = count > 3 ? 44 : 34
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
}

/** Static coastline. Never re-renders; the lens points at it by id. */
const Coastline = memo(function Coastline() {
  return (
    <g id="uk-coastline">
      {nationPaths.map((nation) => (
        <path
          key={nation.id}
          d={nation.d}
          fill={`var(--land-${nation.id})`}
          stroke="rgb(var(--c-navy-800))"
          strokeWidth={1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  )
})

function LogoPin({
  record,
  x,
  y,
  verdict,
}: {
  record: UniversityRecord
  x: number
  y: number
  verdict: string
}) {
  const logo = cachedLogo(record.id)
  const w = 44
  const h = 30
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      transform={`translate(${x} ${y})`}
    >
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={6}
        fill="#fff"
        stroke={verdict === 'near' ? 'rgb(var(--c-near))' : 'rgb(var(--c-good))'}
        strokeWidth={2}
      />
      {logo ? (
        <image
          href={logo}
          x={-w / 2 + 3}
          y={-h / 2 + 3}
          width={w - 6}
          height={h - 6}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={13}
          fontWeight={800}
          fill="rgb(var(--c-navy-800))"
          fontFamily="Archivo, sans-serif"
        >
          {initialsFor(record)}
        </text>
      )}
    </motion.g>
  )
}

export function UKMap({
  cities,
  activeCityIds,
  pins,
  hoveredCityId,
  hintCityId,
  flash,
  lensFocus,
  lensEnabled,
  reducedMotion,
}: Props) {
  const pinsByCity = useMemo(() => {
    const map = new Map<string, PinState[]>()
    for (const pin of pins) {
      const list = map.get(pin.cityId) ?? []
      list.push(pin)
      map.set(pin.cityId, list)
    }
    return map
  }, [pins])

  /**
   * The lens only opens where it earns its place: near a marker whose target
   * had to be shrunk because a neighbour is too close. Everywhere else it
   * would just be in the way.
   */
  const lens = useMemo(() => {
    if (!lensEnabled || !lensFocus || reducedMotion) return null
    let nearest = Infinity
    for (const city of cities) {
      if (city.snap >= CROWDED_SNAP) continue
      nearest = Math.min(nearest, Math.hypot(city.x - lensFocus.x, city.y - lensFocus.y))
    }
    return nearest < LENS_TRIGGER_DISTANCE ? lensFocus : null
  }, [cities, lensEnabled, lensFocus, reducedMotion])

  // Keep the lens inside the frame so it never hangs off the edge of the map.
  const lensCentre = lens
    ? {
        x: Math.min(Math.max(lens.x, viewBox.x + LENS_RADIUS), viewBox.x + viewBox.width - LENS_RADIUS),
        y: Math.min(Math.max(lens.y, viewBox.y + LENS_RADIUS), viewBox.y + viewBox.height - LENS_RADIUS),
      }
    : null

  return (
    <svg
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      role="img"
      aria-label="Map of the United Kingdom with university cities marked"
    >
      <defs>
        <pattern id="sea-texture" width="13" height="13" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.1" fill="rgb(var(--c-sea-deep))" />
        </pattern>
        {lensCentre && (
          <clipPath id="lens-clip">
            <circle cx={lensCentre.x} cy={lensCentre.y} r={LENS_RADIUS} />
          </clipPath>
        )}
      </defs>

      {/* The sea is a plate, not a full bleed: the SVG is letterboxed inside a
          dark panel, so a rounded edge reads as deliberate from across a hall. */}
      <rect
        x={viewBox.x}
        y={viewBox.y}
        width={viewBox.width}
        height={viewBox.height}
        rx={22}
        fill="rgb(var(--c-sea))"
      />
      <rect
        x={viewBox.x}
        y={viewBox.y}
        width={viewBox.width}
        height={viewBox.height}
        rx={22}
        fill="url(#sea-texture)"
        opacity={0.75}
      />

      <Coastline />

      <g id="uk-markers">
        {/* Layer 1: drop targets, hint halos and resolution flashes. */}
        <g>
          {cities.map((city) => {
            const hovered = hoveredCityId === city.id
            const active = activeCityIds.has(city.id)
            const hinted = hintCityId === city.id
            const flashing = flash?.cityId === city.id ? flash.verdict : null
            const flashColor =
              flashing === 'correct'
                ? 'rgb(var(--c-good))'
                : flashing === 'near'
                  ? 'rgb(var(--c-near))'
                  : 'rgb(var(--c-bad))'
            return (
              <g key={city.id} style={{ transformOrigin: `${city.x}px ${city.y}px` }}>
                <motion.circle
                  cx={city.x}
                  cy={city.y}
                  r={city.snap}
                  fill="rgb(var(--c-accent))"
                  stroke="rgb(var(--c-accent))"
                  strokeWidth={1.5}
                  strokeDasharray="6 5"
                  // An explicit resting state: without it the targets paint at
                  // full opacity for one frame before motion takes over.
                  initial={false}
                  style={{ opacity: 0, transformOrigin: `${city.x}px ${city.y}px` }}
                  animate={{ opacity: hovered ? 0.2 : active ? 0.07 : 0, scale: hovered ? 1.12 : 1 }}
                  transition={{ duration: reducedMotion ? 0 : 0.18 }}
                />
                {hinted && !reducedMotion && (
                  <motion.circle
                    cx={city.x}
                    cy={city.y}
                    r={DOT_RADIUS}
                    fill="none"
                    stroke="rgb(var(--c-accent))"
                    strokeWidth={3}
                    initial={{ scale: 1, opacity: 0.85 }}
                    animate={{ scale: 4.2, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                    style={{ transformOrigin: `${city.x}px ${city.y}px` }}
                  />
                )}
                {flashing && (
                  <motion.circle
                    cx={city.x}
                    cy={city.y}
                    r={DOT_RADIUS}
                    fill="none"
                    stroke={flashColor}
                    strokeWidth={4}
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: 5, opacity: 0 }}
                    transition={{ duration: reducedMotion ? 0.01 : 0.55, ease: 'easeOut' }}
                    style={{ transformOrigin: `${city.x}px ${city.y}px` }}
                  />
                )}
              </g>
            )
          })}
        </g>

        {/* Layer 2: leader lines, for labels that had to sit further out. */}
        <g stroke="rgb(var(--c-navy-800))" strokeWidth={1.3} opacity={0.45}>
          {cities
            .filter((city) => city.leader)
            .map((city) => {
              const direction = directionOf(city)
              return (
                <line
                  key={city.id}
                  x1={city.x + direction.dx * DOT_RADIUS}
                  y1={city.y + direction.dy * DOT_RADIUS}
                  x2={city.x + direction.dx * (LEADER_DISTANCE - 5)}
                  y2={city.y + direction.dy * (LEADER_DISTANCE - 5)}
                />
              )
            })}
        </g>

        {/* Layer 3: logo pins for everything already placed. */}
        <g>
          {cities.map((city) => {
            const cityPins = pinsByCity.get(city.id) ?? []
            return cityPins.map((pin, index) => {
              const record = universities.byId.get(pin.universityId)
              if (!record) return null
              const offset = pinOffset(city, cityPins.length, index)
              return (
                <LogoPin
                  key={pin.universityId}
                  record={record}
                  x={city.x + offset.x}
                  y={city.y + offset.y}
                  verdict={pin.verdict}
                />
              )
            })
          })}
        </g>

        {/* Layer 4: the dots themselves. */}
        <g>
          {cities.map((city) => {
            const hovered = hoveredCityId === city.id
            const settled = (pinsByCity.get(city.id) ?? []).length > 0
            const fill = settled
              ? 'rgb(var(--c-good))'
              : hovered || hintCityId === city.id
                ? 'rgb(var(--c-accent))'
                : activeCityIds.has(city.id)
                  ? 'rgb(var(--c-navy-700))'
                  : 'rgb(var(--c-navy-600))'
            return (
              <motion.circle
                key={city.id}
                cx={city.x}
                cy={city.y}
                r={DOT_RADIUS}
                fill={fill}
                stroke="#fff"
                strokeWidth={2.6}
                initial={false}
                animate={{ scale: hovered ? 1.45 : 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                style={{ transformOrigin: `${city.x}px ${city.y}px` }}
              />
            )
          })}
        </g>

        {/* Layer 5: the names, above everything, as the brief requires. */}
        <g>
          {cities.map((city) => {
            const { x, y, anchor } = labelPosition(city)
            return (
              <text
                key={city.id}
                x={x}
                y={y}
                className="map-label"
                fontSize={LABEL_SIZE}
                textAnchor={anchor}
                dominantBaseline="middle"
              >
                {city.name}
              </text>
            )
          })}
        </g>
      </g>

      {lensCentre && (
        <g>
          <g clipPath="url(#lens-clip)">
            <circle cx={lensCentre.x} cy={lensCentre.y} r={LENS_RADIUS} fill="rgb(var(--c-sea))" />
            <g
              transform={[
                `translate(${lensCentre.x} ${lensCentre.y})`,
                `scale(${LENS_ZOOM})`,
                `translate(${-lens!.x} ${-lens!.y})`,
              ].join(' ')}
            >
              <use href="#uk-coastline" />
              <use href="#uk-markers" />
            </g>
          </g>
          <circle
            cx={lensCentre.x}
            cy={lensCentre.y}
            r={LENS_RADIUS}
            fill="none"
            stroke="#fff"
            strokeWidth={5}
            opacity={0.95}
          />
          <circle
            cx={lensCentre.x}
            cy={lensCentre.y}
            r={LENS_RADIUS}
            fill="none"
            stroke="rgb(var(--c-navy-800))"
            strokeWidth={1.5}
            opacity={0.4}
          />
        </g>
      )}
    </svg>
  )
}
