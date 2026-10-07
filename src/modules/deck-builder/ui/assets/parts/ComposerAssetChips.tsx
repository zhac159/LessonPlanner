import { AssetChip } from '@ui/assets'
import type { AssetChip as AssetChipData } from '@shared/contracts/assets'

export interface ComposerAssetChipsProps {
  /** The chips of the names in the draft, in order of first use. */
  chips: readonly AssetChipData[]
  /** Backspace or × on a chip takes its `{{name}}` out of the draft. */
  onRemove(name: string): void
}

/** The removable chips of the assets named in the draft (A5), shown with the staged items above the box. */
export function ComposerAssetChips({ chips, onRemove }: ComposerAssetChipsProps) {
  return (
    <>
      {chips.map((chip) => (
        <AssetChip
          key={chip.assetId}
          variant="composer"
          name={chip.name}
          kind={chip.kind}
          thumbSrc={chip.thumbDataUrl}
          onRemove={() => onRemove(chip.name)}
        />
      ))}
    </>
  )
}
