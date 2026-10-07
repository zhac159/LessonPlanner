import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AssetDetail } from '@shared/contracts/assets'
import { Button } from '../../atoms/Button/Button'
import { Card } from '../../atoms/Card/Card'
import { IconButton } from '../../atoms/IconButton/IconButton'
import { TextArea } from '../../forms/TextArea/TextArea'
import { Thumb } from '../internal/Thumb'
import { AssetFacts } from './AssetFacts'
import { ChatNameField } from './ChatNameField'
import { EditableTitle } from './EditableTitle'
import { CreditLine, SourceLine } from './SourceInfo'
import { TagEditor } from './TagEditor'
import './AssetDetailPanel.css'

export const DESCRIPTION_MAX = 400

export interface AssetDetailPanelProps {
  asset: AssetDetail
  /** The message of the name check (§2.2); the old name stays until a valid one is saved. */
  nameError?: string
  checkingName?: boolean
  /** A polite status line for screen readers ("Saved", "School logo deleted"). */
  status?: string
  onNameDraft?: (draft: string) => void
  onRename: (name: string) => void
  onTitleCommit: (title: string) => void
  onDescriptionCommit: (description: string) => void
  onTagsChange: (tags: string[]) => void
  onUseInLesson: () => void
  /** Why "Use in a lesson" is off ("Make a lesson first"). */
  useDisabledReason?: string
  onReplaceFile: () => void
  onDelete: () => void
  /** The "14 lessons" link: lesson titles and slide numbers. */
  onOpenUsage?: () => void
  /** "Open source page ↗" for pictures found online. */
  onOpenSource?: () => void
}

/** The A1 detail pane: everything about one asset, edited in place. A labelled region with a polite status line. */
export function AssetDetailPanel({
  asset,
  nameError,
  checkingName,
  status,
  onNameDraft,
  onRename,
  onTitleCommit,
  onDescriptionCommit,
  onTagsChange,
  onUseInLesson,
  useDisabledReason,
  onReplaceFile,
  onDelete,
  onOpenUsage,
  onOpenSource
}: AssetDetailPanelProps) {
  const [description, setDescription] = useState(asset.description)
  useEffect(() => setDescription(asset.description), [asset.id, asset.description])

  const { credit, licence, source } = asset
  const provider = credit?.provider ?? (source.kind === 'online' ? source.provider : null)
  const showCredit = credit && (credit.inNotes || licence.requiresCredit)
  const counter =
    description.length >= DESCRIPTION_MAX * 0.9
      ? `${description.length} / ${DESCRIPTION_MAX}`
      : undefined

  return (
    <Card as="section" variant="panel" padding={20} aria-label={asset.title} className="as-detail">
      <EditableTitle value={asset.title} onCommit={onTitleCommit} />
      <Thumb src={asset.previewDataUrl ?? asset.thumbDataUrl} className="as-detail__preview" />
      {(provider || showCredit) && (
        <div className="as-detail__source">
          {provider && (
            <SourceLine
              provider={provider}
              licence={licence}
              onOpenSource={credit?.pageUrl ? onOpenSource : undefined}
            />
          )}
          {showCredit && <CreditLine credit={credit} />}
        </div>
      )}
      <ChatNameField
        value={asset.name}
        error={nameError}
        checking={checkingName}
        onDraftChange={onNameDraft}
        onCommit={onRename}
      />
      <TextArea
        label="What it is (Claude reads this)"
        strongLabel
        rows={3}
        maxLength={DESCRIPTION_MAX}
        value={description}
        hint={counter}
        onChange={(event) => setDescription(event.target.value)}
        onBlur={() => description !== asset.description && onDescriptionCommit(description)}
      />
      <TagEditor tags={asset.tags} onChange={onTagsChange} />
      <AssetFacts asset={asset} onOpenUsage={onOpenUsage} />
      <div className="as-detail__actions">
        <Button
          variant="primary"
          aria-disabled={useDisabledReason ? true : undefined}
          title={useDisabledReason}
          onClick={onUseInLesson}
        >
          Use in a lesson
        </Button>
        <Button variant="secondary" onClick={onReplaceFile}>
          Replace file
        </Button>
        <IconButton aria-label={`Delete ${asset.name}`} variant="square" onClick={onDelete}>
          <Trash2 />
        </IconButton>
      </div>
      <p className="as-sr-only" role="status">
        {status}
      </p>
    </Card>
  )
}
