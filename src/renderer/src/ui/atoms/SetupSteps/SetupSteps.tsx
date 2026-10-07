import type { ReactNode } from 'react'
import { cx } from '../cx'
import { NumberDisc } from '../NumberDisc/NumberDisc'
import './SetupSteps.css'

export interface SetupStepItem {
  id: string
  title: ReactNode
  /** Extra line under the title (`cards` variant), or a link. */
  detail?: ReactNode
  /** Appends a light "(optional)". */
  optional?: boolean
}

export interface SetupStepsProps {
  items: ReadonlyArray<SetupStepItem>
  /** checklist = Welcome card, hero = Welcome side panel, cards = Connect how-to grid. */
  variant?: 'checklist' | 'hero' | 'cards'
  /** Zero-based current step for `checklist`: earlier steps are done, later ones upcoming. */
  current?: number
  'aria-label'?: string
  className?: string
}

const CARD_TONES = ['peach', 'sky', 'mint'] as const

/** Numbered steps in three layouts. Static: it shows progress, it is not navigation. */
export function SetupSteps({
  items,
  variant = 'checklist',
  current = 0,
  'aria-label': ariaLabel = 'Setup steps',
  className
}: SetupStepsProps) {
  return (
    <ol className={cx('ui-steps', className)} data-variant={variant} aria-label={ariaLabel}>
      {items.map((item, index) => {
        const state =
          variant !== 'checklist'
            ? 'plain'
            : index < current
              ? 'done'
              : index === current
                ? 'current'
                : 'upcoming'
        const disc =
          variant === 'hero' ? (
            <NumberDisc size={36} tone="white">
              {index + 1}
            </NumberDisc>
          ) : variant === 'cards' ? (
            <NumberDisc size={32} tone={CARD_TONES[index % CARD_TONES.length]}>
              {index + 1}
            </NumberDisc>
          ) : (
            <NumberDisc
              size={30}
              tone={state === 'current' ? 'orange' : 'upcoming'}
              done={state === 'done'}
            >
              {index + 1}
            </NumberDisc>
          )
        return (
          <li
            key={item.id}
            className="ui-steps__item"
            data-state={state}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            {disc}
            <span className="ui-steps__text">
              <span className="ui-steps__title">
                {item.title}
                {item.optional && <span className="ui-steps__optional"> (optional)</span>}
              </span>
              {item.detail && <span className="ui-steps__detail">{item.detail}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
