/**
 * Timer, score and cards left.
 *
 * Positioned over the Atlantic rather than in a bar above the map: the UK is a
 * tall shape on a 16:9 screen, so that sea is the only space the layout has
 * going spare, and using it lets the landmass stay as large as the panel
 * allows.
 */
import { motion } from 'framer-motion'
import { useT } from '../lib/app-state'

type Props = {
  secondsLeft: number
  totalSeconds: number
  score: number
  cardsLeft: number
  cardsTotal: number
  streak: number
}

function Stat({ label, value, tone = 'light' }: { label: string; value: string; tone?: 'light' | 'gold' }) {
  return (
    <div>
      <div className="font-label text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-white/55">
        {label}
      </div>
      <div
        className={[
          'tabular font-display text-[2.6rem] font-extrabold leading-none tracking-tight',
          tone === 'gold' ? 'text-gold' : 'text-white',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  )
}

export function Hud({ secondsLeft, totalSeconds, score, cardsLeft, cardsTotal, streak }: Props) {
  const t = useT()
  const urgent = secondsLeft <= 10
  const ratio = totalSeconds > 0 ? secondsLeft / totalSeconds : 0

  return (
    <div className="pointer-events-none flex flex-col gap-5">
      <div className="flex items-center gap-4">
        {/* Countdown ring: readable as a shape before the digits are read. */}
        <div className="relative h-[5.6rem] w-[5.6rem] shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="43" fill="none" stroke="rgb(255 255 255 / 0.18)" strokeWidth="10" />
            <motion.circle
              cx="50"
              cy="50"
              r="43"
              fill="none"
              stroke={urgent ? 'rgb(var(--c-bad))' : 'rgb(var(--c-gold))'}
              strokeWidth="10"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              animate={{ strokeDashoffset: 1 - ratio }}
              transition={{ duration: 0.95, ease: 'linear' }}
            />
          </svg>
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={urgent ? { scale: [1, 1.1, 1] } : { scale: 1 }}
            transition={urgent ? { duration: 1, repeat: Infinity } : undefined}
          >
            <span
              className={[
                'tabular font-display text-[2rem] font-extrabold leading-none',
                urgent ? 'text-bad' : 'text-white',
              ].join(' ')}
            >
              {secondsLeft}
            </span>
          </motion.div>
        </div>
        <Stat label={t('hud.score')} value={String(score)} tone="gold" />
      </div>

      <div className="flex gap-8">
        <Stat label={t('hud.left')} value={`${cardsLeft}/${cardsTotal}`} />
        {streak >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-gold/20 px-3 py-1.5"
          >
            <div className="font-label text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-gold">
              {t('hud.streak')}
            </div>
            <div className="tabular font-display text-[1.7rem] font-extrabold leading-none text-gold">
              ×{streak}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
