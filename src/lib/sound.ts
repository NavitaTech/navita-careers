/**
 * Short confirmation cues.
 *
 * An exhibition hall runs at 75-85 dB, so audio is a bonus and never the
 * primary feedback - every sound here has a visual counterpart on screen. Files
 * are preloaded at startup so the first correct drop is not silent.
 */
import { Howl } from 'howler'

/**
 * Resolved against the document base rather than imported, because these live
 * in public/ and the build is deployed at a relative base - the booth opens
 * dist/index.html directly as often as it loads it from a URL.
 */
const sound = (name: string): string => new URL(`sounds/${name}.wav`, document.baseURI).href

const FILES = {
  pickup: sound('pickup'),
  correct: sound('correct'),
  near: sound('near'),
  wrong: sound('wrong'),
  finish: sound('finish'),
  tick: sound('tick'),
}

export type SoundName = keyof typeof FILES

const VOLUME: Record<SoundName, number> = {
  pickup: 0.35,
  correct: 0.85,
  near: 0.7,
  wrong: 0.6,
  finish: 0.9,
  tick: 0.25,
}

const howls = new Map<SoundName, Howl>()
let enabled = true

export function preloadSounds(): void {
  for (const name of Object.keys(FILES) as SoundName[]) {
    if (howls.has(name)) continue
    howls.set(
      name,
      new Howl({ src: [FILES[name]], volume: VOLUME[name], preload: true, html5: false }),
    )
  }
}

export function setSoundEnabled(on: boolean): void {
  enabled = on
}

export function play(name: SoundName): void {
  if (!enabled) return
  const howl = howls.get(name)
  if (!howl) return
  try {
    howl.play()
  } catch {
    // Autoplay policy, or audio hardware missing. Never break the round for it.
  }
}

/**
 * Browsers unlock audio only inside a user gesture. Called from the first tap
 * on the attract screen so the round itself is never the first play attempt.
 */
export function unlockAudio(): void {
  preloadSounds()
  const silent = howls.get('tick')
  if (!silent) return
  try {
    const id = silent.play()
    silent.volume(0, id)
    silent.stop(id)
    silent.volume(VOLUME.tick)
  } catch {
    /* unlocking is best-effort */
  }
}
