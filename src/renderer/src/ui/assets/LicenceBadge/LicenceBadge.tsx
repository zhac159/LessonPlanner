import type { AssetLicence, LicenceId } from '@shared/assets/types'
import { cx } from '../../atoms/cx'
import './LicenceBadge.css'

export type LicenceTone = 'green' | 'blue' | 'amber' | 'neutral'

const TONES: Partial<Record<LicenceId, LicenceTone>> = {
  cc0: 'green',
  'public-domain': 'green',
  'cc-by': 'blue',
  'cc-by-sa': 'blue',
  pexels: 'blue',
  unsplash: 'blue',
  'cc-by-nc': 'amber',
  'cc-by-nc-sa': 'amber',
  'cc-by-nc-nd': 'amber',
  'cc-by-nd': 'amber',
  other: 'amber'
}

/** Green = no credit needed, blue = credit needed, amber = check before sharing, neutral = hers or made for her. */
export const licenceTone = (id: LicenceId): LicenceTone => TONES[id] ?? 'neutral'

export interface LicenceBadgeProps {
  licence: Pick<AssetLicence, 'id' | 'label'>
  /** Show the licence's own label even on amber ("CC BY-NC 4.0" instead of "Check licence"). */
  exact?: boolean
  className?: string
}

/** A small pill with the licence: green for CC0 and public domain, blue for CC BY and BY-SA, amber "Check licence". */
export function LicenceBadge({ licence, exact = false, className }: LicenceBadgeProps) {
  const tone = licenceTone(licence.id)
  const amber = tone === 'amber' && !exact
  return (
    <span
      className={cx('as-licence', className)}
      data-tone={tone}
      title={amber ? licence.label : undefined}
    >
      {amber ? 'Check licence' : licence.label}
    </span>
  )
}
