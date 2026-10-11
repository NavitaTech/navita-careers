/**
 * Score boards.
 *
 * The schools board is the one that changes behaviour: students recruit
 * classmates to overtake a rival school, which is the cheapest queue-building
 * mechanic available at a booth.
 */
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { ScoreEntry } from '../lib/types'
import { compareScores } from '../lib/scoring'
import { useT } from '../lib/app-state'

export type SchoolRow = { school: string; total: number; players: number; best: number }

export function aggregateSchools(scores: ScoreEntry[]): SchoolRow[] {
  const map = new Map<string, SchoolRow>()
  for (const entry of scores) {
    const school = entry.school.trim()
    if (!school) continue
    const row = map.get(school) ?? { school, total: 0, players: 0, best: 0 }
    row.total += entry.score
    row.players += 1
    row.best = Math.max(row.best, entry.score)
    map.set(school, row)
  }
  return [...map.values()].sort((a, b) => b.total - a.total || b.players - a.players)
}

const MEDALS = ['bg-gold text-navy-900', 'bg-white/80 text-navy-900', 'bg-[#c98b4b] text-white']

export function Leaderboard({
  scores,
  limit = 10,
  highlightId,
  compact = false,
  onDelete,
}: {
  scores: ScoreEntry[]
  limit?: number
  highlightId?: string
  compact?: boolean
  onDelete?: (id: string) => void
}) {
  const t = useT()
  const rows = useMemo(() => [...scores].sort(compareScores).slice(0, limit), [scores, limit])

  if (rows.length === 0) {
    return <p className="py-6 text-center text-white/45">{t('board.empty')}</p>
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {rows.map((entry, index) => (
        <motion.li
          key={entry.id}
          layout
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(index * 0.03, 0.3) }}
          className={[
            'flex items-center gap-3 rounded-xl px-3',
            compact ? 'py-1.5' : 'py-2.5',
            entry.id === highlightId ? 'bg-gold/25 ring-2 ring-gold' : 'bg-white/8',
          ].join(' ')}
        >
          <span
            className={[
              'tabular flex shrink-0 items-center justify-center rounded-lg font-display font-extrabold',
              compact ? 'h-7 w-7 text-[0.9rem]' : 'h-9 w-9 text-[1.05rem]',
              index < 3 ? MEDALS[index] : 'bg-white/10 text-white/70',
            ].join(' ')}
          >
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate font-display font-bold text-white">
            {entry.displayName}
            {entry.school && (
              <span className="ms-2 truncate font-body text-[0.82rem] font-normal text-white/45">
                {entry.school}
              </span>
            )}
          </span>
          {entry.fullClear && (
            <span className="shrink-0 rounded-md bg-good/25 px-1.5 py-0.5 font-label text-[0.7rem] font-bold uppercase tracking-wider text-good">
              clear
            </span>
          )}
          <span
            className={[
              'tabular shrink-0 font-display font-extrabold text-gold',
              compact ? 'text-[1.15rem]' : 'text-[1.5rem]',
            ].join(' ')}
          >
            {entry.score}
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(entry.id)}
              className="shrink-0 rounded-lg bg-bad/20 px-2 py-1 font-label text-[0.72rem] font-bold uppercase tracking-wider text-bad hover:bg-bad/35"
            >
              remove
            </button>
          )}
        </motion.li>
      ))}
    </ol>
  )
}

export function SchoolBoard({ rows, limit = 8 }: { rows: SchoolRow[]; limit?: number }) {
  const t = useT()
  if (rows.length === 0) {
    return <p className="py-6 text-center text-white/45">{t('board.empty')}</p>
  }
  return (
    <ol className="flex flex-col gap-1.5">
      {rows.slice(0, limit).map((row, index) => (
        <li key={row.school} className="flex items-center gap-3 rounded-xl bg-white/8 px-3 py-2.5">
          <span
            className={[
              'tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display font-extrabold',
              index < 3 ? MEDALS[index] : 'bg-white/10 text-white/70',
            ].join(' ')}
          >
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display font-bold text-white">{row.school}</span>
            <span className="block font-body text-[0.82rem] text-white/45">
              {t('board.players', { n: row.players })}
            </span>
          </span>
          <span className="tabular shrink-0 font-display text-[1.5rem] font-extrabold text-gold">
            {row.total}
          </span>
        </li>
      ))}
    </ol>
  )
}
