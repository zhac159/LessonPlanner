import { Card, Dropzone, TextLink } from '@ui/atoms'
import { StyleCard } from '@ui/lesson'
import type { StyleSummary } from '@shared/contracts/style-library'
import { STYLE_EXTENSIONS, MAX_STYLE_FILES } from '../model/newLesson'
import { VISIBLE_STYLES } from '../model/styles'
import './StylesCard.css'

export interface StylesCardProps {
  /** `loading` shows two skeleton cards; nothing else is interactive meanwhile. */
  loading: boolean
  /** All styles (for the "Show all" count) and the ones matching the search. */
  styles: ReadonlyArray<StyleSummary>
  matching: ReadonlyArray<StyleSummary>
  /** The search text, for the "No styles match" line. */
  query: string
  /** A draft is being created: the Dropzone shows its busy state. */
  busy: boolean
  onOpen(styleId: string): void
  onManage(): void
  onBrowse(): void
  onFiles(files: File[]): void
}

/** "Your styles": up to three StyleCards, then the Dropzone that starts a new style (03 §3, §7). */
export function StylesCard({
  loading,
  styles,
  matching,
  query,
  busy,
  onOpen,
  onManage,
  onBrowse,
  onFiles
}: StylesCardProps) {
  const shown = matching.slice(0, VISIBLE_STYLES)
  const searching = query.trim().length > 0

  return (
    <Card
      as="section"
      padding={24}
      shadow="lg"
      className="home-styles"
      aria-labelledby="home-styles-title"
    >
      <div className="home-styles__head">
        <h2 id="home-styles-title" className="home-styles__title">
          Your styles
        </h2>
        <TextLink className="home-styles__manage" onClick={onManage}>
          Manage
        </TextLink>
      </div>
      {loading ? (
        <div className="home-styles__skeletons" aria-hidden="true" data-testid="styles-loading">
          <span className="home-styles__skeleton" />
          <span className="home-styles__skeleton" />
        </div>
      ) : (
        <>
          {styles.length === 0 && (
            <p className="home-styles__note">
              Teach me your style first so new lessons look like yours.
            </p>
          )}
          {styles.length > 0 && searching && matching.length === 0 && (
            <p className="home-styles__note">No styles match “{query.trim()}”</p>
          )}
          {shown.map((style) => (
            <StyleCard
              key={style.id}
              name={style.name}
              titleFont={style.titleFont}
              deckCount={style.deckCount}
              swatches={style.swatches}
              isDefault={style.isDefault}
              status={style.status}
              onOpen={() => onOpen(style.id)}
            />
          ))}
          {matching.length > VISIBLE_STYLES && (
            <TextLink className="home-styles__all" onClick={onManage}>
              Show all {matching.length} styles
            </TextLink>
          )}
        </>
      )}
      <Dropzone
        title="Create a new style"
        description={
          <>
            Drop old PDFs or PowerPoints here, or{' '}
            <span className="ui-dropzone__link">browse files</span>
          </>
        }
        meta={`${STYLE_EXTENSIONS.join(' and ')} · up to ${MAX_STYLE_FILES} files`}
        loading={busy}
        loadingLabel="Starting your style…"
        onBrowse={onBrowse}
        onFiles={onFiles}
        className="home-styles__drop"
      />
    </Card>
  )
}
