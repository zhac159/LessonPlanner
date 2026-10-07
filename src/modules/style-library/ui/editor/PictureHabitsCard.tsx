import { Check } from 'lucide-react'
import { useId } from 'react'
import { parseAssetTokens } from '@shared/assets/tokens'
import type { AssetChip as AssetChipData } from '@shared/contracts/assets'
import { Card } from '@ui/atoms'
import { AssetChip } from '@ui/assets'
import './picture.css'

export interface PictureHabitsCardProps {
  /** `pictureHabits` of the view: general lines, then one line per placement with `{{name}}` tokens. */
  lines: readonly string[]
  /** `building` = skeleton rows (files still being read), `none` = "No pictures found", `ready` = the lines. */
  state: 'building' | 'none' | 'ready'
  /** Decks the habits come from: fewer than two shows the caption "Based on 1 deck". */
  decks: number
  /** Pictures of the "Assets I found" tiles, so a chip in a line can show its thumbnail. */
  chips?: readonly AssetChipData[]
}

const SKELETON_ROWS = [0, 1, 2]

/** "Picture habits": one tick per line, `{{name}}` drawn as a chip (agents/ASSETS.md §3.6). */
export function PictureHabitsCard({ lines, state, decks, chips = [] }: PictureHabitsCardProps) {
  const headingId = useId()
  const thumbOf = (name: string): string | null =>
    chips.find((chip) => chip.name === name)?.thumbDataUrl ?? null
  return (
    <Card
      as="section"
      variant="inner"
      tone="white"
      className="cs-picture"
      aria-labelledby={headingId}
      aria-busy={state === 'building' || undefined}
    >
      <h3 id={headingId} className="cs-picture__title">
        Picture habits
      </h3>
      {state === 'building' ? (
        <ul className="cs-picture__list" aria-hidden="true">
          {SKELETON_ROWS.map((row) => (
            <li key={row} className="cs-picture__skeleton" />
          ))}
        </ul>
      ) : state === 'none' ? (
        <p className="cs-picture__empty">No pictures found in these files.</p>
      ) : (
        <>
          <ul className="cs-picture__list">
            {lines.map((line, index) => (
              <li key={`${index}-${line}`} className="cs-picture__line">
                <Check size={16} strokeWidth={3} aria-hidden="true" />
                <span>
                  {parseAssetTokens(line).map((segment, i) =>
                    segment.type === 'asset' ? (
                      <AssetChip key={i} name={segment.name} thumbSrc={thumbOf(segment.name)} />
                    ) : (
                      <span key={i}>{segment.text}</span>
                    )
                  )}
                </span>
              </li>
            ))}
          </ul>
          {decks < 2 && (
            <p className="cs-picture__caption">Based on 1 deck. More decks make this surer.</p>
          )}
        </>
      )}
    </Card>
  )
}
