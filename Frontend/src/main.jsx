import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Lenis from 'lenis'
import './index.css'
import App from './App.jsx'

// ── Lenis smooth scroll ──────────────────────────────────────────────────────
const lenis = new Lenis({
  duration: 1.4,          // seconds — higher = more latency/momentum
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo easing
  orientation: 'vertical',
  smoothWheel: true,
  touchMultiplier: 2,
})

function raf(time) {
  lenis.raf(time)
  requestAnimationFrame(raf)
}
requestAnimationFrame(raf)

// Expose lenis so components can use lenis.scrollTo() if needed
window.__lenis = lenis
// ────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

