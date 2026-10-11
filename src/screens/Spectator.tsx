/**
 * The big screen behind the booth.
 *
 * Opened at #spectator on a second display. It mirrors the round in progress
 * and the board between players, with no controls of its own. People watching
 * the big screen are the queue, and the queue is where the leads come from.
 */
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Leaderboard, SchoolBoard, aggregateSchools } from '../components/Leaderboard'
import { subscribe, type BusMessage } from '../lib/bus'
import { allScores, startOfToday } from '../lib/storage'
import type { ScoreEntry } from '../lib/types'
import { universities } from '../lib/geo'

type Live = { score: number; secondsLeft: number; cardsLeft: number; streak: number }

export function SpectatorScreen() {
  const [screen, setScreen] = useState('attract')
  const [live, setLive] = useState<Live | null>(null)
  const [celebration, setCelebration] = useState<{ score: number; fullClear: boolean } | null>(null)
  const [scores, setScores] = useState<ScoreEntry[]>([])
  const [placed, setPlaced] = useState<{ cityId: string; verdict: string } | null>(null)

  useEffect(() => {
    void allScores().then(setScores)
  }, [celebration])

  useEffect(() => {
    return subscribe((message: BusMessage) => {
      switch (message.type) {
        case 'state':
          setScreen(message.screen)
          if (message.screen === 'game') setCelebration(null)
          break
        case 'tick':
          setLive({
            score: message.score,
            secondsLeft: message.secondsLeft,
            cardsLeft: message.cardsLeft,
            streak: message.streak,
          })
          break
        case 'placed':
          setPlaced({ cityId: message.cityId, verdict: message.verdict })
          window.setTimeout(() => setPlaced(null), 2200)
          break
        case 'round-end':
          setCelebration({ score: message.score, fullClear: message.fullClear })
          void allScores().then(setScores)
          break
        default:
          break
      }
    })
  }, [])

  const today = useMemo(() => scores.filter((s) => s.timestamp >= startOfToday()), [scores])
  const schools = useMemo(() => aggregateSchools(today), [today])
  const playing = screen === 'game' && live

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 bg-navy-900 p-12">
      <AnimatePresence mode="wait">
        {celebration ? (
          <motion.div
            key="celebration"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center"
          >
            {celebration.fullClear && (
              <span className="mb-3 rounded-full bg-good px-6 py-2 font-label text-[1.2rem] font-bold uppercase tracking-[0.16em] text-white">
                Full clear
              </span>
            )}
            <span className="font-display text-[2rem] font-bold text-white/55">Final score</span>
            <span className="tabular font-display text-[12rem] font-extrabold leading-none text-gold">
              {celebration.score}
            </span>
          </motion.div>
        ) : playing ? (
          <motion.div
            key="live"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6"
          >
            <span className="font-label text-[1.4rem] font-semibold uppercase tracking-[0.2em] text-white/45">
              Playing now
            </span>
            <div className="flex items-end gap-16">
              <div className="flex flex-col items-center">
                <span className="tabular font-display text-[11rem] font-extrabold leading-none text-gold">
                  {live.score}
                </span>
                <span className="font-label text-[1.3rem] uppercase tracking-[0.18em] text-white/45">
                  points
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span
                  className={[
                    'tabular font-display text-[7rem] font-extrabold leading-none',
                    live.secondsLeft <= 10 ? 'text-bad' : 'text-white',
                  ].join(' ')}
                >
                  {live.secondsLeft}
                </span>
                <span className="font-label text-[1.3rem] uppercase tracking-[0.18em] text-white/45">
                  seconds
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="tabular font-display text-[7rem] font-extrabold leading-none text-white">
                  {live.cardsLeft}
                </span>
                <span className="font-label text-[1.3rem] uppercase tracking-[0.18em] text-white/45">
                  left
                </span>
              </div>
            </div>
            <AnimatePresence>
              {placed && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className={[
                    'rounded-2xl px-8 py-4 font-display text-[2.4rem] font-extrabold text-white',
                    placed.verdict === 'correct' ? 'bg-good' : 'bg-near',
                  ].join(' ')}
                >
                  {universities.cityById.get(placed.cityId)?.name ?? ''}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="boards"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid w-full max-w-[86rem] grid-cols-2 gap-12"
          >
            <div>
              <h2 className="mb-4 font-display text-[2.2rem] font-extrabold tracking-tight text-white">
                Today's top players
              </h2>
              <Leaderboard scores={today} limit={8} />
            </div>
            <div>
              <h2 className="mb-4 font-display text-[2.2rem] font-extrabold tracking-tight text-white">
                Schools
              </h2>
              <SchoolBoard rows={schools} limit={8} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
