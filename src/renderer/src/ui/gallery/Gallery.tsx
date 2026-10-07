import { useId } from 'react'
import { slugify, type GalleryGroup } from './galleryModel'
import './Gallery.css'

export interface GalleryProps {
  groups: ReadonlyArray<GalleryGroup>
  /** Group titles that could not be loaded; shown so a broken gallery is noticed. */
  skipped?: ReadonlyArray<string>
}

/**
 * Every UI-kit component in every state, grouped by area, with a jump list. It is how we check
 * the kit against the mockups side by side and how a11y and contrast get reviewed.
 */
export function Gallery({ groups, skipped = [] }: GalleryProps) {
  const prefix = useId()
  const idOf = (title: string): string => `${prefix}-${slugify(title)}`
  const jump = (title: string): void => {
    document.getElementById(idOf(title))?.scrollIntoView?.({ block: 'start' })
  }

  return (
    <div className="ui-gallery" data-testid="ui-gallery">
      <header className="ui-gallery__header">
        <p className="eyebrow">Developer tool</p>
        <h1>UI gallery</h1>
        <p className="ui-gallery__lede">
          Every component in every state. Compare it with design/images and tab through it.
        </p>
        <nav aria-label="Gallery areas" className="ui-gallery__jump">
          {groups.map((group) => (
            <button key={group.title} type="button" onClick={() => jump(group.title)}>
              {group.title}
            </button>
          ))}
        </nav>
      </header>

      {skipped.length > 0 && (
        <p role="alert" className="ui-gallery__skipped">
          Could not load: {skipped.join(', ')}
        </p>
      )}

      {groups.length === 0 && <p>No galleries found.</p>}

      {groups.map((group) => (
        <section key={group.title} id={idOf(group.title)} aria-label={group.title}>
          <h2 className="ui-gallery__group">{group.title}</h2>
          {group.sections.map((section) => (
            <article key={section.name} className="ui-gallery__section">
              <h3>{section.name}</h3>
              <div className="ui-gallery__stage">{section.render()}</div>
            </article>
          ))}
        </section>
      ))}
    </div>
  )
}
