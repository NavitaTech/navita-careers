/**
 * What the student takes away from the booth.
 *
 * The QR and the WhatsApp link both work without the hall's Wi-Fi: the phone
 * scans a code rendered on the kiosk and opens the link over its own mobile
 * data. Nothing is sent from the kiosk itself.
 */
import QRCode from 'qrcode'
import type { Lead, Major, RoundResult } from './types'
import type { Match } from './match'

export type ShareContext = {
  name: string
  major: Major
  result: RoundResult
  matches: Match[]
  cityNames: string[]
  whatsappNumber: string
}

/**
 * The message the student sends to the counsellor. Written from the student's
 * side, because they are the sender: it has to read like something a 17-year-old
 * would actually press send on.
 */
export function whatsappMessage(ctx: ShareContext): string {
  const lines = [
    `Hi! I played UK Campus Drop at the stand.`,
    ``,
    `Name: ${ctx.name}`,
    `Score: ${ctx.result.score}`,
    `Interested in: ${ctx.major}`,
  ]
  if (ctx.cityNames.length) lines.push(`Cities: ${ctx.cityNames.join(', ')}`)
  if (ctx.matches.length) {
    lines.push(``, `My matches:`)
    for (const m of ctx.matches) lines.push(`- ${m.university.name} (${m.university.city})`)
  }
  lines.push(``, `Can you tell me more about applying?`)
  return lines.join('\n')
}

/** A wa.me link, or null when no counsellor number is configured. */
export function whatsappLink(ctx: ShareContext): string | null {
  const digits = ctx.whatsappNumber.replace(/\D/g, '')
  if (digits.length < 8) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(whatsappMessage(ctx))}`
}

export async function qrDataUrl(text: string, size = 520): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0b2a45', light: '#ffffff' },
  })
}

const CARD_W = 1080
const CARD_H = 1350

/**
 * Draws the shareable result card on a canvas. Everything is drawn rather than
 * screenshotted so the card is crisp on a phone and carries no kiosk chrome.
 */
export function drawResultCard(ctx: ShareContext, logoUrl?: string): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const g = canvas.getContext('2d')
  if (!g) return Promise.resolve(null)

  const navy = '#0b2a45'
  const gold = '#f0b429'
  const paper = '#f6f4f0'

  g.fillStyle = navy
  g.fillRect(0, 0, CARD_W, CARD_H)

  // A soft vignette so the card does not read as a flat rectangle.
  const glow = g.createRadialGradient(CARD_W / 2, 360, 60, CARD_W / 2, 360, 760)
  glow.addColorStop(0, 'rgba(14,123,209,0.38)')
  glow.addColorStop(1, 'rgba(14,123,209,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, CARD_W, CARD_H)

  const centre = (text: string, y: number, font: string, fill: string) => {
    g.font = font
    g.fillStyle = fill
    g.textAlign = 'center'
    g.fillText(text, CARD_W / 2, y)
  }

  centre('UK CAMPUS DROP', 130, '600 34px Archivo, Arial', 'rgba(255,255,255,0.55)')
  centre(ctx.name || 'Guest', 232, '800 72px Archivo, Arial', '#ffffff')

  centre(String(ctx.result.score), 470, '800 220px Archivo, Arial', gold)
  centre('POINTS', 532, '700 30px Archivo, Arial', 'rgba(255,255,255,0.55)')

  const stats: [string, string][] = [
    [String(ctx.result.correct), 'correct'],
    [String(ctx.result.near), 'close'],
    [ctx.result.fullClear ? `${ctx.result.timeLeft}s` : '—', 'time left'],
  ]
  stats.forEach(([value, label], i) => {
    const x = CARD_W / 2 + (i - 1) * 290
    g.textAlign = 'center'
    g.font = '700 58px Archivo, Arial'
    g.fillStyle = '#ffffff'
    g.fillText(value, x, 650)
    g.font = '500 28px Public Sans, Arial'
    g.fillStyle = 'rgba(255,255,255,0.5)'
    g.fillText(label, x, 694)
  })

  // Matches panel.
  g.fillStyle = paper
  const panelY = 760
  const panelH = 400
  g.beginPath()
  g.roundRect(70, panelY, CARD_W - 140, panelH, 28)
  g.fill()

  g.textAlign = 'left'
  g.font = '700 30px Archivo, Arial'
  g.fillStyle = '#5b6672'
  g.fillText(`MY ${ctx.major.toUpperCase()} SHORTLIST`, 110, panelY + 64)

  ctx.matches.slice(0, 3).forEach((m, i) => {
    const y = panelY + 128 + i * 88
    g.fillStyle = gold
    g.beginPath()
    g.arc(124, y - 10, 9, 0, Math.PI * 2)
    g.fill()
    g.font = '700 38px Archivo, Arial'
    g.fillStyle = navy
    g.fillText(m.university.name, 154, y)
    g.font = '500 26px Public Sans, Arial'
    g.fillStyle = '#5b6672'
    g.fillText(m.university.city, 154, y + 34)
  })

  centre(
    ctx.cityNames.length ? `Cities I picked: ${ctx.cityNames.join(' · ')}` : 'Ask us about studying in the UK',
    1218,
    '500 28px Public Sans, Arial',
    'rgba(255,255,255,0.6)',
  )

  const finish = (): Promise<Blob | null> =>
    new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))

  if (!logoUrl) return finish()

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Navita's full-colour logo belongs on a light background with clear
      // space around it, so it sits on a white chip rather than on the navy.
      const h = 64
      const w = (img.width / img.height) * h
      const padX = 26
      const padY = 14
      const chipW = w + padX * 2
      const chipH = h + padY * 2
      const chipX = (CARD_W - chipW) / 2
      const chipY = CARD_H - chipH - 34
      g.fillStyle = '#ffffff'
      g.beginPath()
      g.roundRect(chipX, chipY, chipW, chipH, 18)
      g.fill()
      g.drawImage(img, chipX + padX, chipY + padY, w, h)
      finish().then(resolve)
    }
    img.onerror = () => finish().then(resolve)
    img.src = logoUrl
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Pre-fills the counsellor's own follow-up note. Used on the admin lead table. */
export function leadSummary(lead: Lead, cityName: (id: string) => string): string {
  const cities = lead.interestedCities.map(cityName).join(', ')
  return [
    `${lead.fullName} · ${lead.grade} · ${lead.major}`,
    lead.school ? `School: ${lead.school}` : '',
    cities ? `Wants: ${cities}` : '',
    `Score ${lead.score} over ${lead.attempts} attempt${lead.attempts === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join('\n')
}
