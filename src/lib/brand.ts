/**
 * Company branding, loaded at runtime from public/assets/brand/brand.json.
 *
 * Kept out of the build so the marketing team can repaint the kiosk and swap
 * the logo between events by replacing two files on the device.
 */
export type Brand = {
  name: string
  logo: string | null
  colors: Partial<Record<string, string>>
  whatsappNumber?: string
  standText?: string
}

const DEFAULT_BRAND: Brand = {
  name: 'UK Campus Drop',
  logo: null,
  colors: {},
}

/** #0b2a45 becomes "11 42 69", which is the form the CSS variables take. */
function hexToRgbTriplet(hex: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  let value = match[1]
  if (value.length === 3) value = value.split('').map((c) => c + c).join('')
  const n = parseInt(value, 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

const TOKENS = [
  'navy-900', 'navy-800', 'navy-700', 'navy-600',
  'sea', 'sea-deep', 'ink', 'paper', 'accent', 'gold', 'good', 'near', 'bad',
]

export function applyBrandColors(colors: Brand['colors']): void {
  for (const token of TOKENS) {
    const value = colors[token]
    if (!value) continue
    const triplet = hexToRgbTriplet(value)
    if (triplet) document.documentElement.style.setProperty(`--c-${token}`, triplet)
  }
}

export async function loadBrand(): Promise<Brand> {
  let brand: Brand = { ...DEFAULT_BRAND }
  try {
    const response = await fetch(new URL('assets/brand/brand.json', document.baseURI).href, {
      cache: 'no-cache',
    })
    if (response.ok) {
      const data = (await response.json()) as Partial<Brand>
      brand = { ...brand, ...data, colors: data.colors ?? {} }
    }
  } catch {
    // No brand file is a normal state before the assets are dropped in.
  }
  // brand.json names the file; nothing is probed for.
  brand.logo = brand.logo ? new URL(brand.logo, document.baseURI).href : null
  applyBrandColors(brand.colors)
  return brand
}
