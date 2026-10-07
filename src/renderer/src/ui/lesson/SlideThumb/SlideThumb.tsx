import type { ComponentPropsWithRef, KeyboardEvent, MouseEvent } from 'react'
import type { Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { cx } from '../../atoms/cx'
import { anchorBelow, type Point } from '../../overlays/ContextMenu/position'
import { SlideView, type SlideViewProps } from '../../slide'
import { anchorForContextMenu } from '../menuAnchor'
import { slideLabel } from '../slideLabel'
import './SlideThumb.css'

/** Width of a filmstrip thumbnail (design-system SlideThumb). */
export const THUMB_WIDTH = 132
/** Slide scale for a filmstrip preview: its content box is the width minus the 2px borders. */
const THUMB_SCALE = (THUMB_WIDTH - 4) / 1920

export interface SlideThumbProps extends Omit<
  ComponentPropsWithRef<'button'>,
  'children' | 'style' | 'onSelect' | 'aria-current' | 'aria-label'
> {
  /** The slide to draw. Omit for the `placeholder` and `generating` variants. */
  slide?: Slide
  /** The deck's StyleProfile (`null` = plain default style). */
  styleProfile: StyleProfile | null
  /** 1-based position, shown in the badge and in the accessible name. */
  number?: number
  /**
   * filmstrip = button with a number badge, card = bare preview that fills a LessonCard,
   * placeholder = dashed empty slot, generating = placeholder that pulses.
   */
  variant?: 'filmstrip' | 'card' | 'placeholder' | 'generating'
  /** The slide on the stage: accent shadow, orange badge, `aria-current`. */
  selected?: boolean
  /** Being dragged to a new place. */
  dragging?: boolean
  /** Fade and scale in (a streamed slide replacing its placeholder). */
  reveal?: boolean
  /** Click, Enter or Space. */
  onSelect?: () => void
  /** Right-click, Shift+F10 or the menu key: where to open the context menu. */
  onMenu?: (anchor: Point) => void
  resolveAsset?: SlideViewProps['resolveAsset']
  /** `thumbnail` draws a picture spot as a faint dashed box (filmstrip); default hidden. */
  spots?: SlideViewProps['spots']
}

/**
 * A slide drawn small. The `filmstrip` variant is a button (`aria-label="Slide 3: What do plants need?"`);
 * the other variants are plain, non-interactive boxes.
 */
export function SlideThumb({
  slide,
  styleProfile,
  number = 1,
  variant = 'filmstrip',
  selected = false,
  dragging = false,
  reveal = false,
  onSelect,
  onMenu,
  resolveAsset,
  spots,
  className,
  onClick,
  onKeyDown,
  type = 'button',
  ...rest
}: SlideThumbProps) {
  if (variant === 'placeholder' || variant === 'generating' || !slide) {
    return (
      <div
        className={cx('slide-thumb', className)}
        data-variant={variant === 'generating' ? 'generating' : 'placeholder'}
        aria-hidden="true"
      >
        <div className="slide-thumb__preview" />
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className={cx('slide-thumb', className)} data-variant="card">
        <div className="slide-thumb__preview">
          <SlideView slide={slide} style={styleProfile} resolveAsset={resolveAsset} spots={spots} />
        </div>
      </div>
    )
  }

  const openMenu = (event: MouseEvent<HTMLButtonElement>): void => {
    if (!onMenu) return
    event.preventDefault()
    onMenu(anchorForContextMenu(event, event.currentTarget))
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    onKeyDown?.(event)
    if (event.defaultPrevented || !onMenu) return
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault()
      onMenu(anchorBelow(event.currentTarget))
    }
  }

  return (
    <button
      {...rest}
      type={type}
      className={cx('slide-thumb', className)}
      data-variant="filmstrip"
      data-selected={selected || undefined}
      data-dragging={dragging || undefined}
      data-reveal={reveal || undefined}
      data-slide-id={slide.id}
      aria-label={slideLabel(slide, number)}
      aria-current={selected ? 'true' : undefined}
      onClick={(event) => {
        onClick?.(event)
        onSelect?.()
      }}
      onContextMenu={openMenu}
      onKeyDown={handleKeyDown}
    >
      <span className="slide-thumb__preview">
        <SlideView
          slide={slide}
          style={styleProfile}
          resolveAsset={resolveAsset}
          spots={spots}
          scale={THUMB_SCALE}
        />
      </span>
      <span className="slide-thumb__badge" aria-hidden="true">
        {number}
      </span>
    </button>
  )
}
