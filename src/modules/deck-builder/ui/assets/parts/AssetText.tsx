import { Fragment, type ReactNode } from 'react'
import { parseAssetTokens } from '@shared/assets/tokens'
import { AssetChip } from '@ui/assets'
import type { AssetChip as AssetChipData } from '@shared/contracts/assets'

/**
 * Draws a run of message text with its `{{name}}` tokens as chips (A5). A name the library does not know stays as typed;
 * an asset that was deleted shows a greyed "removed" chip; a renamed one shows its current name.
 */
export function renderAssetText(
  text: string,
  chips: ReadonlyMap<string, AssetChipData>
): ReactNode {
  const parts = parseAssetTokens(text)
  if (parts.every((part) => part.type === 'text')) return text
  return parts.map((part, i) => {
    if (part.type === 'text') return <Fragment key={i}>{part.text}</Fragment>
    const chip = chips.get(part.name)
    if (!chip) return <Fragment key={i}>{part.raw}</Fragment>
    return (
      <AssetChip
        key={i}
        name={chip.name}
        kind={chip.kind}
        thumbSrc={chip.thumbDataUrl}
        variant={chip.removed ? 'removed' : 'inline'}
      />
    )
  })
}
