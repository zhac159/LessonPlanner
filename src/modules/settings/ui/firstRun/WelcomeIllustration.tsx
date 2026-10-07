import './welcome.css'

/**
 * Decorative: two tilted slide cards and a hand-drawn orange loop. The sample slide uses its own
 * colours on purpose (slides never use the app's palette; design/screens/01-welcome.md §3).
 */
export function WelcomeIllustration() {
  return (
    <div className="welcome-art" aria-hidden="true">
      <div className="welcome-art__card welcome-art__card--back" />
      <div className="welcome-art__card welcome-art__card--front">
        <span className="welcome-art__bar" />
        <span className="welcome-art__kicker">Lesson 3 · Photosynthesis</span>
        <span className="welcome-art__title">
          What do plants need to <span className="welcome-art__accent">make food?</span>
        </span>
        <span className="welcome-art__line welcome-art__line--long" />
        <span className="welcome-art__line welcome-art__line--short" />
        <span className="welcome-art__highlight" />
      </div>
      <svg className="welcome-art__loop" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d="M52 4 C82 3 98 24 97 51 C96 80 74 97 47 96 C19 95 3 77 4 48 C5 21 25 5 58 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}
