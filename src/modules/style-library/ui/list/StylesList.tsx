import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useShell } from '@renderer/sdk'
import type { StyleSummary } from '@shared/contracts/style-library'
import { Button, Callout, Card, Dropzone, IconButton } from '@ui/atoms'
import { PageHeader } from '@ui/chrome'
import { StyleCard } from '@ui/lesson'
import { ConfirmDialog } from '@ui/overlays'
import { STYLE_FILE_EXTENSIONS } from '../../shared'
import { useFileActions } from '../hooks/useFileActions'
import { useStyleList } from '../hooks/useStyleList'
import './list.css'

export interface StylesListProps {
  /** Open the editor: a new empty draft, a draft made from dropped files, or an existing style. */
  onNew: () => void
  onOpenDraft: (styleId: string) => void
  onEdit: (style: StyleSummary) => void
}

const noReload = async (): Promise<void> => {}

/**
 * The Styles page: every style with edit, set-default and delete, plus a drop target for a new one.
 * The design only draws Create a style, so this is the minimal interim list (04 §2).
 */
export function StylesList({ onNew, onOpenDraft, onEdit }: StylesListProps) {
  const { navigate } = useShell()
  const { styles, error, setDefault, remove } = useStyleList()
  const [pending, setPending] = useState<StyleSummary | null>(null)
  const files = useFileActions({ styleId: null, onCreated: onOpenDraft, reload: noReload })

  return (
    <div className="styles-page">
      <PageHeader
        variant="bar"
        title="Styles"
        back={{ label: 'Home', onClick: () => navigate('home') }}
        actions={
          <Button variant="primary" icon={<Plus strokeWidth={2.6} />} onClick={onNew}>
            Create a new style…
          </Button>
        }
      />
      <div className="styles-page__body">
        <Card as="section" shadow="lg" className="styles-page__card" aria-labelledby="styles-title">
          <h2 id="styles-title" className="styles-page__title">
            Your styles
          </h2>
          {error && <Callout variant="error">{error}</Callout>}
          {styles === null && !error && <p className="styles-page__note">Loading your styles…</p>}
          {styles && (
            <ul className="styles-page__list">
              {styles.map((style) => (
                <li key={style.id} className="styles-page__row">
                  <StyleCard
                    className="styles-page__style"
                    name={style.name}
                    titleFont={style.titleFont}
                    deckCount={style.deckCount}
                    swatches={style.swatches}
                    isDefault={style.isDefault}
                    status={style.learning ? 'learning' : style.status}
                    onOpen={() => onEdit(style)}
                    onEdit={() => onEdit(style)}
                    onSetDefault={style.isDefault ? undefined : () => void setDefault(style)}
                  />
                  <IconButton
                    variant="ghost"
                    aria-label={`Delete ${style.name}`}
                    onClick={() => setPending(style)}
                  >
                    <Trash2 size={18} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <Dropzone
            variant="large"
            title="Create a new style"
            description={
              <>
                Drop decks here, or <span className="ui-dropzone__link">browse files</span>
              </>
            }
            meta=".pdf and .pptx · up to 50 files"
            accept={STYLE_FILE_EXTENSIONS}
            onFiles={(dropped) => void files.addDropped(dropped)}
            onRejected={(rejected) => files.skip(rejected.length)}
            onBrowse={() => void files.browse()}
            loading={files.adding > 0}
            loadingLabel={`Adding ${files.adding} ${files.adding === 1 ? 'file' : 'files'}…`}
          />
        </Card>
      </div>
      <ConfirmDialog
        open={pending !== null}
        title={`Delete “${pending?.name ?? ''}”?`}
        message="The style and the copies of its files kept on this computer will be removed."
        confirmLabel="Delete style"
        destructive
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const style = pending
          setPending(null)
          if (style) void remove(style)
        }}
      />
    </div>
  )
}
