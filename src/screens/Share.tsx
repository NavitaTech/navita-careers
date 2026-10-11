/**
 * What the student leaves with.
 *
 * The QR carries a wa.me link, which the phone opens over its own mobile data -
 * nothing here depends on the exhibition Wi-Fi, and nothing is transmitted from
 * the kiosk. The student sends the first message, which is a far warmer opening
 * for the counselling team than an unexpected call three days later.
 */
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp, useT } from '../lib/app-state'
import { isRtl } from '../lib/i18n'
import { matchesFor } from '../lib/match'
import { universities } from '../lib/geo'
import { drawResultCard, downloadBlob, qrDataUrl, whatsappLink, type ShareContext } from '../lib/share'
import { cachedLogo } from '../lib/logos'

export function ShareScreen() {
  const { state, endSession } = useApp()
  const t = useT()
  const { result, lead, settings, brand, lang, interestedCities } = state
  const [qr, setQr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const rtl = isRtl(lang)
  const major = lead?.major ?? 'Other'

  const matches = useMemo(
    () => (result ? matchesFor(major, result.citiesPlaced, interestedCities) : []),
    [major, result, interestedCities],
  )

  const cityNames = useMemo(
    () => interestedCities.map((id) => universities.cityById.get(id)?.name ?? '').filter(Boolean),
    [interestedCities],
  )

  const context: ShareContext | null = useMemo(() => {
    if (!result) return null
    return {
      name: lead?.fullName ?? t('common.guest'),
      major,
      result,
      matches,
      cityNames,
      whatsappNumber: settings.whatsappNumber || brand?.whatsappNumber || '',
    }
  }, [result, lead, major, matches, cityNames, settings.whatsappNumber, brand, t])

  const link = context ? whatsappLink(context) : null

  useEffect(() => {
    let cancelled = false
    if (!link) {
      // No counsellor number configured: resolve asynchronously so the effect
      // body never sets state during the commit.
      void Promise.resolve().then(() => {
        if (!cancelled) setQr(null)
      })
      return () => {
        cancelled = true
      }
    }
    void qrDataUrl(link)
      .then((url) => {
        if (!cancelled) setQr(url)
      })
      .catch(() => {
        if (!cancelled) setQr(null)
      })
    return () => {
      cancelled = true
    }
  }, [link])

  if (!result || !context) return null

  const saveCard = async () => {
    setSaving(true)
    const blob = await drawResultCard(context, brand?.logo ?? cachedLogo(matches[0]?.university.id ?? '') ?? undefined)
    if (blob) downloadBlob(blob, `uk-campus-drop-${Date.now()}.png`)
    setSaving(false)
  }

  return (
    <div
      dir={rtl ? 'rtl' : 'ltr'}
      className="flex h-full w-full items-center justify-center overflow-y-auto bg-navy-900 p-7"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid w-full max-w-[62rem] grid-cols-[1.3fr_1fr] gap-7"
      >
        <div className="panel flex flex-col gap-4 p-7">
          <div>
            <h1 className="font-display text-[2.1rem] font-extrabold leading-tight tracking-tight text-navy-900">
              {t('share.title')}
            </h1>
            <p className="mt-1 text-ink/55">{t('share.sub', { major })}</p>
          </div>

          <ol className="flex flex-col gap-2.5">
            {matches.map((match, index) => (
              <motion.li
                key={match.university.id}
                initial={{ opacity: 0, x: rtl ? 12 : -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.08 }}
                className="flex items-center gap-4 rounded-2xl bg-ink/5 p-3.5"
              >
                <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-white p-1.5">
                  {cachedLogo(match.university.id) ? (
                    <img
                      src={cachedLogo(match.university.id)!}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="font-display text-[1.1rem] font-extrabold text-navy-800">
                      {match.university.short.slice(0, 3).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[1.2rem] font-bold text-navy-900">
                    {match.university.name}
                  </span>
                  <span className="block text-[0.92rem] text-ink/55">{match.reason}</span>
                </span>
                <span className="shrink-0 rounded-lg bg-navy-800/8 px-2.5 py-1 font-label text-[0.85rem] font-bold uppercase tracking-wide text-navy-800">
                  {match.university.city}
                </span>
              </motion.li>
            ))}
          </ol>

          <p className="rounded-xl bg-accent/8 px-4 py-3 text-[0.98rem] leading-snug text-ink/70">
            {matches[0]
              ? `Ask our counsellors about ${matches[0].university.city} — entry requirements, fees and what ${major} looks like there.`
              : t('share.visit')}
          </p>

          <div className="mt-auto flex gap-3">
            <button type="button" className="btn btn-quiet" onClick={saveCard} disabled={saving}>
              {t('share.download')}
            </button>
            <button type="button" className="btn btn-primary flex-1" onClick={endSession}>
              {t('result.next')}
            </button>
          </div>
        </div>

        <div className="panel flex flex-col items-center justify-center gap-4 p-7 text-center">
          {qr ? (
            <>
              <h2 className="font-display text-[1.45rem] font-bold text-navy-900">{t('share.qr')}</h2>
              <img
                src={qr}
                alt="QR code opening WhatsApp with your result"
                className="h-[15rem] w-[15rem] rounded-xl"
              />
              <p className="text-[0.95rem] leading-snug text-ink/55">{t('share.qrSub')}</p>
              <a href={link ?? '#'} className="btn btn-gold w-full" target="_blank" rel="noreferrer">
                {t('share.whatsapp')}
              </a>
            </>
          ) : (
            <>
              <h2 className="font-display text-[1.45rem] font-bold text-navy-900">{t('share.visit')}</h2>
              <p className="text-[0.95rem] leading-snug text-ink/55">
                {/* Shown until a counsellor number is set in admin. */}
                Add a WhatsApp number in the admin screen to turn this into a scannable handover.
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
