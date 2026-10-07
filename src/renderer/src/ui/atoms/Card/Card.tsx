import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx'
import './Card.css'

export type CardVariant = 'page' | 'panel' | 'raised' | 'selected' | 'inner'
export type CardShadow = 'none' | 'sm' | 'md' | 'lg'

/** Radius and shadow each variant stands for (design-system §7 Card). */
const VARIANT_SHADOW: Record<CardVariant, CardShadow> = {
  page: 'lg',
  panel: 'lg',
  raised: 'md',
  selected: 'sm',
  inner: 'none'
}

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** page = 24px radius, panel = 22, raised = 18, selected = 14, inner = 16 and flat. */
  variant?: CardVariant
  /** Overrides the variant's shadow. */
  shadow?: CardShadow
  /** accent = orange (one per screen), sunken = ground, style = teal. */
  tone?: 'white' | 'accent' | 'sunken' | 'style'
  /** Padding in px. 0 clips children (header bands) to the rounded corners. */
  padding?: number
  /** The element to render: `section`, `article`, `li`… */
  as?: ElementType
  children: ReactNode
}

/** White surface with an ink outline and a hard offset shadow. */
export function Card({
  variant = 'page',
  shadow,
  tone = 'white',
  padding,
  as: Tag = 'div',
  className,
  style,
  children,
  ...rest
}: CardProps) {
  const css =
    padding === undefined ? style : ({ '--card-pad': `${padding}px`, ...style } as CSSProperties)
  return (
    <Tag
      {...rest}
      className={cx('ui-card', className)}
      data-variant={variant}
      data-shadow={shadow ?? VARIANT_SHADOW[variant]}
      data-tone={tone}
      data-flush={padding === 0 || undefined}
      style={css}
    >
      {children}
    </Tag>
  )
}
