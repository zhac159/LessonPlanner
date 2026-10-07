import { ExternalLink } from 'lucide-react'
import { isFreeToUse } from '@shared/assets/credits'
import type { AssetLicence } from '@shared/assets/types'
import { Button } from '../../atoms/Button/Button'
import { Callout } from '../../atoms/Callout/Callout'
import { Card } from '../../atoms/Card/Card'
import { TextField } from '../../forms/TextField/TextField'
import { LicenceBadge } from '../LicenceBadge/LicenceBadge'
import { Thumb } from '../internal/Thumb'
import './OnlineDetail.css'

/** What the licence means for her: a credit goes into the notes, no credit needed, or check first. */
export function licenceNotice(licence: Pick<AssetLicence, 'id' | 'requiresCredit'>): {
  variant: 'info' | 'warning'
  text: string
} {
  if (!isFreeToUse(licence)) {
    return {
      variant: 'warning',
      text: "This licence doesn't cover every use. Check it before you share your slides."
    }
  }
  return licence.requiresCredit
    ? {
        variant: 'info',
        text: "This one needs a credit. I'll add it to the speaker notes of any slide that uses it."
      }
    : { variant: 'info', text: 'No credit needed for this one.' }
}

export interface OnlineDetailProps {
  title: string
  providerLabel: string
  licence: AssetLicence
  width?: number | null
  height?: number | null
  /** The bigger preview if main fetched one; otherwise the thumbnail. */
  previewSrc?: string | null
  /** "Name in chat": the proposed name, editable. */
  name: string
  onNameChange: (name: string) => void
  nameError?: string
  onAdd: () => void
  adding?: boolean
  onOpenSource: () => void
  className?: string
}

/** The A9 detail pane: preview, source, licence, size, the credit notice, the name and the two buttons. */
export function OnlineDetail({
  title,
  providerLabel,
  licence,
  width,
  height,
  previewSrc,
  name,
  onNameChange,
  nameError,
  onAdd,
  adding = false,
  onOpenSource,
  className
}: OnlineDetailProps) {
  const notice = licenceNotice(licence)
  return (
    <Card as="section" variant="panel" padding={20} aria-label={title} className={className}>
      <div className="as-online-detail">
        <h2 className="as-online-detail__title">{title}</h2>
        <Thumb src={previewSrc} className="as-online-detail__preview" />
        <p className="as-online-detail__facts">
          <strong>{providerLabel}</strong>
          <LicenceBadge licence={licence} exact />
          {width && height ? <span>{`${width} × ${height}`}</span> : null}
        </p>
        <Callout variant={notice.variant}>{notice.text}</Callout>
        <TextField
          label="Name in chat"
          strongLabel
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          error={nameError}
          className="as-online-detail__name"
          spellCheck={false}
        />
        <div className="as-online-detail__actions">
          <Button variant="primary" shape="rect" loading={adding} onClick={onAdd}>
            Add to Your assets
          </Button>
          <Button variant="secondary" iconAfter={<ExternalLink />} onClick={onOpenSource}>
            Open source page
          </Button>
        </div>
      </div>
    </Card>
  )
}
