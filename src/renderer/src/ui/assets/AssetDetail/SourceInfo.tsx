import { ExternalLink } from 'lucide-react'
import type { AssetCredit, AssetLicence, OnlineProvider } from '@shared/assets/types'
import { TextLink } from '../../atoms/TextLink/TextLink'
import { cx } from '../../atoms/cx'
import { LicenceBadge } from '../LicenceBadge/LicenceBadge'
import './SourceInfo.css'

export const PROVIDER_LABELS: Readonly<Record<OnlineProvider, string>> = {
  openverse: 'Openverse',
  wikimedia: 'Wikimedia Commons',
  pexels: 'Pexels',
  unsplash: 'Unsplash'
}

export interface SourceLineProps {
  provider: OnlineProvider | null
  licence: Pick<AssetLicence, 'id' | 'label'>
  /** "Open source page ↗": opens the page in the default browser. */
  onOpenSource?: () => void
  className?: string
}

/** "Wikimedia Commons  [CC BY-SA 4.0]  Open source page ↗" in the detail pane of a picture found online. */
export function SourceLine({ provider, licence, onOpenSource, className }: SourceLineProps) {
  return (
    <p className={cx('as-source', className)}>
      {provider && <strong>{PROVIDER_LABELS[provider]}</strong>}
      <LicenceBadge licence={licence} exact />
      {onOpenSource && (
        <TextLink onClick={onOpenSource} className="as-source__link">
          Open source page
          <ExternalLink size={12} aria-hidden="true" />
        </TextLink>
      )}
    </p>
  )
}

export interface CreditLineProps {
  credit: Pick<AssetCredit, 'text' | 'inNotes'>
  className?: string
}

/** The credit text, read-only, with what happens to it ("added to the speaker notes"). */
export function CreditLine({ credit, className }: CreditLineProps) {
  return (
    <div className={cx('as-credit', className)}>
      <p className="as-credit__label">Credit</p>
      <p className="as-credit__text" data-testid="credit-text">
        {credit.text}
      </p>
      {credit.inNotes && (
        <p className="as-credit__note">Added to the speaker notes of slides that use it.</p>
      )}
    </div>
  )
}
