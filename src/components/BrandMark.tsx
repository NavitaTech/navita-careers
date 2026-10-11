/**
 * The Navita logo, placed the way the brand hub requires.
 *
 * Three rules from navitabrand.netlify.app shape this component: the
 * full-colour logo belongs on a white or light background, it needs clear
 * space around it, and it is never recoloured, rebuilt or distorted. So the
 * mark sits on a white chip with padding derived from its own height, and the
 * supplied file is drawn unchanged.
 *
 * The brand's digital minimum is 80px tall, which is why this is only used on
 * screens with room for it. Anywhere smaller shows the name as text instead.
 */
import type { Brand } from '../lib/brand'

/** Navita's stated digital minimum, in CSS pixels. */
export const LOGO_MIN_HEIGHT = 80

type Props = {
  brand: Brand | null
  /** Rendered logo height in px. Clamped up to the brand minimum. */
  height?: number
}

export function BrandMark({ brand, height = LOGO_MIN_HEIGHT }: Props) {
  const h = Math.max(LOGO_MIN_HEIGHT, height)
  // Clear space: a tenth of the mark's height on every side, which keeps the
  // chip tight without crowding the wordmark.
  const pad = Math.round(h * 0.18)

  if (!brand?.logo) {
    return (
      <span className="font-display text-[1.15rem] font-bold tracking-tight text-white/75">
        {brand?.name ?? 'Navita'}
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center justify-center rounded-2xl bg-white shadow-card"
      style={{ padding: `${pad}px ${Math.round(pad * 1.3)}px` }}
    >
      <img
        src={brand.logo}
        alt={brand.name}
        style={{ height: h, width: 'auto' }}
        className="block object-contain"
        draggable={false}
      />
    </span>
  )
}
