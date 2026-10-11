/**
 * The result screen, which is also where the lead is captured.
 *
 * The order matters more than anything else here. A student who has just seen
 * their score has a reason to type their number - they are claiming a place on
 * a board. The same form shown before the round is a toll gate, and most of the
 * queue walks away from it.
 */
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useApp, useT } from '../lib/app-state'
import { useReducedMotion } from '../lib/hooks'
import { universities } from '../lib/geo'
import { allScores, startOfToday } from '../lib/storage'
import { compareScores, BONUS_PER_SECOND } from '../lib/scoring'
import type { ScoreEntry } from '../lib/types'

function Stat({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`tabular font-display text-[2.6rem] font-extrabold leading-none ${tone}`}>
        {value}
      </span>
      <span className="mt-1 font-label text-[0.82rem] font-semibold uppercase tracking-[0.13em] text-white/45">
        {label}
      </span>
    </div>
  )
}

export function ResultScreen() {
  const { state, go, setInterested, endSession } = useApp()
  const t = useT()
  const reducedMotion = useReducedMotion()
  const { result, settings, lead } = state
  const [scores, setScores] = useState<ScoreEntry[]>([])
  const [picked, setPicked] = useState<string[]>(state.interestedCities)

  useEffect(() => {
    void allScores().then(setScores)
  }, [state.dataVersion])

  useEffect(() => {
    if (result?.fullClear && !reducedMotion) {
      void confetti({
        particleCount: 140,
        spread: 78,
        startVelocity: 42,
        origin: { y: 0.42 },
        colors: ['#f0b429', '#0e7bd1', '#ffffff', '#1a8a52'],
        disableForReducedMotion: true,
      })
    }
  }, [result?.fullClear, reducedMotion])

  const provisionalRank = useMemo(() => {
    if (!result) return null
    const today = scores.filter((s) => s.timestamp >= startOfToday())
    const better = today.filter(
      (s) => compareScores(s, { score: result.score, timestamp: result.playedAt }) < 0,
    ).length
    return better + 1
  }, [result, scores])

  // Cities the student actually placed come first - those are the ones they
  // just thought about, so they are the easiest to have an opinion on.
  // Declared before the early return below: every hook in this component has
  // to run on every render, or React tears the tree down.
  const cityChoices = useMemo(() => {
    const placed = new Set(result?.citiesPlaced ?? [])
    return [...universities.cities].sort((a, b) => {
      const weight = (c: typeof a) => (placed.has(c.id) ? 0 : 1)
      return weight(a) - weight(b) || a.name.localeCompare(b.name)
    })
  }, [result?.citiesPlaced])

  if (!result) return null

  const togglePick = (cityId: string) => {
    setPicked((current) => {
      if (current.includes(cityId)) return current.filter((id) => id !== cityId)
      if (current.length >= 3) return current
      return [...current, cityId]
    })
  }

  const continueToClaim = () => {
    setInterested(picked)
    go(settings.webMode ? 'share' : 'register')
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto bg-navy-900 p-8">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0.01 : 0.35 }}
        className="flex flex-col items-center"
      >
        {result.fullClear && (
          <span className="mb-2 rounded-full bg-good px-4 py-1 font-label text-[0.9rem] font-bold uppercase tracking-[0.14em] text-white">
            {t('result.cleared')}
          </span>
        )}
        <h1 className="font-display text-[1.6rem] font-bold tracking-tight text-white/60">
          {t('result.title')}
        </h1>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          className="tabular font-display text-[7rem] font-extrabold leading-none tracking-tighter text-gold"
        >
          {result.score}
        </motion.div>
      </motion.div>

      <div className="flex items-start gap-10">
        <Stat value={String(result.correct)} label={t('result.correct')} tone="text-good" />
        {result.near > 0 && <Stat value={String(result.near)} label={t('result.near')} tone="text-near" />}
        <Stat value={String(result.misses)} label={t('result.missed')} tone="text-white/70" />
        {result.fullClear && (
          <Stat
            value={`+${result.timeLeft * BONUS_PER_SECOND}`}
            label={t('result.timeBonus')}
            tone="text-gold"
          />
        )}
        <Stat
          value={lead ? `#${provisionalRank}` : '—'}
          label={lead ? t('result.rank') : t('result.unranked')}
          tone="text-white"
        />
      </div>

      {/* Intent capture: three taps that turn a score into a conversation. */}
      {!settings.webMode && (
        <div className="w-full max-w-[52rem]">
          <h2 className="text-center font-display text-[1.3rem] font-bold text-white">
            {t('result.pickCities')}
          </h2>
          <p className="mb-3 text-center text-[0.95rem] text-white/50">{t('result.pickCitiesSub')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {cityChoices.map((city) => {
              const on = picked.includes(city.id)
              const placedHere = result.citiesPlaced.includes(city.id)
              return (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => togglePick(city.id)}
                  aria-pressed={on}
                  className={[
                    'rounded-xl px-4 py-2.5 font-display font-bold transition-colors',
                    on
                      ? 'bg-gold text-navy-900'
                      : placedHere
                        ? 'bg-white/18 text-white hover:bg-white/28'
                        : 'bg-white/8 text-white/65 hover:bg-white/18',
                  ].join(' ')}
                >
                  {city.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <AnimatePresence>
          {!lead && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2"
            >
              <button type="button" className="btn btn-lg btn-gold" onClick={continueToClaim}>
                {settings.webMode ? t('share.title') : t('result.claim')}
              </button>
              <p className="max-w-[30rem] text-center text-[0.92rem] text-white/45">
                {t('result.claimSub')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-3">
          {lead && (
            <button type="button" className="btn btn-primary" onClick={() => go('share')}>
              {t('share.title')}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => go('leaderboard')}>
            {t('board.title')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={endSession}>
            {lead ? t('result.next') : t('result.skip')}
          </button>
        </div>
      </div>
    </div>
  )
}
