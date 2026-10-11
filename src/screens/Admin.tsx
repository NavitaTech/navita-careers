/**
 * Staff screen. Reached by holding the company logo for three seconds, then a
 * four-digit PIN - hard enough that no student finds it, quick enough that a
 * counsellor can open it between players.
 *
 * The event dashboard here is not decoration: lead count, consent rate, leads
 * per hour and the city heat map are what the team reports after the event, and
 * which cities drew interest decides who gets invited to the next one.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../lib/app-state'
import { Keypad } from '../components/Keypad'
import { Leaderboard } from '../components/Leaderboard'
import { universities } from '../lib/geo'
import { resolveAll, cachedLogo, unusedLogoFiles } from '../lib/logos'
import {
  allLeads,
  allScores,
  clearLeads,
  clearScores,
  deleteScore,
  leadsExportedCount,
  markLeadsExported,
  startOfToday,
  storageHealth,
} from '../lib/storage'
import { downloadCsv, leadsFilename, leadsToCsv, scoresToCsv } from '../lib/export'
import type { Lead, ScoreEntry } from '../lib/types'
import { formatPhone } from '../lib/device'

type Tab = 'dashboard' | 'round' | 'leads' | 'logos' | 'board'

const cityName = (id: string): string => universities.cityById.get(id)?.name ?? id

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/6 p-5">
      <h3 className="mb-3 font-label text-[0.85rem] font-semibold uppercase tracking-[0.14em] text-white/45">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2">
      <span className="text-white/75">{label}</span>
      {children}
    </label>
  )
}

function Tile({ value, label, tone = 'text-white' }: { value: string; label: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-white/6 px-4 py-3">
      <div className={`tabular font-display text-[1.9rem] font-extrabold leading-none ${tone}`}>{value}</div>
      <div className="mt-1 font-label text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-white/45">
        {label}
      </div>
    </div>
  )
}

export function AdminScreen() {
  const { state, go, updateSettings, dataChanged } = useApp()
  const { settings } = state
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [leads, setLeads] = useState<Lead[]>([])
  const [scores, setScores] = useState<ScoreEntry[]>([])
  // Derived from the build-time manifest, so it is computed rather than held
  // in state and pushed from an effect.
  const logos = useMemo(() => resolveAll(universities.all), [])
  const [health, setHealth] = useState<{ usedMb: number; quotaMb: number } | null>(null)
  const [confirming, setConfirming] = useState<'leads' | 'scores' | null>(null)

  const refresh = useCallback(async () => {
    const [l, s, h] = await Promise.all([allLeads(), allScores(), storageHealth()])
    setLeads(l)
    setScores(s)
    setHealth(h)
  }, [])

  useEffect(() => {
    if (!unlocked) return
    void refresh()
  }, [unlocked, refresh])

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === settings.pin) {
        setUnlocked(true)
        setPinError(false)
      } else {
        setPinError(true)
        setPin('')
      }
    }
  }, [pin, settings.pin])

  const unexported = Math.max(0, leads.length - leadsExportedCount())

  const stats = useMemo(() => {
    const since = startOfToday()
    const todayLeads = leads.filter((l) => l.timestamp >= since)
    const todayScores = scores.filter((s) => s.timestamp >= since)
    const hours = new Map<number, number>()
    for (const lead of todayLeads) hours.set(new Date(lead.timestamp).getHours(), (hours.get(new Date(lead.timestamp).getHours()) ?? 0) + 1)
    const peak = [...hours.entries()].sort((a, b) => b[1] - a[1])[0]

    const majors = new Map<string, number>()
    for (const lead of todayLeads) majors.set(lead.major, (majors.get(lead.major) ?? 0) + 1)

    const cities = new Map<string, number>()
    for (const lead of leads) for (const id of lead.interestedCities) cities.set(id, (cities.get(id) ?? 0) + 1)

    return {
      plays: todayScores.length,
      leads: todayLeads.length,
      conversion: todayScores.length ? Math.round((todayLeads.length / todayScores.length) * 100) : 0,
      perHour: hours.size ? Math.round(todayLeads.length / hours.size) : 0,
      peakHour: peak ? `${String(peak[0]).padStart(2, '0')}:00` : '—',
      majors: [...majors.entries()].sort((a, b) => b[1] - a[1]),
      cities: [...cities.entries()].sort((a, b) => b[1] - a[1]),
      assisted: todayLeads.filter((l) => l.assisted).length,
    }
  }, [leads, scores])

  const exportLeads = () => {
    downloadCsv(leadsFilename(settings.deviceName), leadsToCsv(leads, cityName))
    markLeadsExported(leads.length)
    void refresh()
  }

  const missing = universities.all.filter((u) => logos.get(u.id) === null)
  const unused = unusedLogoFiles(universities.all)

  if (!unlocked) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-navy-900 p-8">
        <h1 className="font-display text-[1.6rem] font-bold text-white/70">Staff access</h1>
        <div className="tabular font-display text-[2.6rem] font-extrabold tracking-[0.3em] text-white">
          {pin.padEnd(4, '·')}
        </div>
        {pinError && <p className="font-medium text-bad">Wrong PIN</p>}
        <div className="w-[16rem] rounded-2xl bg-white p-3">
          <Keypad value={pin} onChange={setPin} maxLength={4} />
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => go('attract')}>
          Back to the game
        </button>
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'round', label: 'Round & device' },
    { id: 'leads', label: `Leads (${leads.length})` },
    { id: 'logos', label: `Logos${missing.length ? ` (${missing.length}!)` : ''}` },
    { id: 'board', label: 'Leaderboard' },
  ]

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-hidden bg-navy-900 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-[1.8rem] font-extrabold tracking-tight text-white">
          {settings.deviceName}
        </h1>
        <div className="flex items-center gap-3">
          {unexported > 0 && (
            <span className="rounded-xl bg-near/20 px-3 py-2 font-label text-[0.85rem] font-bold uppercase tracking-wider text-near">
              {unexported} unexported
            </span>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => go('attract')}>
            Close
          </button>
        </div>
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

      <div className="min-h-0 flex-1 overflow-y-auto pe-1">
        {tab === 'dashboard' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-6 gap-3">
              <Tile value={String(stats.plays)} label="Rounds today" />
              <Tile value={String(stats.leads)} label="Leads today" tone="text-gold" />
              <Tile
                value={`${stats.conversion}%`}
                label="Play to lead"
                tone={stats.conversion >= 50 ? 'text-good' : 'text-near'}
              />
              <Tile value={String(stats.perHour)} label="Leads per hour" />
              <Tile value={stats.peakHour} label="Busiest hour" />
              <Tile value={String(stats.assisted)} label="Assisted entries" />
            </div>

            <Section title="Cities students want — all days">
              {stats.cities.length === 0 ? (
                <p className="text-white/45">No city picks yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {stats.cities.slice(0, 10).map(([id, count]) => (
                    <div key={id} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 truncate text-white/75">{cityName(id)}</span>
                      <span className="h-5 flex-1 overflow-hidden rounded-md bg-white/8">
                        <span
                          className="block h-full rounded-md bg-accent"
                          style={{ width: `${(count / stats.cities[0][1]) * 100}%` }}
                        />
                      </span>
                      <span className="tabular w-8 shrink-0 text-end font-display font-bold text-white">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <div className="grid grid-cols-2 gap-4">
              <Section title="Preferred majors today">
                {stats.majors.length === 0 ? (
                  <p className="text-white/45">No leads yet.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {stats.majors.map(([major, count]) => (
                      <div key={major} className="flex items-center justify-between gap-3">
                        <span className="text-white/75">{major}</span>
                        <span className="tabular font-display font-bold text-gold">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Storage">
                <div className="flex flex-col gap-2 text-white/75">
                  <div className="flex justify-between">
                    <span>Leads stored</span>
                    <span className="tabular font-bold text-white">{leads.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Not yet exported</span>
                    <span className={`tabular font-bold ${unexported ? 'text-near' : 'text-good'}`}>
                      {unexported}
                    </span>
                  </div>
                  {health && (
                    <div className="flex justify-between">
                      <span>Space used</span>
                      <span className="tabular font-bold text-white">
                        {health.usedMb.toFixed(1)} / {health.quotaMb.toFixed(0)} MB
                      </span>
                    </div>
                  )}
                  <p className="mt-1 text-[0.88rem] leading-snug text-white/45">
                    Every lead is written to two separate stores on this device. Export at least once
                    per session anyway — a CSV in your inbox is the only copy that survives the iPad.
                  </p>
                </div>
              </Section>
            </div>
          </div>
        )}

        {tab === 'round' && (
          <div className="grid grid-cols-2 gap-4">
            <Section title="Round">
              <Row label="Universities per round">
                <input
                  type="number"
                  min={3}
                  max={14}
                  className="field tabular w-24 text-center"
                  value={settings.universitiesPerRound}
                  onChange={(e) => void updateSettings({ universitiesPerRound: Number(e.target.value) })}
                />
              </Row>
              <Row label="Round time (seconds)">
                <input
                  type="number"
                  min={20}
                  max={180}
                  step={5}
                  className="field tabular w-24 text-center"
                  value={settings.roundSeconds}
                  onChange={(e) => void updateSettings({ roundSeconds: Number(e.target.value) })}
                />
              </Row>
              <Row label="Show names on cards">
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-[rgb(var(--c-accent))]"
                  checked={settings.showNamesOnCards}
                  onChange={(e) => void updateSettings({ showNamesOnCards: e.target.checked })}
                />
              </Row>
              <Row label="Partial credit for the right country">
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-[rgb(var(--c-accent))]"
                  checked={settings.partialCredit}
                  onChange={(e) => void updateSettings({ partialCredit: e.target.checked })}
                />
              </Row>
              <Row label="Hint after hesitating">
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-[rgb(var(--c-accent))]"
                  checked={settings.hintsEnabled}
                  onChange={(e) => void updateSettings({ hintsEnabled: e.target.checked })}
                />
              </Row>
              <Row label="Hint delay (seconds)">
                <input
                  type="number"
                  min={2}
                  max={15}
                  className="field tabular w-24 text-center"
                  value={settings.hintDelaySeconds}
                  onChange={(e) => void updateSettings({ hintDelaySeconds: Number(e.target.value) })}
                />
              </Row>
              <Row label="Magnifier over crowded cities">
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-[rgb(var(--c-accent))]"
                  checked={settings.lensEnabled}
                  onChange={(e) => void updateSettings({ lensEnabled: e.target.checked })}
                />
              </Row>
            </Section>

            <Section title="Device">
              <Row label="Device name (goes in the export)">
                <input
                  className="field w-44"
                  value={settings.deviceName}
                  onChange={(e) => void updateSettings({ deviceName: e.target.value })}
                />
              </Row>
              <Row label="Counsellor WhatsApp (with country code)">
                <input
                  className="field tabular w-44"
                  inputMode="numeric"
                  placeholder="9655XXXXXXX"
                  value={settings.whatsappNumber}
                  onChange={(e) => void updateSettings({ whatsappNumber: e.target.value })}
                />
              </Row>
              <Row label="Sound">
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-[rgb(var(--c-accent))]"
                  checked={settings.soundOn}
                  onChange={(e) => void updateSettings({ soundOn: e.target.checked })}
                />
              </Row>
              <Row label="Return to attract after (seconds)">
                <input
                  type="number"
                  min={15}
                  max={300}
                  step={5}
                  className="field tabular w-24 text-center"
                  value={settings.idleSeconds}
                  onChange={(e) => void updateSettings({ idleSeconds: Number(e.target.value) })}
                />
              </Row>
              <Row label="Default language">
                <select
                  className="field w-32"
                  value={settings.defaultLang}
                  onChange={(e) => void updateSettings({ defaultLang: e.target.value as 'en' | 'ar' })}
                >
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </Row>
              <Row label="Web mode (no lead capture)">
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-[rgb(var(--c-accent))]"
                  checked={settings.webMode}
                  onChange={(e) => void updateSettings({ webMode: e.target.checked })}
                />
              </Row>
              <Row label="Staff PIN">
                <input
                  className="field tabular w-24 text-center"
                  inputMode="numeric"
                  maxLength={4}
                  value={settings.pin}
                  onChange={(e) => void updateSettings({ pin: e.target.value })}
                />
              </Row>
            </Section>

            <Section title="Universities in play">
              <div className="flex flex-wrap gap-2">
                {universities.all.map((uni) => {
                  const on = settings.activeUniversityIds.includes(uni.id)
                  return (
                    <button
                      key={uni.id}
                      type="button"
                      onClick={() =>
                        void updateSettings({
                          activeUniversityIds: on
                            ? settings.activeUniversityIds.filter((id) => id !== uni.id)
                            : [...settings.activeUniversityIds, uni.id],
                        })
                      }
                      className={[
                        'rounded-xl px-3 py-2 font-display text-[0.92rem] font-bold transition-colors',
                        on ? 'bg-accent text-white' : 'bg-white/10 text-white/45',
                      ].join(' ')}
                    >
                      {uni.short}
                    </button>
                  )
                })}
              </div>
              <p className="mt-3 text-[0.88rem] text-white/45">
                {settings.activeUniversityIds.length} active, {settings.universitiesPerRound} dealt per round.
              </p>
            </Section>

            <Section title="Automatic backup">
              <Row label="Download a CSV automatically">
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-[rgb(var(--c-accent))]"
                  checked={settings.autoExportEnabled}
                  onChange={(e) => void updateSettings({ autoExportEnabled: e.target.checked })}
                />
              </Row>
              <Row label="Every N new leads">
                <input
                  type="number"
                  min={1}
                  max={500}
                  className="field tabular w-24 text-center"
                  value={settings.autoExportEvery}
                  onChange={(e) => void updateSettings({ autoExportEvery: Number(e.target.value) })}
                />
              </Row>
              <p className="text-[0.88rem] leading-snug text-white/45">
                iPadOS shows a save prompt for every download. If that interrupts the queue, turn this
                off and export by hand between rushes — the leads are mirrored to two stores either way.
              </p>
            </Section>
          </div>
        )}

        {tab === 'leads' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn btn-gold" onClick={exportLeads} disabled={!leads.length}>
                Export CSV ({leads.length})
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => downloadCsv(`scores-${Date.now()}.csv`, scoresToCsv(scores))}
                disabled={!scores.length}
              >
                Export scores
              </button>
              <button
                type="button"
                className="btn btn-ghost text-bad"
                onClick={() => setConfirming('leads')}
                disabled={!leads.length}
              >
                Clear all leads
              </button>
            </div>

            {confirming === 'leads' && (
              <div className="flex items-center gap-3 rounded-xl bg-bad/15 p-4">
                <span className="flex-1 text-white">
                  Delete all {leads.length} leads from this device? Export first — this cannot be undone.
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setConfirming(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn bg-bad text-white"
                  onClick={async () => {
                    await clearLeads()
                    setConfirming(null)
                    dataChanged()
                    void refresh()
                  }}
                >
                  Delete them
                </button>
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl bg-white/6">
              <table className="w-full min-w-[56rem] text-start text-[0.92rem]">
                <thead>
                  <tr className="border-b border-white/10 font-label text-[0.78rem] uppercase tracking-[0.1em] text-white/45">
                    <th className="p-3 text-start">Name</th>
                    <th className="p-3 text-start">Mobile</th>
                    <th className="p-3 text-start">Grade</th>
                    <th className="p-3 text-start">Major</th>
                    <th className="p-3 text-start">School</th>
                    <th className="p-3 text-start">Wants</th>
                    <th className="p-3 text-end">Score</th>
                    <th className="p-3 text-end">Tries</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-white/5 text-white/80">
                      <td className="p-3 font-medium text-white">{lead.fullName}</td>
                      <td className="tabular p-3" dir="ltr">{formatPhone(lead.phone)}</td>
                      <td className="p-3">{lead.grade}</td>
                      <td className="p-3">{lead.major}</td>
                      <td className="p-3">{lead.school || '—'}</td>
                      <td className="p-3">{lead.interestedCities.map(cityName).join(', ') || '—'}</td>
                      <td className="tabular p-3 text-end font-bold text-gold">{lead.score}</td>
                      <td className="tabular p-3 text-end">{lead.attempts}</td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-white/45">
                        No leads captured yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'logos' && (
          <div className="flex flex-col gap-4">
            {missing.length > 0 && (
              <div className="rounded-2xl bg-near/15 p-4 text-white">
                <strong className="font-display">{missing.length} logo files missing.</strong> Drop them into{' '}
                <code className="rounded bg-black/25 px-1.5 py-0.5">public/assets/logos/</code> named by id
                (for example <code className="rounded bg-black/25 px-1.5 py-0.5">oxford.svg</code>), then
                rebuild and redeploy. Those cards show initials until then.
              </div>
            )}
            {unused.length > 0 && (
              <div className="rounded-2xl bg-bad/15 p-4 text-white">
                <strong className="font-display">{unused.length} file(s) nothing uses.</strong> No university
                has the id {unused.map((id) => `"${id}"`).join(', ')} — check the filename against{' '}
                <code className="rounded bg-black/25 px-1.5 py-0.5">universities.json</code>.
              </div>
            )}
            <div className="grid grid-cols-4 gap-3">
              {universities.all.map((uni) => {
                const logo = logos.get(uni.id) ?? cachedLogo(uni.id)
                return (
                  <div
                    key={uni.id}
                    className={[
                      'flex flex-col items-center gap-2 rounded-2xl p-3',
                      logo ? 'bg-white/8' : 'bg-near/15',
                    ].join(' ')}
                  >
                    <div className="flex h-16 w-full items-center justify-center rounded-xl bg-white p-2">
                      {logo ? (
                        <img src={logo} alt="" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="font-label text-[0.82rem] font-bold uppercase tracking-wide text-near">
                          missing
                        </span>
                      )}
                    </div>
                    <span className="text-center text-[0.85rem] leading-tight text-white/70">{uni.short}</span>
                    <code className="text-[0.75rem] text-white/35">{uni.id}</code>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'board' && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <button type="button" className="btn btn-ghost text-bad" onClick={() => setConfirming('scores')}>
                Reset leaderboard
              </button>
            </div>
            {confirming === 'scores' && (
              <div className="flex items-center gap-3 rounded-xl bg-bad/15 p-4">
                <span className="flex-1 text-white">Clear every score? Leads are not affected.</span>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirming(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn bg-bad text-white"
                  onClick={async () => {
                    await clearScores()
                    setConfirming(null)
                    dataChanged()
                    void refresh()
                  }}
                >
                  Reset it
                </button>
              </div>
            )}
            <Leaderboard
              scores={scores}
              limit={40}
              onDelete={async (id) => {
                await deleteScore(id)
                dataChanged()
                void refresh()
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
