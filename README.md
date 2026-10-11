# UK Campus Drop

A touchscreen booth game for a higher-education exhibition in Kuwait. Students
drag UK university logos onto the right city against the clock, and the booth
captures a lead and a set of university matches the counselling team can open a
conversation with.

Runs fully offline after the first load. Nothing leaves the device except a CSV
you export yourself.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

```bash
npm run build        # type-check, then build to dist/
npm test             # 51 checks on the game rules, map and export
npm run render-test  # renders every screen in a DOM and checks what came out
```

The production build in `dist/` can be opened directly from a folder on the
booth device, or deployed (see **Deploying**).

---

## What the team needs to do before the event

### 1. Drop in the university logos

Put one file per university in `public/assets/logos/`, named by its id:
`oxford.svg`, `imperial.png`, and so on. See
[`public/assets/logos/README.md`](public/assets/logos/README.md).

A missing logo is not a crash — that university shows a neutral initials card,
and the admin **Logos** tab lists every file that is missing. Check it before
the doors open.

### 2. Drop in the company brand

Put `logo.svg` and edit `brand.json` in `public/assets/brand/`. Colours there
repaint the whole kiosk with no rebuild. See
[`public/assets/brand/README.md`](public/assets/brand/README.md).

### 3. Set the counsellor's WhatsApp number

Admin → **Round & device** → *Counsellor WhatsApp*, with the country code and
no symbols (`9655XXXXXXX`). This turns the result screen into a QR code the
student scans to send their own result to the counsellor. Leave it blank and
the QR panel is simply not shown.

### 4. Name each device

Admin → **Round & device** → *Device name* (`Kiosk 1`, `Kiosk 2`…). It goes in
every exported row, which is how you merge three iPads into one spreadsheet.

---

## Running the booth

**Open the admin screen:** hold the company logo in the top-left corner for
three seconds, then enter the PIN. Default `2026`, changeable in admin.

**Lock the device down.** On iPad, use Guided Access (Settings → Accessibility →
Guided Access) after opening the game full-screen. The app already blocks
pinch-zoom, double-tap zoom, long-press menus and page scrolling, but Guided
Access is what stops a student leaving Safari altogether.

**Add to Home Screen** on the iPad before the event. That installs it as a PWA:
full-screen with no browser chrome, and the browser stops treating the stored
leads as disposable cache.

**A second screen.** Open the same URL with `#spectator` on a TV behind the
booth. It mirrors the live round and the leaderboards between players. People
watching it are the queue.

### Exporting leads

Admin → **Leads** → **Export CSV**. UTF-8 with a byte-order mark, so Arabic
names open correctly in Excel rather than as mojibake.

Export at least once per session. Every lead is already written to two separate
stores on the device, and a CSV downloads automatically every ten new leads
(configurable, and switchable off if the iPad's save prompt interrupts your
queue) — but a file in your own inbox is the only copy that survives the device.

### Editing the round

`src/data/universities.json` is the single source of truth. Add, remove or
replace entries and the game follows — the map markers, the city list, the
matching and the admin screens all derive from it. No code changes.

```json
{
  "id": "durham",
  "name": "Durham University",
  "short": "Durham",
  "city": "Durham",
  "lon": -1.5757,
  "lat": 54.7676,
  "tier": 2,
  "strengths": ["Business", "Law"],
  "fact": "A collegiate university in the North East."
}
```

- `tier` 1–3 sets the difficulty ramp. Tier 1 is dealt first.
- `strengths` drives the university matches on the result screen.
- A new city appears on the map automatically, positioned from its coordinates.

After adding a city, check its name does not land on a neighbour:

```bash
npm run labels              # reports any collision
npm run labels -- Durham    # lists the label sides that are clear
```

Then set the winning side in `src/data/cities.json`.

---

## How it differs from the original brief

Five deliberate changes. Each one is switchable in admin except the first.

**The student plays before they register.** The brief put the form between the
attract screen and the game. A teenager will not type their phone number to
find out whether a game is any good, especially with a queue behind them — so
the form moved to the result screen, where they are claiming a place on a
leaderboard they can already see their score on. Consent still gates everything:
without the tick, nothing is written and they play on as a guest.

**A wrong drop teaches instead of punishing.** The brief scored −20 for any
wrong city. Most of these students do not know where Exeter is; that is why
they are at the stand. So a drop on the right country scores +40 and says
*"Right country, wrong city — it's Edinburgh"*, and a drop on an immediate
neighbour of the right city scores the same. Only a genuinely distant guess
costs points. Switchable: admin → *Partial credit*.

**Nobody gets stuck.** Hold a card for four seconds without dropping it and the
right city starts pulsing. A round every student finishes is worth more than a
round that sorts them. Switchable: admin → *Hint after hesitating*.

**Cardiff and Bristol get a magnifier.** They sit 41 map units apart — about
34px on the booth screen, narrower than a fingertip. Instead of a fixed 40px
snap radius, each city gets half the distance to its nearest neighbour, and
while a card is in the air a lens opens over crowded clusters at 2.3×.
Switchable: admin → *Magnifier*.

**The lead carries intent, not just a score.** After the round the student taps
up to three cities they would like to study in. That plus their major produces
three matched universities on the result screen, in the export, and in the
WhatsApp message they send the counsellor themselves. "You scored 740" is not a
conversation. "You want Engineering in Manchester" is.

Added alongside: a schools leaderboard (students recruit classmates to overtake
a rival school), an hourly board, an Arabic toggle on the register and result
screens for parents, assisted entry for shy students, one lead per phone number
with attempts counted, a spectator screen, and an event dashboard in admin.

---

## Project layout

```
scripts/
  build-map.ts      generates src/data/uk-map.json from Natural Earth data
  build-review.ts   generates the cartography sign-off page
  build-icons.ts    generates the PWA icons from the map
  build-sounds.ts   synthesises the UI sounds
  fetch-fonts.ts    self-hosts the webfonts
  check-labels.ts   finds a clear position for a city name
  selftest.ts       game rules, map geometry, CSV
  rendertest.tsx    renders every screen in a DOM
src/data/           universities.json, cities.json, uk-map.json
src/lib/            scoring, storage, export, geometry, i18n, sharing
src/components/     UKMap, UniversityCard, Hud, Leaderboard, Keypad
src/screens/        Attract, HowTo, Game, Result, Register, Share,
                    Leaderboard, Admin, Spectator
public/assets/      brand/ and logos/ — the files you supply
public/sounds/      pickup, correct, near, wrong, finish, tick
```

### The map

`src/data/uk-map.json` is generated, not drawn. `npm run map` takes Natural
Earth 1:10m administrative boundaries, keeps England, Scotland, Wales and
Northern Ireland as four separate shapes, drops Shetland so the mainland can sit
larger, projects everything on a Transverse Mercator rotated to 2°W — the
Ordnance Survey National Grid basis, so the UK keeps its familiar proportions —
simplifies the coastline to under half a pixel of error at 1080p, and emits
42KB of plain numbers.

The runtime rebuilds the same projection in the browser, which is why adding a
university to `universities.json` needs no map rebuild.

A note on the brief's "map fills at least 60% of the screen width": the UK is a
tall shape, roughly 0.62:1, so on a 16:9 screen the landmass is limited by
height, not width. The map panel takes 60% of the width and the landmass is as
large as the panel height allows (583px on a 1080p screen); the surrounding sea
is used rather than padded — coastal city names extend into it and the HUD sits
over the Atlantic.

### Testing

`npm test` covers the parts a tester cannot prove by hand on a touchscreen:
that no two drop targets overlap, that a drop between Cardiff and Bristol
always resolves, that a round never deals three London universities, that the
time bonus arithmetic is right, that a formula typed into a name field cannot
execute when the CSV is opened in Excel, and that no city name covers another
name or a marker.

`npm run render-test` renders every screen in jsdom and asserts what came out,
which catches the blank-kiosk class of bug before an exhibition does.

---

## Deploying

```bash
npm run build
```

**Netlify** — `netlify.toml` is included; connect the repo or drag `dist/` onto
the dashboard. Load the site once on each device, then it runs offline.

**From a folder** — `dist/` uses relative paths, so `dist/index.html` opens
directly from a USB stick. The service worker does not register over `file://`,
so for true offline-after-first-load use the hosted build.

---

## Privacy

Leads live in IndexedDB on the device, mirrored to localStorage, and are never
transmitted anywhere. A lead is only written when the consent box is ticked.
The WhatsApp handover is a link the student opens on their own phone — the
kiosk sends nothing.

Boundary data: Natural Earth 1:10m Admin 0 map subunits (public domain).
Fonts: Archivo, Public Sans, Barlow Semi Condensed, IBM Plex Sans Arabic
(SIL Open Font License), self-hosted in `src/styles/fonts/`.
