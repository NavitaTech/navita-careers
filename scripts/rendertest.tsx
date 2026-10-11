/**
 * Renders every screen in a DOM and checks what came out.
 *
 * A type check proves the code compiles; this proves it runs. It catches the
 * class of bug that ships as a blank kiosk - a bad import, a null dereference
 * in a screen nobody opened during development - and it exports the real map
 * SVG the game renders so the cartography can be looked at rather than
 * described. Run: npm run render-test
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'

// A DOM has to exist before the app modules are imported: some of them resolve
// asset URLs against document.baseURI at module scope.
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://booth.local/',
  pretendToBeVisual: true,
})

const g = globalThis as unknown as Record<string, unknown>
g.window = dom.window
g.document = dom.window.document
// Node 26 defines navigator as a getter-only global, so it is redefined
// rather than assigned.
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
})
g.HTMLElement = dom.window.HTMLElement
g.Element = dom.window.Element
g.Image = dom.window.Image
g.DOMRect = dom.window.DOMRect
g.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
// Lets React run act() without warning; the stable-callback check mounts a
// real client root rather than rendering to a string.
g.IS_REACT_ACT_ENVIRONMENT = true
dom.window.matchMedia = g.matchMedia as never
g.requestAnimationFrame = (cb: FrameRequestCallback) => dom.window.setTimeout(() => cb(0), 16)
g.cancelAnimationFrame = (id: number) => dom.window.clearTimeout(id)

const { renderToStaticMarkup } = await import('react-dom/server')
const React = (await import('react')).default
const { AppProvider } = await import('../src/lib/app-state.tsx')
type AppState = import('../src/lib/app-state.tsx').AppState
const { AttractScreen } = await import('../src/screens/Attract.tsx')
const { ResultScreen } = await import('../src/screens/Result.tsx')
const { RegisterScreen } = await import('../src/screens/Register.tsx')
const { ShareScreen } = await import('../src/screens/Share.tsx')
const { HowToScreen } = await import('../src/screens/HowTo.tsx')
const { LeaderboardScreen } = await import('../src/screens/LeaderboardScreen.tsx')
const { AdminScreen } = await import('../src/screens/Admin.tsx')
const { SpectatorScreen } = await import('../src/screens/Spectator.tsx')
const { UKMap } = await import('../src/components/UKMap.tsx')
const { universities } = await import('../src/lib/geo.ts')
const { buildRound, orderDeck } = await import('../src/lib/round.ts')

let passed = 0
let failed = 0

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1
    console.log(`  ok   ${label}`)
  } else {
    failed += 1
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function render(name: string, element: React.ReactElement, seed?: Partial<AppState>): string {
  try {
    // children goes in the props object: AppProvider declares it required.
    const html = renderToStaticMarkup(React.createElement(AppProvider, { seed, children: element }))
    check(`${name} renders`, html.length > 0)
    return html
  } catch (error) {
    check(`${name} renders`, false, (error as Error).message)
    return ''
  }
}

/** A finished round, so the post-game screens can actually be rendered. */
const finishedRound: AppState['result'] = {
  score: 740,
  correct: 7,
  near: 1,
  misses: 0,
  timeLeft: 8,
  durationUsed: 52,
  fullClear: true,
  placements: [],
  citiesPlaced: ['london', 'oxford'],
  playedAt: Date.now(),
}

console.log('\nScreens')
const attract = render('Attract', React.createElement(AttractScreen))
const howto = render('How to play', React.createElement(HowToScreen))
const board = render('Leaderboard', React.createElement(LeaderboardScreen))
const admin = render('Admin', React.createElement(AdminScreen))
const spectator = render('Spectator', React.createElement(SpectatorScreen))

// These three only exist after a round. Rendering them with no result at all
// used to be the whole test, which is how a hook after an early return in
// Result reached the booth.
const result = render('Result', React.createElement(ResultScreen), { result: finishedRound })
const register = render('Register', React.createElement(RegisterScreen), { result: finishedRound })
const share = render('Share', React.createElement(ShareScreen), { result: finishedRound })

console.log('\nContent')
check('the attract screen asks the question', attract.includes('Where is your future campus'))
check('the attract screen offers a way in', attract.includes('Tap to play'))
check('the how-to screen explains the drag', howto.includes('Drag each university'))
check('the leaderboard offers an hourly board', board.includes('This hour'))
check('the admin screen opens locked', admin.includes('Staff access') && !admin.includes('Export CSV'))
check("the spectator screen shows the boards", spectator.includes("top players") && spectator.includes("Schools"))
check('the result screen shows the score', result.includes('740'))
check('the result screen offers the claim step', result.includes('Claim your place'))
check('the result screen lets the student pick cities', result.includes('Which of these'))
check('the register screen asks for a mobile number', register.includes('Mobile number'))
check('the register screen gates on consent', register.includes('agree to be contacted'))
check('the share screen shows a shortlist', /shortlist/i.test(share))

console.log('\nStable callbacks')
{
  // An action whose identity changes on every state change re-triggers any
  // effect that depends on it. That is how brand.json ended up being fetched
  // tens of thousands of times per session, so it is now asserted.
  const { useApp } = await import('../src/lib/app-state.tsx')
  const seen: Record<string, unknown>[] = []

  function Probe() {
    const api = useApp()
    seen.push({ ...api })
    return null
  }

  // Two renders of the same provider, with a state change between them.
  const { createRoot } = await import('react-dom/client')
  const host = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(host)
  const { act } = await import('react')
  const root = createRoot(host)
  await act(async () => {
    root.render(React.createElement(AppProvider, { children: React.createElement(Probe) }))
  })
  await act(async () => {
    seen[seen.length - 1].dataChanged as () => void
    ;(seen[seen.length - 1].dataChanged as () => void)()
  })

  const first = seen[0]
  const last = seen[seen.length - 1]
  const actions = [
    'go', 'setLang', 'setBrand', 'startRound', 'finishRound',
    'setInterested', 'setLead', 'setAssisted', 'dataChanged', 'endSession', 'updateSettings',
  ]
  const unstable = actions.filter((key) => first[key] !== last[key])
  check(
    'every action keeps its identity across a state change',
    seen.length > 1 && unstable.length === 0,
    unstable.length ? unstable.join(', ') : `only ${seen.length} render(s) observed`,
  )
  await act(async () => { root.unmount() })
}

console.log('\nMap')
const deck = orderDeck(buildRound(universities.all, 8))
const mapHtml = renderToStaticMarkup(
  React.createElement(UKMap, {
    cities: universities.cities,
    activeCityIds: new Set(universities.cities.map((c) => c.id)),
    pins: deck.slice(0, 4).map((u) => ({
      universityId: u.id,
      cityId: universities.cityByName.get(u.city)!.id,
      verdict: 'correct' as const,
    })),
    hoveredCityId: 'cardiff',
    hintCityId: null,
    flash: null,
    lensFocus: null,
    lensEnabled: false,
    reducedMotion: true,
  }),
)

for (const city of universities.cities) {
  if (!mapHtml.includes(`>${city.name}<`)) {
    check(`every city is labelled`, false, `${city.name} missing`)
    break
  }
}
check('every city is labelled', universities.cities.every((c) => mapHtml.includes(`>${c.name}<`)))
check('all four nations are drawn', (mapHtml.match(/var\(--land-/g) ?? []).length === 4)
check('the sea texture is applied', mapHtml.includes('sea-texture'))

// Write the real rendered map out so it can be inspected as an image.
const css = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8')
const tokens = new Map<string, string>()
for (const [, name, value] of css.matchAll(/--(c-[a-z0-9-]+|land-[a-z-]+):\s*([^;]+);/g)) {
  tokens.set(name, value.trim())
}
const resolved = mapHtml
  .replace(/rgb\(var\(--(c-[a-z0-9-]+)\)\s*\/\s*([0-9.]+)\)/g, (_m, n, a) => `rgba(${tokens.get(n)!.replace(/ /g, ',')},${a})`)
  .replace(/rgb\(var\(--(c-[a-z0-9-]+)\)\)/g, (_m, n) => `rgb(${tokens.get(n)!.replace(/ /g, ',')})`)
  .replace(/var\(--(land-[a-z-]+)\)/g, (_m, n) => tokens.get(n) ?? '#fff')
  .replace(/class="map-label"/g, 'font-family="Verdana" font-weight="700" fill="rgb(11,42,69)" stroke="rgb(207,226,242)" stroke-width="7" paint-order="stroke" stroke-linejoin="round"')

writeFileSync(resolve(process.cwd(), 'review/game-map.svg'), resolved)
console.log('\n  wrote review/game-map.svg from the live component')

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
