import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../cx'
import './CardHeaderBand.css'

export type BandTone = 'yellow' | 'peach' | 'sky' | 'mint' | 'butter' | 'purple'

export interface CardHeaderBandProps {
  /** Fill. yellow = the planning buddy, otherwise a plugin's tone. */
  tone?: BandTone
  /** Leading element: a disc, a back IconButton. */
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** Trailing element: a hint, an icon tile. */
  trailing?: ReactNode
  /** Heading level of the title (2 by default). */
  level?: 2 | 3 | 4
  /** CSS padding, e.g. "16px 22px" for Create a style. Default "16px 18px". */
  padding?: string
  className?: string
}

/** The coloured band across the top of a panel or page card, ended by a 2px ink rule. */
export function CardHeaderBand({
  tone = 'yellow',
  leading,
  title,
  subtitle,
  trailing,
  level = 2,
  padding,
  className
}: CardHeaderBandProps) {
  const Heading = `h${level}` as 'h2'
  const style = padding ? ({ '--band-pad': padding } as CSSProperties) : undefined
  return (
    <div className={cx('ui-band', className)} data-tone={tone} style={style}>
      {leading}
      <div className="ui-band__text">
        <Heading className="ui-band__title">{title}</Heading>
        {subtitle && <p className="ui-band__subtitle">{subtitle}</p>}
      </div>
      {trailing && <div className="ui-band__trailing">{trailing}</div>}
    </div>
  )
}
