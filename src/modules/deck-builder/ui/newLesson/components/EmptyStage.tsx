import { Monitor } from 'lucide-react'
import { Button, EmptyState } from '@ui/atoms'
import { Filmstrip, SlideStage } from '@ui/lesson'

export interface EmptyStageProps {
  /** Both buttons are locked while a lesson is being made. */
  busy?: boolean
  onPastLesson(): void
  onBlankSlide(): void
}

/**
 * The stage and filmstrip of a lesson with no slides yet (05 §3): a dashed "Your slides will appear
 * here" with the two other ways to start, and four dashed filmstrip slots.
 */
export function EmptyStage({ busy = false, onPastLesson, onBlankSlide }: EmptyStageProps) {
  return (
    <div className="nl-stage">
      <SlideStage
        slide={null}
        styleProfile={null}
        empty={
          <EmptyState
            icon={<Monitor strokeWidth={2} />}
            title="Your slides will appear here"
            actions={
              <>
                <Button shape="pill" disabled={busy} onClick={onPastLesson}>
                  Start from a past lesson
                </Button>
                <Button shape="pill" disabled={busy} onClick={onBlankSlide}>
                  Blank slide
                </Button>
              </>
            }
          >
            Tell the planning buddy what you’re teaching. Paste your learning objectives or drop the
            document they’re in.
          </EmptyState>
        }
      />
      <Filmstrip slides={[]} styleProfile={null} selectedId={null} onSelect={() => {}} />
    </div>
  )
}
