import { cx } from '../../atoms'
import { describeFontUse, fallbackFontName, fontWeightName, sampleFontFamily } from './fontText'
import './FontSample.css'

export interface FontSampleProps {
  /** "Lexend". */
  family: string
  /** 400, 700 … */
  weight: number
  /** Which role the font plays in her decks. */
  use: 'title' | 'body' | 'accent'
  /** Typical size in points, or null when unknown. */
  sizeRangePt: readonly [number, number] | null
  /** Whether the app can draw the font offline. When false the sample shows the fallback. */
  available: boolean
  /** CSS font stack from the profile, e.g. "'Lexend', 'Segoe UI', sans-serif". */
  fallbackStack: string
  /** The profile's text colour for the "Aa" (hex). Defaults to ink. */
  textColour?: string
  className?: string
}

/** One learned font: an "Aa" tile in the real family and weight, with its name and usage. */
export function FontSample({
  family,
  weight,
  use,
  sizeRangePt,
  available,
  fallbackStack,
  textColour,
  className
}: FontSampleProps) {
  return (
    <div className={cx('font-sample', className)}>
      <span
        className="font-sample__tile"
        aria-hidden="true"
        style={{
          fontFamily: sampleFontFamily(family, fallbackStack),
          fontWeight: weight,
          color: textColour
        }}
      >
        Aa
      </span>
      <span className="font-sample__text">
        <strong>
          {family} {fontWeightName(weight)}
        </strong>
        <span className="font-sample__use">{describeFontUse(use, sizeRangePt)}</span>
        {!available && (
          <span className="font-sample__missing">
            Not installed — shown in {fallbackFontName(family, fallbackStack)}
          </span>
        )}
      </span>
    </div>
  )
}
