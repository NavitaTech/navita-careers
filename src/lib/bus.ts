/**
 * Cross-window channel for the spectator screen.
 *
 * The booth runs two displays: the kiosk a student plays on, and a big screen
 * behind it mirroring the round and the leaderboard. A crowd watching the big
 * screen is the queue. BroadcastChannel keeps them in step with no server.
 */
export type BusMessage =
  | { type: 'state'; screen: string; playerName: string }
  | { type: 'tick'; score: number; secondsLeft: number; cardsLeft: number; streak: number }
  | { type: 'placed'; cityId: string; universityId: string; verdict: string }
  | { type: 'round-start'; playerName: string; total: number }
  | { type: 'round-end'; score: number; playerName: string; fullClear: boolean }
  | { type: 'scores-changed' }

const CHANNEL = 'uk-campus-drop'

let channel: BroadcastChannel | null = null

function get(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  channel ??= new BroadcastChannel(CHANNEL)
  return channel
}

export function publish(message: BusMessage): void {
  try {
    get()?.postMessage(message)
  } catch {
    // Older WebViews lack BroadcastChannel; the kiosk works without a
    // spectator screen, so this stays silent.
  }
}

export function subscribe(handler: (message: BusMessage) => void): () => void {
  const bus = get()
  if (!bus) return () => {}
  const listener = (event: MessageEvent<BusMessage>) => handler(event.data)
  bus.addEventListener('message', listener)
  return () => bus.removeEventListener('message', listener)
}
