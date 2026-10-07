import { Dropzone } from '@ui/atoms'
import { MessageAssistant } from '@ui/chat'
import type { LessonSetup, ChipKey } from '../setup'
import { SetupChips } from './SetupChips'

export const INTRO_HEADING = 'What are we teaching?'
export const INTRO_TEXT =
  'Paste your learning objectives, or drop the document they’re in. It also helps to tell me the year group, how long the lesson is, and anything the class finds tricky.'

const ignoreDrop = (): void => {}

export interface LessonIntroProps {
  setup: LessonSetup
  onSetupChange(key: ChipKey, value: string | number): void
  /** Three documents are attached already. */
  documentsFull: boolean
  /** A document is being added. */
  adding: boolean
  onBrowse(): void
}

/** The first thing in the transcript (05 §5): the question, the set-up chips and the Dropzone. */
export function LessonIntro({
  setup,
  onSetupChange,
  documentsFull,
  adding,
  onBrowse
}: LessonIntroProps) {
  return (
    <>
      <MessageAssistant heading={INTRO_HEADING} text={INTRO_TEXT} />
      <SetupChips setup={setup} onChange={onSetupChange} />
      <Dropzone
        variant="chat"
        title="Drop your learning objectives"
        description="Word, PDF or PowerPoint · or click to browse"
        disabled={documentsFull}
        loading={adding}
        loadingLabel="Adding your document…"
        onBrowse={onBrowse}
        // A drop bubbles up to the panel, which imports the files (once).
        onFiles={ignoreDrop}
      />
    </>
  )
}
