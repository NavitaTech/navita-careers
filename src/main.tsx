import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/index.css'

/**
 * Kiosk hardening. A booth screen is handled by strangers, so the gestures that
 * would let them leave the game are removed before React mounts.
 */
function hardenForKiosk(): void {
  // Pinch-zoom and double-tap-zoom on iOS, which Safari allows even with
  // user-scalable=no in the viewport meta.
  document.addEventListener('gesturestart', (event) => event.preventDefault())
  let lastTouch = 0
  document.addEventListener(
    'touchend',
    (event) => {
      const now = Date.now()
      if (now - lastTouch <= 320) event.preventDefault()
      lastTouch = now
    },
    { passive: false },
  )
  // Right-click and long-press menus.
  document.addEventListener('contextmenu', (event) => event.preventDefault())
  // Rubber-band scrolling of the page itself; the app never scrolls as a whole.
  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) event.preventDefault()
    },
    { passive: false },
  )
}

hardenForKiosk()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
