import { Ellipsis, Monitor } from 'lucide-react'
import { useId, type MouseEvent } from 'react'
import type { Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { cx } from '../../atoms/cx'
import { IconButton } from '../../atoms/IconButton/IconButton'
import { StatusPill } from '../../atoms/StatusPill/StatusPill'
import { anchorBelow, type Point } from '../../overlays/ContextMenu/position'
import type { SlideViewProps } from '../../slide'
import { formatRelativeDate } from '../formatRelativeDate'
import { anchorForContextMenu } from '../menuAnchor'
import { SlideThumb } from '../SlideThumb/SlideThumb'
import { yearColor } from '../yearColor'
import './LessonCard.css'

export interface LessonCardProps {
  title: string
  /** Short year tag ("Year 8", "Form"); coloured by year group. Omit for no chip. */
  yearTag?: string | null
  slideCount: number
  /** ISO timestamp of the last edit, shown as "Today", "3 days ago"… */
  updatedAt: string
  /** The clock for the relative date (tests, midnight refresh). Defaults to the current time. */
  now?: Date
  /** First slide, drawn live with the lesson's style. Wins over `thumbDataUrl`. */
  slide?: Slide | null
  styleProfile?: StyleProfile | null
  /** A saved thumbnail picture, used when there is no `slide`. */
  thumbDataUrl?: string | null
  /** `generating` = skeleton thumbnail and a working "Building…" pill. */
  status?: 'ready' | 'generating'
  /** Highlights the card (for example while its menu is open). */
  selected?: boolean
  resolveAsset?: SlideViewProps['resolveAsset']
  /** Open the lesson (click, Enter or Space on the card). */
  onOpen: () => void
  /** Open the lesson's context menu here: from the ⋯ button or a right-click. Omit for no menu. */
  onMenu?: (anchor: Point) => void
  className?: string
}

function Thumbnail({
  slide,
  styleProfile,
  thumbDataUrl,
  generating,
  resolveAsset
}: Pick<LessonCardProps, 'slide' | 'thumbDataUrl' | 'resolveAsset'> & {
  styleProfile: StyleProfile | null
  generating: boolean
}) {
  if (slide)
    return (
      <SlideThumb
        slide={slide}
        styleProfile={styleProfile}
        variant="card"
        resolveAsset={resolveAsset}
      />
    )
  if (thumbDataUrl) return <img className="lesson-card__image" src={thumbDataUrl} alt="" />
  if (generating) return <SlideThumb styleProfile={null} variant="generating" />
  return (
    <span className="lesson-card__empty">
      <Monitor size={34} strokeWidth={2} aria-hidden="true" />
    </span>
  )
}

/**
 * A past lesson on Home: thumbnail of slide 1 (or an empty tile), title, year chip, slide count and
 * relative date. The whole card opens the lesson; the ⋯ button and right-click ask for its menu.
 */
export function LessonCard({
  title,
  yearTag,
  slideCount,
  updatedAt,
  now,
  slide = null,
  styleProfile = null,
  thumbDataUrl = null,
  status = 'ready',
  selected = false,
  resolveAsset,
  onOpen,
  onMenu,
  className
}: LessonCardProps) {
  const id = useId()
  const generating = status === 'generating'
  const date = formatRelativeDate(updatedAt, now)

  const openMenuFromButton = (event: MouseEvent<HTMLButtonElement>): void =>
    onMenu?.(anchorBelow(event.currentTarget))
  const openMenuFromPointer = (event: MouseEvent<HTMLButtonElement>): void => {
    if (!onMenu) return
    event.preventDefault()
    onMenu(anchorForContextMenu(event, event.currentTarget))
  }

  return (
    <article
      className={cx('lesson-card', className)}
      data-selected={selected || undefined}
      data-status={status}
    >
      <button
        type="button"
        className="lesson-card__open"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-meta`}
        onClick={onOpen}
        onContextMenu={openMenuFromPointer}
      >
        <span className="lesson-card__thumb" aria-hidden="true">
          <Thumbnail
            slide={slide}
            styleProfile={styleProfile}
            thumbDataUrl={thumbDataUrl}
            generating={generating}
            resolveAsset={resolveAsset}
          />
        </span>
        <span className="lesson-card__body">
          <span id={`${id}-title`} className="lesson-card__title">
            {title}
          </span>
          <span id={`${id}-meta`} className="lesson-card__meta">
            {yearTag && (
              <StatusPill tone="tag" size="xs" color={yearColor(yearTag)}>
                {yearTag}
              </StatusPill>
            )}
            {generating ? (
              <StatusPill tone="working" size="xs">
                Building…
              </StatusPill>
            ) : (
              <span>{slideCount === 1 ? '1 slide' : `${slideCount} slides`}</span>
            )}
            <span className="lesson-card__spacer" />
            <time dateTime={updatedAt}>{date}</time>
          </span>
        </span>
      </button>
      {onMenu && (
        <IconButton
          variant="ghost"
          className="lesson-card__menu"
          aria-label={`More actions for ${title}`}
          aria-haspopup="menu"
          onClick={openMenuFromButton}
        >
          <Ellipsis strokeWidth={2.4} />
        </IconButton>
      )}
    </article>
  )
}
