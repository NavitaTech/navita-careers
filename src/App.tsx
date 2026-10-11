import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppProvider, useApp } from './lib/app-state'
import { AttractScreen } from './screens/Attract'
import { HowToScreen } from './screens/HowTo'
import { GameScreen } from './screens/Game'
import { ResultScreen } from './screens/Result'
import { RegisterScreen } from './screens/Register'
import { ShareScreen } from './screens/Share'
import { LeaderboardScreen } from './screens/LeaderboardScreen'
import { AdminScreen } from './screens/Admin'
import { SpectatorScreen } from './screens/Spectator'
import { useIdleReset, useReducedMotion, useWakeLock } from './lib/hooks'
import { loadBrand } from './lib/brand'
import { preloadSounds } from './lib/sound'
import { universities } from './lib/geo'
import { allLeads, leadsExportedCount, markLeadsExported, requestPersistence } from './lib/storage'
import { downloadCsv, leadsFilename, leadsToCsv } from './lib/export'

const SCREENS = {
  attract: AttractScreen,
  howto: HowToScreen,
  game: GameScreen,
  result: ResultScreen,
  register: RegisterScreen,
  share: ShareScreen,
  leaderboard: LeaderboardScreen,
  admin: AdminScreen,
} as const

function Booth() {
  const { state, endSession, setBrand } = useApp()
  const reducedMotion = useReducedMotion()
  const { screen, settings, settingsLoaded } = state

  useWakeLock(true)

  useEffect(() => {
    void loadBrand().then(setBrand)
    void requestPersistence()
    preloadSounds()
  }, [setBrand])

  /**
   * Returns to the attract screen after a period with no touch, mid-round
   * included - a student who wanders off should not leave a half-played game
   * on the kiosk. Suspended on the admin screen, where staff read without
   * touching.
   */
  useIdleReset(settings.idleSeconds, endSession, screen !== 'attract' && screen !== 'admin')

  /**
   * Automatic CSV backup. The leads are already mirrored across two stores on
   * the device; this is the copy that survives the device itself.
   */
  useEffect(() => {
    if (!settings.autoExportEnabled) return
    void allLeads().then((leads) => {
      if (leads.length - leadsExportedCount() >= settings.autoExportEvery) {
        downloadCsv(leadsFilename(settings.deviceName), leadsToCsv(leads, (id) =>
          universities.cityById.get(id)?.name ?? id,
        ))
        markLeadsExported(leads.length)
      }
    })
  }, [state.dataVersion, settings.autoExportEnabled, settings.autoExportEvery, settings.deviceName])

  if (!settingsLoaded) {
    return <div className="h-full w-full bg-navy-900" />
  }

  const Screen = SCREENS[screen]

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={screen}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0.01 : 0.22 }}
        className="h-full w-full"
      >
        <Screen />
      </motion.div>
    </AnimatePresence>
  )
}

export function App() {
  // The spectator display is the same build opened at #spectator on a second
  // screen, so the booth ships as one artefact.
  const [isSpectator, setIsSpectator] = useState(() => window.location.hash === '#spectator')
  useEffect(() => {
    const onHashChange = () => setIsSpectator(window.location.hash === '#spectator')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (isSpectator) {
    return (
      <AppProvider>
        <SpectatorScreen />
      </AppProvider>
    )
  }

  return (
    <AppProvider>
      <Booth />
    </AppProvider>
  )
}
