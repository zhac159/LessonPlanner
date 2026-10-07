/** Eight grey placeholder cards while the lessons load (03 §7): cover and two bars. */
export function LessonSkeletons({ count = 8 }: { count?: number }) {
  return (
    <ul className="home-grid" aria-hidden="true" data-testid="lessons-loading">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="home-skeleton">
          <span className="home-skeleton__cover" />
          <span className="home-skeleton__bar" />
          <span className="home-skeleton__bar home-skeleton__bar--short" />
        </li>
      ))}
    </ul>
  )
}
