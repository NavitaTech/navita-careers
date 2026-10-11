/**
 * The idle loop that has to stop someone walking past.
 *
 * Logos drop onto cities on a slow repeat, the board shows today's top five,
 * and the whole surface is the play button - a student should not have to find
 * a target to start.
 */
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { UKMap } from '../components/UKMap'
import { Leaderboard, SchoolBoard, aggregateSchools } from '../components/Leaderboard'
import { BrandMark } from '../components/BrandMark'
import { useApp, useT } from '../lib/app-state'
import { useLongPress, useReducedMotion } from '../lib/hooks'
import { universities, cityOf } from '../lib/geo'
import { allScores, startOfToday } from '../lib/storage'
import type { ScoreEntry } from '../lib/types'
import { unlockAudio } from '../lib/sound'
import { buildRound, orderDeck } from '../lib/round'

export function AttractScreen() {
  const { state, go, startRound } = useApp()
  const t = useT()
  const reducedMotion = useReducedMotion()
  const [scores, setScores] = useState<ScoreEntry[]>([])
  const [demoIndex, setDemoIndex] = useState(0)
  const [showSchools, setShowSchools] = useState(false)

  const admin = useLongPress(() => go('admin'), 3000)

  useEffect(() => {
    void allScores().then(setScores)
  }, [state.dataVersion])

  const today = useMemo(() => {
    const since = startOfToday()
    return scores.filter((s) => s.timestamp >= since)
  }, [scores])

  const schools = useMemo(() => aggregateSchools(today), [today])

  // Slow logo drop loop. Paused entirely when the viewer asked for reduced
  // motion, and kept to one card at a time so the screen never looks busy.
  const demoDeck = useMemo(() => universities.all.filter((u) => u.tier === 1), [])
  useEffect(() => {
    if (reducedMotion) return
    const timer = window.setInterval(() => setDemoIndex((i) => (i + 1) % demoDeck.length), 2600)
    return () => window.clearInterval(timer)
  }, [demoDeck.length, reducedMotion])

  // Alternate the two boards so both get seen from across the hall.
  useEffect(() => {
    if (schools.length === 0) return
    const timer = window.setInterval(() => setShowSchools((s) => !s), 7000)
    return () => window.clearInterval(timer)
  }, [schools.length])

  const demoCard = demoDeck[demoIndex]
  const demoCity = demoCard ? cityOf(demoCard.id) : null

  const begin = () => {
    unlockAudio()
    const pool = universities.all.filter((u) => state.settings.activeUniversityIds.includes(u.id))
    const deck = orderDeck(buildRound(pool, state.settings.universitiesPerRound))
    startRound(deck)
    go('howto')
  }

  return (
    <button
      type="button"
      onClick={begin}
      className="relative flex h-full w-full cursor-pointer items-stretch overflow-hidden bg-navy-900 text-start"
      aria-label={t('attract.cta')}
    >
      {/* Company mark, and the hidden way into admin. */}
      <div
        className="absolute left-6 top-5 z-20 flex items-center gap-3"
        {...admin.handlers}
        onClick={(event) => event.stopPropagation()}
      >
        <BrandMark brand={state.brand} height={84} />
        {admin.progress > 0 && (
          <span className="h-1 w-14 overflow-hidden rounded-full bg-white/20">
            <span className="block h-full bg-gold" style={{ width: `${admin.progress * 100}%` }} />
          </span>
        )}
      </div>

      <div className="relative flex min-w-0 flex-[1.15] items-center justify-center p-4">
        <UKMap
          cities={universities.cities}
          activeCityIds={new Set(universities.cities.map((c) => c.id))}
          pins={demoCard && demoCity ? [{ universityId: demoCard.id, cityId: demoCity.id, verdict: 'correct' }] : []}
          hoveredCityId={demoCity?.id ?? null}
          hintCityId={null}
          flash={null}
          lensFocus={null}
          lensEnabled={false}
          reducedMotion={reducedMotion}
        />
      </div>

      <div className="flex w-[34%] min-w-[20rem] max-w-[30rem] flex-col justify-center gap-7 bg-navy-800 p-8">
        <div>
          <h1 className="font-display text-[3.1rem] font-extrabold leading-[1.02] tracking-tight text-white [text-wrap:balance]">
            {t('attract.title')}
          </h1>
          <p className="mt-3 text-[1.15rem] leading-snug text-white/60">{t('attract.sub')}</p>
        </div>

        <motion.span
          className="btn btn-lg btn-gold w-full"
          animate={reducedMotion ? undefined : { scale: [1, 1.03, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          {t('attract.cta')}
        </motion.span>

        <div className="min-h-0 flex-1">
          <h2 className="mb-2 font-label text-[0.85rem] font-semibold uppercase tracking-[0.16em] text-white/45">
            {showSchools && schools.length ? t('attract.schools') : t('attract.today')}
          </h2>
          <AnimatePresence mode="wait">
            <motion.div
              key={showSchools && schools.length ? 'schools' : 'players'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: reducedMotion ? 0.01 : 0.3 }}
            >
              {showSchools && schools.length ? (
                <SchoolBoard rows={schools} limit={5} />
              ) : today.length ? (
                <Leaderboard scores={today} limit={5} compact />
              ) : (
                <p className="py-5 text-white/40">{t('attract.noScores')}</p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </button>
  )
}
