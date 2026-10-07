import { useId } from 'react'
import type { StyleProfileView } from '@shared/contracts/style-library'
import { Button, Card, StatusPill } from '@ui/atoms'
import { AssetTile } from '@ui/assets'
import './picture.css'

export type AssetsFound = NonNullable<StyleProfileView['assetsFound']>

export interface AssetsFoundCardProps {
  found: AssetsFound
  /** "Review assets": opens the Assets review with this style's batch. */
  onReview: () => void
  /** "Open Assets": once she has kept some, the library. */
  onOpenAssets: () => void
}

/** "Assets I found": count pill, the dark "Review assets" button and six tiles (agents/ASSETS.md §3.6). Hidden when nothing was found. */
export function AssetsFoundCard({ found, onReview, onOpenAssets }: AssetsFoundCardProps) {
  const headingId = useId()
  const saved = found.saved > 0
  const nothingToReview = !saved && found.batchId === null
  return (
    <Card
      as="section"
      variant="inner"
      tone="white"
      className="cs-picture"
      aria-labelledby={headingId}
    >
      <div className="cs-picture__head">
        <h3 id={headingId} className="cs-picture__title">
          Assets I found
        </h3>
        <StatusPill tone={saved ? 'done' : 'neutral'} size="md">
          {saved
            ? `${found.saved} saved to Your assets`
            : `${found.found} found · ${found.suggested} suggested`}
        </StatusPill>
        <Button
          variant="dark"
          size="sm"
          className="cs-picture__action"
          aria-disabled={nothingToReview || undefined}
          onClick={nothingToReview ? undefined : saved ? onOpenAssets : onReview}
        >
          {saved ? 'Open Assets' : 'Review assets'}
        </Button>
      </div>
      <p className="cs-picture__lead">
        Logos, icons and pictures you reuse across your decks. Check them and they’ll be saved to
        Your assets, ready for any lesson.
      </p>
      {found.preview.length > 0 && (
        <ul className="cs-picture__tiles">
          {found.preview.slice(0, 6).map((chip) => (
            <li key={chip.assetId}>
              <AssetTile
                name={chip.name}
                thumbSrc={chip.thumbDataUrl}
                onClick={saved ? onOpenAssets : onReview}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
