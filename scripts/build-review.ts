/**
 * Emits review/map-review.html - the cartography sign-off sheet. It draws the
 * generated map at full size with every city dot, label and snap target, plus
 * the crowding measurements, so map accuracy can be approved before UI work.
 *
 * Run: npm run map:review
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { geoTransverseMercator } from 'd3-geo'
import { buildCities, ringToPath } from '../src/lib/geo-core.ts'
import { DIRECTIONS, DOT_RADIUS, LABEL_SIZE, LEADER_DISTANCE, labelPosition } from '../src/lib/labels.ts'

// Resolved from the project root: this file runs through a bundler, so its own
// location is not where the sources live.
const root = (p: string) => resolve(process.cwd(), p)
const read = (p: string) => JSON.parse(readFileSync(root(p), 'utf8'))

const map = read('src/data/uk-map.json')
const unis = read('src/data/universities.json').universities
const cityCfg = read('src/data/cities.json').cities

const projection = geoTransverseMercator()
  .rotate(map.projection.rotate)
  .scale(map.projection.scale)
  .translate(map.projection.translate)

const cities = buildCities(unis, cityCfg, (lon, lat) => projection([lon, lat])!, map.nations)
const vb = map.viewBox

// --- map drawing -----------------------------------------------------------

// The same numbers the game draws with, so this sheet signs off what ships.
const DOT = DOT_RADIUS
const LABEL_FONT = LABEL_SIZE

let land = ''
for (const nation of map.nations) {
  land += `<g fill="var(--land-${nation.id})" stroke="var(--coast)" stroke-width="1.5" stroke-linejoin="round">`
  for (const ring of nation.rings) land += `<path d="${ringToPath(ring)}"/>`
  land += '</g>'
}

let snaps = ''
let dots = ''
let labels = ''
for (const c of cities) {
  const direction = DIRECTIONS[c.label] ?? DIRECTIONS.s
  const { x: lx, y: ly, anchor } = labelPosition(c)

  snaps += `<circle cx="${c.x}" cy="${c.y}" r="${c.snap.toFixed(1)}" fill="var(--snap-fill)" stroke="var(--snap-line)" stroke-width="1.2" stroke-dasharray="7 6"/>`
  if (c.leader) {
    labels += `<line x1="${(c.x + direction.dx * DOT).toFixed(1)}" y1="${(c.y + direction.dy * DOT).toFixed(1)}" x2="${(c.x + direction.dx * (LEADER_DISTANCE - 5)).toFixed(1)}" y2="${(c.y + direction.dy * (LEADER_DISTANCE - 5)).toFixed(1)}" stroke="var(--coast)" stroke-width="1.3" opacity="0.5"/>`
  }
  dots += `<circle cx="${c.x}" cy="${c.y}" r="${DOT}" fill="var(--pin)" stroke="#fff" stroke-width="2.6"/>`
  if (c.universities.length > 1) {
    dots += `<circle cx="${c.x}" cy="${c.y}" r="${DOT + 6}" fill="none" stroke="var(--pin)" stroke-width="2" opacity="0.5"/>`
  }
  const count = c.universities.length > 1 ? ` <tspan fill="var(--pin)">${c.universities.length}</tspan>` : ''
  labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="${LABEL_FONT}" text-anchor="${anchor}" dominant-baseline="middle" class="lbl">${c.name}${count}</text>`
}

const mapSvg = (extraClass: string, vbox: string) => `<svg class="${extraClass}" viewBox="${vbox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Projected map of the United Kingdom with the sixteen host cities marked">
<rect x="${vb.x}" y="${vb.y}" width="${vb.width}" height="${vb.height}" fill="var(--sea)"/>
${land}<g class="snaps">${snaps}</g>${dots}<g class="labels">${labels}</g></svg>`

// --- crowding table --------------------------------------------------------

const pairs: { a: string; b: string; d: number; overlap: boolean }[] = []
for (let i = 0; i < cities.length; i += 1) {
  for (let j = i + 1; j < cities.length; j += 1) {
    const a = cities[i]
    const b = cities[j]
    const d = Math.hypot(a.x - b.x, a.y - b.y)
    pairs.push({ a: a.name, b: b.name, d, overlap: d < a.snap + b.snap })
  }
}
pairs.sort((p, q) => p.d - q.d)
const tightest = pairs.slice(0, 6)

// Screen scale: the map panel gets ~60% of 1920 and the full column height.
const PANEL_H = 936
const pxPerUnit = PANEL_H / vb.height
const landmassPx = Math.round((vb.width - 2 * 294) * pxPerUnit)

const rows = tightest
  .map(
    (p) => `<tr><td>${p.a} &ndash; ${p.b}</td><td class="num">${p.d.toFixed(0)}</td><td class="num">${(p.d * pxPerUnit).toFixed(0)} px</td><td>${
      p.overlap ? '<span class="pill pill-warn">overlapping</span>' : '<span class="pill pill-ok">clear</span>'
    }</td></tr>`,
  )
  .join('')

const cityRows = [...cities]
  .sort((a, b) => a.snap - b.snap)
  .map(
    (c) =>
      `<tr><td>${c.name}</td><td>${c.nation}</td><td class="num">${c.snap.toFixed(0)}</td><td class="num">${(c.snap * pxPerUnit).toFixed(0)} px</td><td class="num">${c.universities.length}</td></tr>`,
  )
  .join('')

const totalPoints = map.nations.reduce(
  (sum: number, n: { rings: number[][] }) => sum + n.rings.reduce((s, r) => s + r.length / 2, 0),
  0,
)

// --- page ------------------------------------------------------------------

const html = `<title>UK Campus Drop Cartography</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Barlow+Semi+Condensed:wght@500;600;700&family=Public+Sans:wght@400;500;600&display=swap">
<style>
/* Layout: a full-bleed map plate on paper, with the measurements stacked beneath it. */
:root {
  --sea: #cfe2f2;
  --sea-deep: #b9d5ec;
  --coast: #233b52;
  --land-england: #ffffff;
  --land-scotland: #f6fafd;
  --land-wales: #fcfdff;
  --land-northern-ireland: #f2f8fd;
  --pin: #0b4f8a;
  --snap-fill: rgba(11, 79, 138, 0.07);
  --snap-line: rgba(11, 79, 138, 0.5);

  --bg: #f4f2ee;
  --surface: #ffffff;
  --ink: #16212c;
  --ink-soft: #5b6672;
  --rule: #ded9d1;
  --accent: #0b4f8a;
  --warn-bg: #fdf0e1;
  --warn-ink: #8a4b05;
  --ok-bg: #e8f3ec;
  --ok-ink: #1f6b40;

  --display: 'Archivo', 'Helvetica Neue', Arial, sans-serif;
  --body: 'Public Sans', 'Helvetica Neue', Arial, sans-serif;
  --label: 'Barlow Semi Condensed', 'Arial Narrow', Arial, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --sea: #11293d;
    --sea-deep: #0d2031;
    --coast: #7ea6c9;
    --land-england: #1d2c3a;
    --land-scotland: #1a2836;
    --land-wales: #1f2f3e;
    --land-northern-ireland: #182533;
    --pin: #6fb4f0;
    --snap-fill: rgba(111, 180, 240, 0.09);
    --snap-line: rgba(111, 180, 240, 0.5);

    --bg: #12161b;
    --surface: #1a2028;
    --ink: #e8edf2;
    --ink-soft: #9aa7b4;
    --rule: #2c3540;
    --accent: #6fb4f0;
    --warn-bg: #3a2a12;
    --warn-ink: #f0bd77;
    --ok-bg: #16301f;
    --ok-ink: #83d3a2;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --sea: #11293d;
  --sea-deep: #0d2031;
  --coast: #7ea6c9;
  --land-england: #1d2c3a;
  --land-scotland: #1a2836;
  --land-wales: #1f2f3e;
  --land-northern-ireland: #182533;
  --pin: #6fb4f0;
  --snap-fill: rgba(111, 180, 240, 0.09);
  --snap-line: rgba(111, 180, 240, 0.5);

  --bg: #12161b;
  --surface: #1a2028;
  --ink: #e8edf2;
  --ink-soft: #9aa7b4;
  --rule: #2c3540;
  --accent: #6fb4f0;
  --warn-bg: #3a2a12;
  --warn-ink: #f0bd77;
  --ok-bg: #16301f;
  --ok-ink: #83d3a2;
  color-scheme: dark;
}

* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--body);
  font-size: 15px;
  line-height: 1.55;
  -webkit-text-size-adjust: 100%;
}
.wrap { max-width: 1180px; margin: 0 auto; padding-inline: 20px; padding-block: 40px 72px; }

.eyebrow {
  font-family: var(--label);
  font-size: 13px; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--accent); margin: 0 0 10px;
}
h1 {
  font-family: var(--display); font-weight: 800;
  font-size: clamp(30px, 5vw, 46px); line-height: 1.05;
  letter-spacing: -0.02em; margin: 0 0 12px; text-wrap: balance;
}
.lede { max-width: 62ch; color: var(--ink-soft); margin: 0 0 32px; font-size: 16px; }

.plate {
  background: var(--sea); border: 1px solid var(--rule); border-radius: 4px;
  overflow: hidden; margin-bottom: 14px;
  background-image: radial-gradient(var(--sea-deep) 1px, transparent 1px);
  background-size: 11px 11px;
}
.plate svg { display: block; width: 100%; height: auto; max-width: 100%; }
.lbl {
  font-family: var(--label); font-weight: 700; fill: var(--coast);
  stroke: var(--sea); stroke-width: 5px; paint-order: stroke;
}
.caption { color: var(--ink-soft); font-size: 13.5px; margin: 0 0 44px; }

.specs { display: grid; grid-template-columns: repeat(auto-fit, minmax(168px, 1fr)); gap: 1px; background: var(--rule); border: 1px solid var(--rule); margin-bottom: 44px; }
.spec { background: var(--surface); padding: 16px 18px; min-width: 0; }
.spec dt { font-family: var(--label); font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-soft); margin: 0 0 4px; }
.spec dd { font-family: var(--display); font-weight: 700; font-size: 25px; margin: 0; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.spec dd small { font-family: var(--body); font-weight: 500; font-size: 13px; color: var(--ink-soft); letter-spacing: 0; }

h2 { font-family: var(--display); font-weight: 700; font-size: 21px; letter-spacing: -0.01em; margin: 0 0 6px; }
h2 + p { color: var(--ink-soft); margin: 0 0 16px; max-width: 64ch; font-size: 14.5px; }
section { margin-bottom: 44px; }

.scroll { overflow-x: auto; border: 1px solid var(--rule); background: var(--surface); }
table { border-collapse: collapse; width: 100%; font-size: 14px; min-width: 460px; }
th, td { text-align: left; padding: 9px 16px; border-bottom: 1px solid var(--rule); white-space: nowrap; }
th { font-family: var(--label); font-size: 12px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-soft); }
tbody tr:last-child td { border-bottom: 0; }
.num { font-variant-numeric: tabular-nums; text-align: right; }
.pill { display: inline-block; font-family: var(--label); font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 8px; border-radius: 2px; }
.pill-warn { background: var(--warn-bg); color: var(--warn-ink); }
.pill-ok { background: var(--ok-bg); color: var(--ok-ink); }

.note { border-left: 3px solid var(--accent); background: var(--surface); padding: 16px 20px; }
.note h3 { font-family: var(--display); font-size: 16px; font-weight: 700; margin: 0 0 6px; }
.note p { margin: 0 0 10px; font-size: 14.5px; }
.note p:last-child { margin: 0; }
.note strong { font-weight: 600; }

footer { border-top: 1px solid var(--rule); padding-top: 18px; color: var(--ink-soft); font-size: 13px; }
</style>

<div class="wrap">
  <p class="eyebrow">Step 2 &middot; cartography sign-off</p>
  <h1>UK Campus Drop Cartography</h1>
  <p class="lede">The booth map, generated from Natural Earth 1:10m administrative boundaries and projected on the Ordnance Survey basis. Dashed rings are the drop targets a player actually has to hit. Approve this before any screen work continues.</p>

  <div class="plate">${mapSvg('full', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`)}</div>
  <p class="caption">All sixteen host cities with their name labels and snap targets. England, Scotland, Wales and Northern Ireland are four separate shapes, tinted apart. Shetland is cropped so the mainland can sit larger.</p>

  <dl class="specs">
    <div class="spec"><dt>Projection</dt><dd>TM 2&deg;W<small> &nbsp;OS grid basis</small></dd></div>
    <div class="spec"><dt>Coastline</dt><dd>${totalPoints.toLocaleString('en-GB')}<small> pts</small></dd></div>
    <div class="spec"><dt>Map payload</dt><dd>42<small> KB</small></dd></div>
    <div class="spec"><dt>Landmass width</dt><dd>${landmassPx}<small> px @1080p</small></dd></div>
    <div class="spec"><dt>Host cities</dt><dd>${cities.length}</dd></div>
    <div class="spec"><dt>Universities</dt><dd>${unis.length}</dd></div>
  </dl>

  <section>
    <h2>Snap target per city</h2>
    <p>The brief proposed a fixed 40&nbsp;px snap radius. A fixed radius does not survive the Cardiff&ndash;Bristol pair, so each city instead gets half the distance to its nearest neighbour, clamped to a comfortable range. Radii are listed tightest first.</p>
    <div class="scroll"><table>
      <thead><tr><th>City</th><th>Nation</th><th class="num">Snap (units)</th><th class="num">On screen</th><th class="num">Unis</th></tr></thead>
      <tbody>${cityRows}</tbody>
    </table></div>
  </section>

  <section>
    <h2>Closest city pairs</h2>
    <p>Measured centre to centre. Screen pixels assume the map panel takes 60% of a 1920&times;1080 booth screen at full column height.</p>
    <div class="scroll"><table>
      <thead><tr><th>Pair</th><th class="num">Distance</th><th class="num">On screen</th><th>Targets</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>

  <section>
    <div class="note">
      <h3>Cardiff and Bristol need more than label placement</h3>
      <p>They sit <strong>${tightest[0].d.toFixed(0)} units</strong> apart &mdash; about <strong>${(tightest[0].d * pxPerUnit).toFixed(0)}&nbsp;px</strong> on the booth screen, closer than a fingertip is wide. Adaptive radii stop the two targets from overlapping, but a player aiming between them is still guessing.</p>
      <p>The game answers this in three ways: Cardiff's label goes west and Bristol's south-east on leader lines, the Severn estuary cluster magnifies while a card is in the air, and a drop that lands on the wrong one of the two scores partial credit rather than a penalty, since both are a correct read of the region.</p>
    </div>
  </section>

  <footer>
    Generated from <code>src/data/uk-map.json</code> &middot; boundary data: Natural Earth 1:10m Admin 0 map subunits (public domain) &middot; ${new Date().toISOString().slice(0, 10)}
  </footer>
</div>
`

mkdirSync(root('review'), { recursive: true })
writeFileSync(root('review/map-review.html'), html)
console.log(`review/map-review.html written (${(html.length / 1024).toFixed(0)} KB)`)
console.log(`  landmass on a 1080p booth screen: ${landmassPx} px wide`)
console.log(`  overlapping snap targets: ${pairs.filter((p) => p.overlap).length}`)
