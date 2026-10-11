/**
 * Session state for one booth.
 *
 * The flow deliberately differs from the original brief: the student plays
 * first and is asked for their details afterwards, on the result screen, when
 * they have a score worth claiming. Asking a teenager for their phone number
 * before they know whether the game is any fun costs most of the leads.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import type { Brand } from './brand'
import type { Lang, Lead, RoundResult, Settings, UniversityRecord } from './types'
import { DEFAULT_SETTINGS } from './config'
import { loadSettings, saveSettings } from './storage'
import { setSoundEnabled } from './sound'
import { publish } from './bus'
import { translate } from './i18n'

export type Screen =
  | 'attract'
  | 'howto'
  | 'game'
  | 'result'
  | 'register'
  | 'share'
  | 'leaderboard'
  | 'admin'

export type AppState = {
  screen: Screen
  settings: Settings
  settingsLoaded: boolean
  brand: Brand | null
  lang: Lang
  /** The round in progress, or the one just finished. */
  deck: UniversityRecord[]
  result: RoundResult | null
  /** Cities the student tapped on the result screen. */
  interestedCities: string[]
  lead: Lead | null
  assistedEntry: boolean
  /** Bumped whenever a score or lead lands, so boards refetch. */
  dataVersion: number
}

type State = AppState

type Action =
  | { type: 'screen'; screen: Screen }
  | { type: 'settings'; settings: Settings }
  | { type: 'settings-loaded'; settings: Settings }
  | { type: 'brand'; brand: Brand }
  | { type: 'lang'; lang: Lang }
  | { type: 'start-round'; deck: UniversityRecord[] }
  | { type: 'finish-round'; result: RoundResult }
  | { type: 'interested'; cities: string[] }
  | { type: 'lead'; lead: Lead | null }
  | { type: 'assisted'; on: boolean }
  | { type: 'data-changed' }
  | { type: 'reset-session' }

const initial: State = {
  screen: 'attract',
  settings: DEFAULT_SETTINGS,
  settingsLoaded: false,
  brand: null,
  lang: 'en',
  deck: [],
  result: null,
  interestedCities: [],
  lead: null,
  assistedEntry: false,
  dataVersion: 0,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'screen':
      return { ...state, screen: action.screen }
    case 'settings':
      return { ...state, settings: action.settings }
    case 'settings-loaded':
      return { ...state, settings: action.settings, settingsLoaded: true, lang: action.settings.defaultLang }
    case 'brand':
      return { ...state, brand: action.brand }
    case 'lang':
      return { ...state, lang: action.lang }
    case 'start-round':
      return { ...state, deck: action.deck, result: null, screen: 'game' }
    case 'finish-round':
      return { ...state, result: action.result, screen: 'result' }
    case 'interested':
      return { ...state, interestedCities: action.cities }
    case 'lead':
      return { ...state, lead: action.lead }
    case 'assisted':
      return { ...state, assistedEntry: action.on }
    case 'data-changed':
      return { ...state, dataVersion: state.dataVersion + 1 }
    case 'reset-session':
      // Everything about the previous player goes, settings and brand stay.
      return {
        ...state,
        screen: 'attract',
        deck: [],
        result: null,
        interestedCities: [],
        lead: null,
        assistedEntry: false,
        lang: state.settings.defaultLang,
      }
    default:
      return state
  }
}

type Api = {
  state: State
  go: (screen: Screen) => void
  setLang: (lang: Lang) => void
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  setBrand: (brand: Brand) => void
  startRound: (deck: UniversityRecord[]) => void
  finishRound: (result: RoundResult) => void
  setInterested: (cities: string[]) => void
  setLead: (lead: Lead | null) => void
  setAssisted: (on: boolean) => void
  dataChanged: () => void
  endSession: () => void
}

const Context = createContext<Api | null>(null)

export function AppProvider({
  children,
  seed,
}: {
  children: ReactNode
  /**
   * Starting state, for tests that need a screen which only exists after a
   * round has been played. Production mounts never pass this.
   */
  seed?: Partial<State>
}) {
  const [state, dispatch] = useReducer(reducer, { ...initial, ...seed })

  useEffect(() => {
    void loadSettings().then((settings) => dispatch({ type: 'settings-loaded', settings }))
  }, [])

  useEffect(() => {
    setSoundEnabled(state.settings.soundOn)
  }, [state.settings.soundOn])

  useEffect(() => {
    publish({ type: 'state', screen: state.screen, playerName: state.lead?.fullName ?? '' })
  }, [state.screen, state.lead])

  /**
   * Every action below is a stable function reference for the life of the
   * provider. That is not a tidiness point: these end up in effect dependency
   * arrays, and when they were rebuilt on each state change, an effect that
   * called one of them re-ran, changed state, and re-ran again. The brand file
   * was being fetched tens of thousands of times a session before this.
   *
   * `state` is read through a ref where an action needs the current value, so
   * nothing has to depend on it.
   */
  const latest = useRef(state)
  useEffect(() => {
    latest.current = state
  })

  const go = useCallback((screen: Screen) => dispatch({ type: 'screen', screen }), [])
  const setLang = useCallback((lang: Lang) => dispatch({ type: 'lang', lang }), [])
  const setBrand = useCallback((brand: Brand) => dispatch({ type: 'brand', brand }), [])
  const startRound = useCallback(
    (deck: UniversityRecord[]) => dispatch({ type: 'start-round', deck }),
    [],
  )
  const finishRound = useCallback(
    (result: RoundResult) => dispatch({ type: 'finish-round', result }),
    [],
  )
  const setInterested = useCallback(
    (cities: string[]) => dispatch({ type: 'interested', cities }),
    [],
  )
  const setLead = useCallback((lead: Lead | null) => dispatch({ type: 'lead', lead }), [])
  const setAssisted = useCallback((on: boolean) => dispatch({ type: 'assisted', on }), [])
  const dataChanged = useCallback(() => dispatch({ type: 'data-changed' }), [])
  const endSession = useCallback(() => dispatch({ type: 'reset-session' }), [])
  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const saved = await saveSettings({ ...latest.current.settings, ...patch })
    dispatch({ type: 'settings', settings: saved })
  }, [])

  const api = useMemo<Api>(
    () => ({
      state,
      go,
      setLang,
      updateSettings,
      setBrand,
      startRound,
      finishRound,
      setInterested,
      setLead,
      setAssisted,
      dataChanged,
      endSession,
    }),
    [
      state,
      go,
      setLang,
      updateSettings,
      setBrand,
      startRound,
      finishRound,
      setInterested,
      setLead,
      setAssisted,
      dataChanged,
      endSession,
    ],
  )

  return <Context.Provider value={api}>{children}</Context.Provider>
}

export function useApp(): Api {
  const api = useContext(Context)
  if (!api) throw new Error('useApp must be used inside AppProvider')
  return api
}

/** Translation bound to the current language. */
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const { state } = useApp()
  const { lang } = state
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  )
}
