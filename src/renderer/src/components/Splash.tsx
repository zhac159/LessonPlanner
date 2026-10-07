import { useEffect, useState, type CSSProperties } from 'react'
import { useShell } from '../core/ShellContext'
import './Splash.css'

const SPLASH_MS = 3200
const SPLASH_REDUCED_MS = 1200
const EXIT_MS = 600
/** Ignore skip input for the first moments, so a stray keypress at launch doesn't cut the intro. */
const SKIP_GRACE_MS = 800

interface SplashProps {
  /** True once the app's modules have loaded. The splash never exits before this. */
  ready: boolean
  /** Fired when the splash starts fading out (the shell should start fading in). */
  onExitStart: () => void
  /** Fired when the exit animation has finished and the splash can be removed. */
  onDone: () => void
}

/**
 * The "Welcome Alice" intro. It plays for a fixed time (or until the user clicks / presses a key),
 * waits for the app to be ready, then fades out into the shell. Before the user has told the app
 * their name it simply says "Welcome".
 */
export function Splash({ ready, onExitStart, onDone }: SplashProps) {
  const name = useShell().user?.name.trim() || null
  const [reducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const [played, setPlayed] = useState(false)
  const [exiting, setExiting] = useState(false)
  const durationMs = reducedMotion ? SPLASH_REDUCED_MS : SPLASH_MS

  // The intro has played once its duration elapses, or when the user skips it.
  useEffect(() => {
    const timer = setTimeout(() => setPlayed(true), durationMs)
    const mountedAt = performance.now()
    const skip = (): void => {
      if (performance.now() - mountedAt >= SKIP_GRACE_MS) setPlayed(true)
    }
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [durationMs])

  // Fade out as soon as the intro has played and the app is ready.
  useEffect(() => {
    if (played && ready && !exiting) {
      setExiting(true)
      onExitStart()
    }
  }, [played, ready, exiting, onExitStart])

  useEffect(() => {
    if (!exiting) return
    const timer = setTimeout(onDone, EXIT_MS)
    return () => clearTimeout(timer)
  }, [exiting, onDone])

  // With a name: small "Welcome" over the big name. Without: the big word is "Welcome" itself.
  const headline = Array.from(name ?? 'Welcome')

  return (
    <div
      className="splash"
      data-testid="splash"
      data-exiting={exiting}
      role="status"
      aria-live="polite"
      style={{ '--splash-ms': `${durationMs}ms`, '--exit-ms': `${EXIT_MS}ms` } as CSSProperties}
    >
      <div className="splash__shapes" aria-hidden="true">
        <span className="splash__shape splash__shape--1" />
        <span className="splash__shape splash__shape--2" />
        <span className="splash__shape splash__shape--3" />
      </div>

      <div className="splash__content">
        {name && (
          <p className="splash__welcome" aria-hidden="true">
            Welcome
          </p>
        )}
        <h1
          className="splash__name"
          data-testid="splash-name"
          data-greeting={name ? undefined : 'true'}
          aria-hidden="true"
        >
          {headline.map((letter, index) => (
            <span key={index} className="splash__letter" style={{ '--i': index } as CSSProperties}>
              {letter}
            </span>
          ))}
        </h1>
        <span className="splash__rule" aria-hidden="true" />
        <p className="splash__status" aria-hidden="true">
          Getting your lessons ready…
        </p>
      </div>

      <div className="splash__progress" aria-hidden="true">
        <span />
      </div>

      <span className="sr-only">{name ? `Welcome ${name}` : 'Welcome'}</span>
    </div>
  )
}
