/**
 * The round.
 *
 * Aim point is the fingertip, not the card's centre: dnd-kit gives the pointer
 * position where the drag started plus the running delta, and that sum is what
 * decides which city a drop lands on. Using the card's centre instead would
 * offset every drop by however far from the middle the student happened to grab.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { AnimatePresence, motion } from 'framer-motion'
import { UKMap, type PinState } from '../components/UKMap'
import { UniversityCard, DragGhost } from '../components/UniversityCard'
import { Hud } from '../components/Hud'
import { useApp, useT } from '../lib/app-state'
import { useCountdown, useElementRect, useReducedMotion } from '../lib/hooks'
import { clientToViewBox, universities, cityOf } from '../lib/geo'
import { nearestCity } from '../lib/geo-core'
import { assessDrop, applyPoints, summarise, type DropAssessment } from '../lib/scoring'
import type { DropVerdict, Placement, UniversityRecord } from '../lib/types'
import { play } from '../lib/sound'
import { publish } from '../lib/bus'

type Resolved = { universityId: string; verdict: DropVerdict }

export function GameScreen() {
  const { state, finishRound } = useApp()
  const t = useT()
  const reducedMotion = useReducedMotion()
  const { settings, deck } = state

  const [mapRef, mapRect] = useElementRect<HTMLDivElement>()
  const [placements, setPlacements] = useState<Placement[]>([])
  const [resolved, setResolved] = useState<Resolved[]>([])
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [flash, setFlash] = useState<{ cityId: string; verdict: DropVerdict } | null>(null)
  const [banner, setBanner] = useState<DropAssessment | null>(null)
  const [rejectedId, setRejectedId] = useState<string | null>(null)
  const [hintCityId, setHintCityId] = useState<string | null>(null)

  const dragOrigin = useRef<{ x: number; y: number } | null>(null)
  const lastTick = useRef(0)
  const ended = useRef(false)

  const settledIds = useMemo(
    () => new Set(resolved.filter((r) => r.verdict !== 'wrong' && r.verdict !== 'sea').map((r) => r.universityId)),
    [resolved],
  )
  const remaining = useMemo(() => deck.filter((u) => !settledIds.has(u.id)), [deck, settledIds])

  const end = useCallback(
    (elapsed: number) => {
      if (ended.current) return
      ended.current = true
      const result = summarise(placements, deck.length, settings.roundSeconds, elapsed)
      play('finish')
      publish({ type: 'round-end', score: result.score, playerName: '', fullClear: result.fullClear })
      finishRound(result)
    },
    [deck.length, finishRound, placements, settings.roundSeconds],
  )

  const { secondsLeft, elapsed } = useCountdown(settings.roundSeconds, deck.length > 0, () =>
    end(settings.roundSeconds),
  )

  // Finish the moment the last card settles, rather than making a player who
  // cleared the board wait out the clock.
  useEffect(() => {
    if (deck.length > 0 && remaining.length === 0 && !ended.current) {
      const timer = window.setTimeout(() => end(elapsed()), 650)
      return () => window.clearTimeout(timer)
    }
  }, [deck.length, remaining.length, elapsed, end])

  // Last-ten-seconds clock.
  useEffect(() => {
    if (secondsLeft <= 10 && secondsLeft > 0 && secondsLeft !== lastTick.current) {
      lastTick.current = secondsLeft
      play('tick')
    }
  }, [secondsLeft])

  useEffect(() => {
    publish({
      type: 'tick',
      score,
      secondsLeft,
      cardsLeft: remaining.length,
      streak,
    })
  }, [score, secondsLeft, remaining.length, streak])

  /**
   * Hint: if a card has been held for a while with no drop, the right city
   * starts pulsing. A student who does not know UK geography still finishes
   * their round, which is the whole reason they are standing here.
   */
  useEffect(() => {
    if (!activeId || !settings.hintsEnabled) {
      setHintCityId(null)
      return
    }
    const timer = window.setTimeout(() => {
      setHintCityId(cityOf(activeId).id)
    }, settings.hintDelaySeconds * 1000)
    return () => window.clearTimeout(timer)
  }, [activeId, settings.hintsEnabled, settings.hintDelaySeconds])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // A few pixels of travel before a drag starts, so a tap stays a tap.
      activationConstraint: { distance: 6 },
    }),
  )

  const pointerInMap = useCallback(
    (clientX: number, clientY: number) => {
      if (!mapRect) return null
      return clientToViewBox(clientX, clientY, mapRect)
    },
    [mapRect],
  )

  const hoveredCity = useMemo(() => {
    if (!pointer) return null
    return nearestCity(pointer.x, pointer.y, universities.cities)?.city ?? null
  }, [pointer])

  const onDragStart = (event: DragStartEvent) => {
    if (settledIds.has(String(event.active.id))) return
    const activator = event.activatorEvent as PointerEvent
    dragOrigin.current = { x: activator.clientX, y: activator.clientY }
    setActiveId(String(event.active.id))
    setBanner(null)
    play('pickup')
  }

  const onDragMove = (event: DragMoveEvent) => {
    if (!dragOrigin.current) return
    setPointer(
      pointerInMap(
        dragOrigin.current.x + event.delta.x,
        dragOrigin.current.y + event.delta.y,
      ),
    )
  }

  const onDragEnd = (event: DragEndEvent) => {
    const universityId = String(event.active.id)
    const origin = dragOrigin.current
    dragOrigin.current = null
    setActiveId(null)
    setPointer(null)
    setHintCityId(null)
    if (!origin) return
    // A card stays in the DOM while it animates out of the tray, and stays
    // draggable with it. Without this guard a quick player can grab the fading
    // card and score the same university two or three times.
    if (settledIds.has(universityId)) return

    const drop = pointerInMap(origin.x + event.delta.x, origin.y + event.delta.y)
    const record = universities.byId.get(universityId)
    if (!record || !drop) return

    const target = cityOf(universityId)
    const landed = nearestCity(drop.x, drop.y, universities.cities)?.city ?? null
    const assessment = assessDrop(target, landed, drop, settings.partialCredit)

    if (assessment.verdict === 'sea') {
      // Released away from the map. No penalty, no comment - the student
      // simply changed their mind.
      return
    }

    const at = elapsed()
    setPlacements((prev) => [
      ...prev,
      { universityId, cityId: landed?.id ?? '', verdict: assessment.verdict, points: assessment.points, at },
    ])
    setScore((prev) => applyPoints(prev, assessment.points))
    setResolved((prev) => [...prev, { universityId, verdict: assessment.verdict }])
    setBanner(assessment)
    setFlash({ cityId: landed?.id ?? '', verdict: assessment.verdict })
    window.setTimeout(() => setFlash(null), 700)

    if (assessment.verdict === 'correct') {
      setStreak((s) => s + 1)
      play('correct')
      publish({ type: 'placed', cityId: target.id, universityId, verdict: 'correct' })
    } else if (assessment.verdict === 'near') {
      setStreak(0)
      play('near')
      publish({ type: 'placed', cityId: target.id, universityId, verdict: 'near' })
    } else {
      setStreak(0)
      play('wrong')
      setRejectedId(universityId)
      window.setTimeout(() => setRejectedId((id) => (id === universityId ? null : id)), 450)
    }
  }

  // Pins land on the correct city even for a near miss, so the map ends the
  // round showing the student where each university actually is.
  const pins: PinState[] = useMemo(
    () =>
      resolved
        .filter((r): r is { universityId: string; verdict: 'correct' | 'near' } =>
          r.verdict === 'correct' || r.verdict === 'near',
        )
        .map((r) => ({
          universityId: r.universityId,
          cityId: cityOf(r.universityId).id,
          verdict: r.verdict,
        })),
    [resolved],
  )

  const activeCityIds = useMemo(
    () => new Set(remaining.map((u) => cityOf(u.id).id)),
    [remaining],
  )

  const activeRecord: UniversityRecord | null = activeId
    ? (universities.byId.get(activeId) ?? null)
    : null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        dragOrigin.current = null
        setActiveId(null)
        setPointer(null)
        setHintCityId(null)
      }}
    >
      <div className="flex h-full w-full bg-navy-900">
        {/* Map panel */}
        <div className="relative flex min-w-0 flex-1 items-stretch p-3">
          <div className="relative min-w-0 flex-1" ref={mapRef}>
              <UKMap
              cities={universities.cities}
              activeCityIds={activeCityIds}
              pins={pins}
              hoveredCityId={activeId ? (hoveredCity?.id ?? null) : null}
              hintCityId={hintCityId}
              flash={flash}
              lensFocus={activeId ? pointer : null}
              lensEnabled={settings.lensEnabled}
              reducedMotion={reducedMotion}
            />
          </div>

          <div className="absolute left-7 top-6 z-10">
            <Hud
              secondsLeft={secondsLeft}
              totalSeconds={settings.roundSeconds}
              score={score}
              cardsLeft={remaining.length}
              cardsTotal={deck.length}
              streak={streak}
            />
          </div>

          {/* Verdict banner: the sentence that turns a wrong drop into a fact. */}
          <AnimatePresence>
            {banner && banner.message && (
              <motion.div
                key={banner.message}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: reducedMotion ? 0.01 : 0.22 }}
                className="absolute inset-x-0 bottom-7 z-10 flex justify-center px-6"
                onAnimationComplete={() => {
                  window.setTimeout(() => setBanner((b) => (b === banner ? null : b)), 1700)
                }}
              >
                <div
                  className={[
                    'rounded-2xl px-6 py-3 font-display text-[1.35rem] font-bold tracking-tight text-white shadow-lift',
                    banner.verdict === 'correct'
                      ? 'bg-good'
                      : banner.verdict === 'near'
                        ? 'bg-near'
                        : 'bg-bad',
                  ].join(' ')}
                >
                  {banner.message}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tray */}
        <aside className="flex w-[30%] min-w-[17rem] max-w-[26rem] flex-col gap-3 bg-navy-800 p-4">
          <h2 className="font-label text-[0.85rem] font-semibold uppercase tracking-[0.16em] text-white/55">
            {t('game.tray')}
          </h2>
          <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 content-start gap-3 overflow-hidden">
            <AnimatePresence mode="popLayout">
              {remaining.map((record) => (
                <motion.div
                  key={record.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8, pointerEvents: 'none' }}
                  transition={{ duration: reducedMotion ? 0.01 : 0.2 }}
                  className="h-[6.4rem]"
                >
                  <UniversityCard
                    record={record}
                    showName={settings.showNamesOnCards}
                    dragging={activeId === record.id}
                    rejected={rejectedId === record.id}
                    reducedMotion={reducedMotion}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <button
            type="button"
            className="btn btn-ghost w-full text-[0.95rem]"
            onClick={() => end(elapsed())}
          >
            {t('game.quit')}
          </button>
        </aside>
      </div>

      <DragOverlay dropAnimation={null} zIndex={60}>
        {activeRecord ? (
          <div className="h-[6.4rem] w-[9.5rem]">
            <DragGhost record={activeRecord} showName={settings.showNamesOnCards} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
