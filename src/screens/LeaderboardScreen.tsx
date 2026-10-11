import { useEffect, useMemo, useState } from 'react'
import { Leaderboard, SchoolBoard, aggregateSchools } from '../components/Leaderboard'
import { useApp, useT } from '../lib/app-state'
import { allScores, startOfHour, startOfToday } from '../lib/storage'
import type { ScoreEntry } from '../lib/types'

type Tab = 'hour' | 'today' | 'event' | 'schools'

export function LeaderboardScreen() {
  const { go, state } = useApp()
  const t = useT()
  const [scores, setScores] = useState<ScoreEntry[]>([])
  const [tab, setTab] = useState<Tab>('today')

  useEffect(() => {
    void allScores().then(setScores)
  }, [state.dataVersion])

  const today = useMemo(() => scores.filter((s) => s.timestamp >= startOfToday()), [scores])
  const hour = useMemo(() => scores.filter((s) => s.timestamp >= startOfHour()), [scores])
  const schools = useMemo(() => aggregateSchools(today), [today])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'hour', label: t('board.hour') },
    { id: 'today', label: t('board.today') },
    { id: 'event', label: t('board.event') },
    { id: 'schools', label: t('board.schools') },
  ]

  return (
    <div className="flex h-full w-full flex-col gap-5 bg-navy-900 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-[2.4rem] font-extrabold tracking-tight text-white">
          {t('board.title')}
        </h1>
        <button type="button" className="btn btn-ghost" onClick={() => go('attract')}>
          {t('board.back')}
        </button>
      </div>

      <div className="flex gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={[
              'rounded-xl px-4 py-2.5 font-display font-bold transition-colors',
              tab === item.id ? 'bg-gold text-navy-900' : 'bg-white/10 text-white/65 hover:bg-white/20',
            ].join(' ')}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'schools' ? (
          <SchoolBoard rows={schools} limit={12} />
        ) : (
          <Leaderboard
            scores={tab === 'hour' ? hour : tab === 'today' ? today : scores}
            limit={12}
          />
        )}
      </div>
    </div>
  )
}
