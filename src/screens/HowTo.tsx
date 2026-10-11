/**
 * Three seconds of demonstration, then out of the way.
 *
 * Auto-advances after six so a hesitant student is never stuck on an
 * instruction screen while a queue builds behind them.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp, useT } from '../lib/app-state'
import { useReducedMotion } from '../lib/hooks'
import { CardFace } from '../components/UniversityCard'
import { universities } from '../lib/geo'

const AUTO_SKIP_SECONDS = 6

export function HowToScreen() {
  const { go, state } = useApp()
  const t = useT()
  const reducedMotion = useReducedMotion()
  const [countdown, setCountdown] = useState(AUTO_SKIP_SECONDS)

  useEffect(() => {
    const timer = window.setInterval(() => setCountdown((n) => n - 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (countdown <= 0) go('game')
  }, [countdown, go])

  const demo = universities.byId.get('edinburgh') ?? universities.all[0]

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-9 bg-navy-900 p-10">
      <h1 className="font-display text-[2.6rem] font-extrabold tracking-tight text-white">
        {t('howto.title')}
      </h1>

      {/* The gesture itself, looped. Nothing to read. The card travels in
          percentages, not pixels: the layout is sized in rem, and a fixed
          pixel distance drifted onto the target label at smaller root sizes. */}
      <div className="relative h-[13rem] w-[30rem] max-w-full">
        <div className="absolute inset-y-0 end-0 flex w-[11rem] flex-col items-center justify-center gap-2">
          <motion.div
            className="h-5 w-5 rounded-full bg-accent ring-4 ring-accent/30"
            animate={reducedMotion ? undefined : { scale: [1, 1.5, 1] }}
            transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.55, 0.7] }}
          />
          <span className="font-label text-[1rem] font-semibold uppercase tracking-[0.14em] text-white/55">
            Edinburgh
          </span>
        </div>

        <motion.div
          className="absolute start-0 top-6 h-[6.4rem] w-[9.5rem] rounded-2xl bg-white shadow-lift"
          animate={
            reducedMotion
              ? undefined
              : {
                  x: ['0%', '0%', '155%', '155%'],
                  y: [0, -10, 10, 10],
                  opacity: [1, 1, 1, 0],
                  rotate: [0, -3, -3, 0],
                }
          }
          transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.12, 0.55, 0.72] }}
        >
          <CardFace record={demo} showName={state.settings.showNamesOnCards} />
        </motion.div>
      </div>

      <p className="max-w-[34rem] text-center text-[1.3rem] leading-snug text-white/70">
        {t('howto.step')}
      </p>

      <div className="flex items-center gap-7">
        <div className="flex items-center gap-2.5">
          <span className="h-3.5 w-3.5 rounded-full bg-good" />
          <span className="text-white/60">{t('howto.right')} +100</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="h-3.5 w-3.5 rounded-full bg-near" />
          <span className="text-white/60">{t('howto.close')} +40</span>
        </div>
      </div>

      <button type="button" className="btn btn-lg btn-gold" onClick={() => go('game')}>
        {t('howto.got')}
        <span className="tabular ms-2 opacity-60">{Math.max(0, countdown)}</span>
      </button>
    </div>
  )
}
