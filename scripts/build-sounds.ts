/**
 * Synthesises the four UI sounds into public/sounds as 16-bit mono WAV.
 *
 * They are generated rather than sourced so the repo carries no licensed audio
 * and the booth needs no download. Deliberately short and dry: an exhibition
 * hall is loud, so these are confirmation cues, not music. Swap the files for
 * your own at any time - the filenames are the contract.
 *
 * Run: npm run sounds
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, '../public/sounds')
mkdirSync(OUT, { recursive: true })

const RATE = 44100

/** Wraps mono float samples in a 16-bit PCM WAV container. */
function wav(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    data.writeInt16LE(Math.round(clamped * 32767), i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(RATE, 24)
  header.writeUInt32LE(RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

const buffer = (seconds: number) => new Float32Array(Math.ceil(RATE * seconds))

/** Exponential decay envelope with a short fade-in so nothing clicks. */
const envelope = (t: number, duration: number, decay: number): number => {
  const attack = Math.min(1, t / 0.004)
  const release = Math.min(1, (duration - t) / 0.02)
  return attack * Math.max(0, release) * Math.exp(-t * decay)
}

/** Adds a sine partial to the buffer. */
function tone(
  out: Float32Array,
  { freq, start, duration, gain, decay, harmonic = 0.25 }:
  { freq: number; start: number; duration: number; gain: number; decay: number; harmonic?: number },
): void {
  const from = Math.floor(start * RATE)
  const n = Math.floor(duration * RATE)
  for (let i = 0; i < n; i += 1) {
    const index = from + i
    if (index >= out.length) break
    const t = i / RATE
    const phase = 2 * Math.PI * freq * t
    const value = Math.sin(phase) + harmonic * Math.sin(phase * 2)
    out[index] += value * gain * envelope(t, duration, decay)
  }
}

// Equal-tempered pitches used below.
const C5 = 523.25
const E5 = 659.25
const G5 = 783.99
const C6 = 1046.5
const A3 = 220
const As3 = 233.08

// --- pickup: a dry wooden tick, felt more than heard --------------------
const pickup = buffer(0.09)
tone(pickup, { freq: 880, start: 0, duration: 0.05, gain: 0.3, decay: 70, harmonic: 0.5 })
tone(pickup, { freq: 1760, start: 0, duration: 0.03, gain: 0.12, decay: 110, harmonic: 0 })

// --- correct: a bright two-note chime, major third ----------------------
const correct = buffer(0.5)
tone(correct, { freq: E5, start: 0, duration: 0.2, gain: 0.3, decay: 12 })
tone(correct, { freq: C6, start: 0.075, duration: 0.42, gain: 0.26, decay: 8 })
tone(correct, { freq: G5, start: 0.075, duration: 0.42, gain: 0.1, decay: 9 })

// --- wrong: a soft low double-thud, no harshness ------------------------
const wrong = buffer(0.34)
tone(wrong, { freq: As3, start: 0, duration: 0.14, gain: 0.3, decay: 22, harmonic: 0.6 })
tone(wrong, { freq: A3, start: 0.1, duration: 0.22, gain: 0.26, decay: 18, harmonic: 0.5 })

// --- near: between the two - a single mid tone for partial credit -------
const near = buffer(0.3)
tone(near, { freq: C5, start: 0, duration: 0.26, gain: 0.3, decay: 14, harmonic: 0.35 })

// --- finish: a rising arpeggio that lands on the octave -----------------
const finish = buffer(1.1)
tone(finish, { freq: C5, start: 0, duration: 0.3, gain: 0.24, decay: 10 })
tone(finish, { freq: E5, start: 0.11, duration: 0.3, gain: 0.24, decay: 10 })
tone(finish, { freq: G5, start: 0.22, duration: 0.34, gain: 0.24, decay: 9 })
tone(finish, { freq: C6, start: 0.33, duration: 0.74, gain: 0.3, decay: 5 })

// --- tick: last-ten-seconds clock, very quiet ---------------------------
const tick = buffer(0.06)
tone(tick, { freq: 1200, start: 0, duration: 0.035, gain: 0.16, decay: 120, harmonic: 0 })

const files: [string, Float32Array][] = [
  ['pickup', pickup],
  ['correct', correct],
  ['wrong', wrong],
  ['near', near],
  ['finish', finish],
  ['tick', tick],
]

let total = 0
for (const [name, samples] of files) {
  const data = wav(samples)
  writeFileSync(resolve(OUT, `${name}.wav`), data)
  total += data.length
  console.log(`  ${name}.wav  ${(samples.length / RATE).toFixed(2)}s  ${(data.length / 1024).toFixed(0)} KB`)
}
console.log(`${files.length} sounds -> public/sounds (${(total / 1024).toFixed(0)} KB total)`)
