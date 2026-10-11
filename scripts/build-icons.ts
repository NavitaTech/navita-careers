/**
 * Generates the PWA icons from the same map data the game draws, so the home
 * screen icon on a booth iPad is the actual UK outline rather than a stand-in.
 *
 * These are the app's own icons. The company logo is a separate file the
 * marketing team drops into public/assets/brand/.
 *
 * Run: npm run icons
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { ringToPath } from '../src/lib/geo-core.ts'

const read = (p: string) => JSON.parse(readFileSync(resolve(process.cwd(), p), 'utf8'))
const map = read('src/data/uk-map.json')

const OUT = resolve(process.cwd(), 'public/assets/brand')
mkdirSync(OUT, { recursive: true })

// Crop the sea gutter back off: the icon wants the landmass, not the Atlantic.
let minX = Infinity
let minY = Infinity
let maxX = -Infinity
let maxY = -Infinity
for (const nation of map.nations) {
  for (const ring of nation.rings) {
    for (let i = 0; i < ring.length; i += 2) {
      minX = Math.min(minX, ring[i])
      maxX = Math.max(maxX, ring[i])
      minY = Math.min(minY, ring[i + 1])
      maxY = Math.max(maxY, ring[i + 1])
    }
  }
}

const land = map.nations
  .flatMap((n: { rings: number[][] }) => n.rings)
  .map(ringToPath)
  .join(' ')

const w = maxX - minX
const h = maxY - minY
// Square canvas with the outline centred and comfortable padding, so the icon
// survives the circular mask Android applies to maskable icons.
const side = Math.max(w, h) * 1.62
const x = minX - (side - w) / 2
const y = minY - (side - h) / 2

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${side} ${side}" width="512" height="512">
  <rect x="${x}" y="${y}" width="${side}" height="${side}" fill="#0B2A45"/>
  <g fill="#ffffff" stroke="#F0B429" stroke-width="${side * 0.006}" stroke-linejoin="round">
    <path d="${land}"/>
  </g>
</svg>`

for (const size of [192, 512]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
  writeFileSync(resolve(OUT, `icon-${size}.png`), png)
  console.log(`  icon-${size}.png  ${(png.length / 1024).toFixed(0)} KB`)
}
writeFileSync(resolve(OUT, 'icon.svg'), svg)
console.log('PWA icons -> public/assets/brand/')
