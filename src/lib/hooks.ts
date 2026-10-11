import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Returns the booth to the attract screen after a period with no touch.
 *
 * Deliberately listens on the window in the capture phase: a student who walks
 * away mid-round leaves a half-finished game on screen, and that is exactly the
 * case the reset exists for.
 */
export function useIdleReset(seconds: number, onIdle: () => void, active: boolean): void {
  // The latest callback is kept in a ref so changing it does not restart the
  // timer. Assigned in an effect rather than during render, which React 19
  // treats as a side effect.
  const callback = useRef(onIdle)
  useEffect(() => {
    callback.current = onIdle
  })

  useEffect(() => {
    if (!active || seconds <= 0) return
    let timer = window.setTimeout(() => callback.current(), seconds * 1000)
    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => callback.current(), seconds * 1000)
    }
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'pointermove', 'keydown', 'wheel']
    for (const event of events) window.addEventListener(event, reset, { passive: true, capture: true })
    return () => {
      window.clearTimeout(timer)
      for (const event of events) window.removeEventListener(event, reset, { capture: true })
    }
  }, [seconds, active])
}

/**
 * A countdown that stays smooth without re-rendering sixty times a second: the
 * fractional value drives the progress ring through a ref, while React only
 * sees whole seconds.
 */
export function useCountdown(
  totalSeconds: number,
  running: boolean,
  onComplete: () => void,
): { secondsLeft: number; elapsed: () => number } {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds)
  const startedAt = useRef<number>(0)
  const finished = useRef(false)
  const complete = useRef(onComplete)
  useEffect(() => {
    complete.current = onComplete
  })

  useEffect(() => {
    if (!running) return
    startedAt.current = performance.now()
    finished.current = false
    setSecondsLeft(totalSeconds)

    let frame = 0
    const step = () => {
      const elapsed = (performance.now() - startedAt.current) / 1000
      const left = Math.max(0, totalSeconds - elapsed)
      setSecondsLeft((previous) => {
        const next = Math.ceil(left)
        return next === previous ? previous : next
      })
      if (left <= 0) {
        if (!finished.current) {
          finished.current = true
          complete.current()
        }
        return
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [running, totalSeconds])

  const elapsed = useCallback(
    () => (startedAt.current ? (performance.now() - startedAt.current) / 1000 : 0),
    [],
  )

  return { secondsLeft, elapsed }
}

/**
 * Long-press detection for the hidden admin entrance. Three seconds on the
 * company logo, which no student does by accident and no staff member has to
 * remember a gesture for.
 */
export function useLongPress(onLongPress: () => void, ms = 3000) {
  const timer = useRef<number | null>(null)
  const [progress, setProgress] = useState(0)

  const stop = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current)
      timer.current = null
    }
    setProgress(0)
  }, [])

  const start = useCallback(() => {
    if (timer.current !== null) return
    const began = performance.now()
    timer.current = window.setInterval(() => {
      const ratio = (performance.now() - began) / ms
      if (ratio >= 1) {
        stop()
        onLongPress()
      } else {
        setProgress(ratio)
      }
    }, 50)
  }, [ms, onLongPress, stop])

  return {
    progress,
    handlers: {
      onPointerDown: start,
      onPointerUp: stop,
      onPointerLeave: stop,
      onPointerCancel: stop,
    },
  }
}

/** True when the viewer asked their system to reduce motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])
  return reduced
}

/** Tracks an element's size, which the map needs to convert touches to map units. */
export function useElementRect<T extends Element>(): [React.RefObject<T | null>, DOMRect | null] {
  const ref = useRef<T | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setRect(element.getBoundingClientRect())
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    window.addEventListener('scroll', update, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', update, true)
    }
  }, [])

  return [ref, rect]
}

/**
 * Keeps the screen awake while the booth is running. Dropped by the browser on
 * every visibility change, so it is re-acquired rather than requested once.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch {
        // Denied on battery saver, or unsupported. The booth stays plugged in.
      }
    }
    void acquire()

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !cancelled) void acquire()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release().catch(() => {})
    }
  }, [active])
}
