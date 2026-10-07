import { ArrowRight, Inbox } from 'lucide-react'
import type { AssetPage } from '@shared/contracts/assets'
import { Button, Callout } from '@ui/atoms'

export interface PendingBannerProps {
  pending: NonNullable<AssetPage['pendingReview']>
  onReview(): void
}

/** "12 assets found while learning your Science KS3 style": nothing is added until she reviews it. */
export function PendingBanner({ pending, onReview }: PendingBannerProps) {
  if (pending.found <= 0) return null
  const where = pending.styleName ? ` while learning your ${pending.styleName} style` : ''
  const noun = pending.found === 1 ? 'asset' : 'assets'
  return (
    <Callout
      variant="action"
      className="as-banner"
      icon={
        <span className="as-banner__icon" aria-hidden="true">
          <Inbox size={22} />
        </span>
      }
      title={`${pending.found} ${noun} found${where}`}
      action={
        <Button variant="dark" iconAfter={<ArrowRight strokeWidth={2.4} />} onClick={onReview}>
          {`Review ${pending.found}`}
        </Button>
      }
    >
      Check them before they go into your library. Nothing is added until you say so.
    </Callout>
  )
}
