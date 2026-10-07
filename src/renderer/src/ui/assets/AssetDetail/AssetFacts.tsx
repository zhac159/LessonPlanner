import { lessonCountLabel } from '@shared/assets/library'
import type { AssetDetail } from '@shared/contracts/assets'
import { TextLink } from '../../atoms/TextLink/TextLink'
import { cx } from '../../atoms/cx'
import { foundInText } from '../internal/format'
import './AssetFacts.css'

export interface AssetFactsProps {
  asset: Pick<AssetDetail, 'foundIn' | 'sourceKind' | 'usedInCount'>
  /** Opens the list of lessons and slides; without it (or at 0) the count is plain text. */
  onOpenUsage?: () => void
  className?: string
}

/** The lilac box: "Found in Y8 Photosynthesis.pptx, slide 1 and 23 other decks" and "Used in 14 lessons". */
export function AssetFacts({ asset, onOpenUsage, className }: AssetFactsProps) {
  const found = foundInText(asset.foundIn, asset.sourceKind)
  const lead = 'Found in '
  return (
    <div className={cx('as-facts', className)}>
      <p>
        {found.startsWith(lead) ? (
          <>
            <strong>Found in</strong> {found.slice(lead.length)}
          </>
        ) : (
          <strong>{found}</strong>
        )}
      </p>
      <p>
        <strong>Used in</strong>{' '}
        {asset.usedInCount > 0 && onOpenUsage ? (
          <TextLink onClick={onOpenUsage}>{lessonCountLabel(asset.usedInCount)}</TextLink>
        ) : (
          lessonCountLabel(asset.usedInCount)
        )}
      </p>
    </div>
  )
}
