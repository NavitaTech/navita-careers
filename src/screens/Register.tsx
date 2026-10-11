/**
 * Claiming a place on the board - the lead form.
 *
 * Consent is not a checkbox to get past: without it nothing is written to the
 * database at all and the player continues as a guest. The language toggle
 * lives here because this is the screen a parent reads over a student's
 * shoulder, and in Kuwait the parent is the one who decides.
 */
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Keypad } from '../components/Keypad'
import { useApp, useT } from '../lib/app-state'
import { GRADE_LABELS, MAJOR_LABELS, isRtl } from '../lib/i18n'
import { GRADES, MAJORS, type Grade, type Lead, type Major } from '../lib/types'
import { deviceId, formatPhone, isValidKuwaitMobile, newId, phoneKey, publicName } from '../lib/device'
import { allLeads, saveLead, saveScore } from '../lib/storage'

export function RegisterScreen() {
  const { state, go, setLead, setAssisted, dataChanged, setLang } = useApp()
  const t = useT()
  const { result, settings, lang, interestedCities, assistedEntry } = state

  const [fullName, setFullName] = useState('')
  const [digits, setDigits] = useState('')
  const [grade, setGrade] = useState<Grade>('12')
  const [major, setMajor] = useState<Major>('Engineering')
  const [school, setSchool] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [knownSchools, setKnownSchools] = useState<string[]>([])
  const [returning, setReturning] = useState(false)
  const [saving, setSaving] = useState(false)

  const rtl = isRtl(lang)

  // School names are typed once and offered to everyone after, which keeps the
  // school leaderboard from fragmenting across six spellings of one school.
  useEffect(() => {
    void allLeads().then((leads) => {
      const names = [...new Set(leads.map((l) => l.school).filter(Boolean))]
      setKnownSchools(names.sort())
    })
  }, [])

  // A returning player is recognised as soon as their number is complete.
  useEffect(() => {
    if (digits.length < 8) {
      setReturning(false)
      return
    }
    void allLeads().then((leads) => {
      const match = leads.find((l) => phoneKey(l.phone) === phoneKey(digits))
      if (match) {
        setReturning(true)
        setFullName((name) => name || match.fullName)
        setSchool((current) => current || match.school)
        setGrade(match.grade)
        setMajor(match.major)
      } else {
        setReturning(false)
      }
    })
  }, [digits])

  const schoolSuggestions = useMemo(
    () => knownSchools.filter((s) => s.toLowerCase().startsWith(school.toLowerCase()) && s !== school).slice(0, 4),
    [knownSchools, school],
  )

  if (!result) return null

  const submit = async () => {
    if (fullName.trim().length < 2) return setError(t('register.nameInvalid'))
    if (!isValidKuwaitMobile(digits)) return setError(t('register.phoneInvalid'))
    if (!consent) return setError(t('register.consentRequired'))
    setError(null)
    setSaving(true)

    const lead: Lead = {
      id: newId(),
      timestamp: Date.now(),
      fullName: fullName.trim(),
      phone: formatPhone(digits),
      grade,
      major,
      school: school.trim(),
      consent: true,
      interestedCities,
      score: result.score,
      correct: result.correct,
      misses: result.misses,
      attempts: 1,
      deviceId: deviceId(),
      deviceName: settings.deviceName,
      assisted: assistedEntry,
      lang,
    }

    const outcome = await saveLead(lead)
    await saveScore({
      id: newId(),
      displayName: publicName(lead.fullName),
      school: lead.school,
      score: result.score,
      correct: result.correct,
      fullClear: result.fullClear,
      timestamp: result.playedAt,
      phoneKey: phoneKey(lead.phone),
      deviceName: settings.deviceName,
    })

    setLead(outcome.lead)
    dataChanged()
    setSaving(false)
    go('share')
  }

  return (
    <div
      dir={rtl ? 'rtl' : 'ltr'}
      className="flex h-full w-full items-center justify-center overflow-y-auto bg-navy-900 p-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel grid w-full max-w-[58rem] grid-cols-[1.25fr_1fr] gap-7 p-7"
      >
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-[2rem] font-extrabold leading-tight tracking-tight text-navy-900">
                {t('register.title')}
              </h1>
              <p className="mt-1 text-ink/55">{t('result.claimSub')}</p>
            </div>
            <div className="flex shrink-0 gap-1 rounded-xl bg-ink/8 p-1">
              {(['en', 'ar'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={[
                    'rounded-lg px-3 py-1.5 font-display text-[0.9rem] font-bold uppercase',
                    lang === code ? 'bg-navy-800 text-white' : 'text-ink/55',
                  ].join(' ')}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          {returning && (
            <p className="rounded-xl bg-good/12 px-4 py-2.5 text-[0.95rem] font-medium text-good">
              {t('register.returning')}
            </p>
          )}

          <label className="block">
            <span className="mb-1.5 block font-label text-[0.85rem] font-semibold uppercase tracking-[0.1em] text-ink/55">
              {t('register.name')}
            </span>
            <input
              id="lead-name"
              className="field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('register.namePh')}
              autoComplete="off"
              autoCapitalize="words"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block font-label text-[0.85rem] font-semibold uppercase tracking-[0.1em] text-ink/55">
              {t('register.school')}
            </span>
            <input
              id="lead-school"
              className="field"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder={t('register.schoolPh')}
              autoComplete="off"
            />
            {schoolSuggestions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {schoolSuggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSchool(name)}
                    className="rounded-lg bg-accent/10 px-2.5 py-1 text-[0.85rem] font-medium text-accent"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block font-label text-[0.85rem] font-semibold uppercase tracking-[0.1em] text-ink/55">
                {t('register.grade')}
              </span>
              <select
                id="lead-grade"
                className="field"
                value={grade}
                onChange={(e) => setGrade(e.target.value as Grade)}
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {GRADE_LABELS[lang][g]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block font-label text-[0.85rem] font-semibold uppercase tracking-[0.1em] text-ink/55">
                {t('register.major')}
              </span>
              <select
                id="lead-major"
                className="field"
                value={major}
                onChange={(e) => setMajor(e.target.value as Major)}
              >
                {MAJORS.map((m) => (
                  <option key={m} value={m}>
                    {MAJOR_LABELS[lang][m]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-ink/5 p-3.5">
            <input
              id="lead-consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-6 w-6 shrink-0 accent-[rgb(var(--c-accent))]"
            />
            <span className="text-[0.98rem] leading-snug text-ink/75">{t('register.consent')}</span>
          </label>

          {error && (
            <p role="alert" className="rounded-xl bg-bad/10 px-4 py-2.5 font-medium text-bad">
              {error}
            </p>
          )}

          <div className="mt-auto flex items-center gap-3">
            <button
              type="button"
              className="btn btn-primary flex-1"
              onClick={submit}
              disabled={saving}
            >
              {saving ? t('register.saved') : t('register.submit')}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => go('result')}>
              {t('register.back')}
            </button>
          </div>

          <label className="flex items-center gap-2 text-[0.85rem] text-ink/45">
            <input
              id="lead-assisted"
              type="checkbox"
              checked={assistedEntry}
              onChange={(e) => setAssisted(e.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--c-accent))]"
            />
            {t('register.assisted')}
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <span className="font-label text-[0.85rem] font-semibold uppercase tracking-[0.1em] text-ink/55">
            {t('register.phone')}
          </span>
          <div
            dir="ltr"
            className="tabular flex items-center gap-2 rounded-xl border-2 border-ink/15 bg-white px-4 py-3 font-display text-[1.6rem] font-bold text-navy-900"
          >
            <span className="text-ink/40">+965</span>
            <span className="min-w-0 flex-1 truncate">{digits || '········'}</span>
          </div>
          <Keypad value={digits} onChange={setDigits} maxLength={8} />
        </div>
      </motion.div>
    </div>
  )
}
