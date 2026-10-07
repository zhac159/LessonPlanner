import { useState } from 'react'
import type { GalleryGroup } from '../gallery'
import { AttachmentCard } from './AttachmentCard/AttachmentCard'
import { ChatPanel } from './ChatPanel/ChatPanel'
import { Composer, type ComposerProps } from './Composer/Composer'
import { MessageAssistant } from './MessageAssistant/MessageAssistant'
import { MessageProgress } from './MessageProgress/MessageProgress'
import { MessageUser } from './MessageUser/MessageUser'
import { RegionChip } from './RegionChip/RegionChip'
import { ResultChip } from './ResultChip/ResultChip'

const noop = (): void => {}
const column = { display: 'grid', gap: 12, maxWidth: 400 } as const

/** A Composer that keeps its own draft, like a screen would. */
function ComposerDemo(
  props: Partial<Omit<ComposerProps, 'value' | 'onChange'>> & { text?: string }
) {
  const { text = '', ...rest } = props
  const [value, setValue] = useState(text)
  return <Composer value={value} onChange={setValue} onSend={noop} {...rest} />
}

function ResultDemo() {
  const [undone, setUndone] = useState(false)
  return (
    <ResultChip
      label="8 slides added"
      undone={undone}
      onUndo={() => setUndone(true)}
      onRedo={() => setUndone(false)}
      onRefine={noop}
    />
  )
}

const REGION = { id: 'r1', n: 1, slideNumber: 3, description: 'photo of a leaf', onClick: noop }

const gallery: GalleryGroup = {
  title: 'Chat',
  sections: [
    {
      name: 'AttachmentCard · upload, reading, error, made by the buddy, staged',
      render: () => (
        <div style={column}>
          <AttachmentCard name="Y8 Photosynthesis LOs.docx" sizeBytes={48 * 1024} />
          <AttachmentCard name="Unit plan.pdf" status="uploading" />
          <AttachmentCard name="Scheme.pptx" status="reading" />
          <AttachmentCard name="Objectives.docx" detail="3 objectives found" />
          <AttachmentCard name="Broken.pdf" status="error" />
          <AttachmentCard name="Leaf photo.png" sizeBytes={1.4 * 1024 * 1024} />
          <AttachmentCard
            name="Photosynthesis worksheet.docx"
            icon="file-text"
            onOpen={noop}
            onShowInFolder={noop}
          />
          <AttachmentCard name="Notes.pdf" onRemove={noop} />
        </div>
      )
    },
    {
      name: 'RegionChip · circled, staged, marked up, removed',
      render: () => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <RegionChip {...REGION} />
          <RegionChip {...REGION} onRemove={noop} />
          <RegionChip slideNumber={2} caption="marked up" onRemove={noop} />
          <RegionChip {...REGION} removed />
        </div>
      )
    },
    {
      name: 'ResultChip · done with Undo (try it), blocked, busy, undone',
      render: () => (
        <div style={column}>
          <ResultDemo />
          <ResultChip label="Slide 3 changed" canUndo={false} onUndo={noop} />
          <ResultChip label="8 slides added" busy onUndo={noop} />
          <ResultChip label="8 slides added" undone onRedo={noop} />
        </div>
      )
    },
    {
      name: 'MessageUser · attachment, region, failed',
      render: () => (
        <div style={column}>
          <MessageUser
            attachments={[{ id: 'a', name: 'Y8 Photosynthesis LOs.docx', sizeBytes: 48 * 1024 }]}
            text="Can you build tomorrow’s lesson from these? 50 minutes, mixed-ability Year 8."
            note="Year 8 · 50 min · Mixed ability · About 8 slides"
          />
          <MessageUser
            regions={[REGION]}
            text="Swap this photo for a labelled diagram of a leaf cross-section."
          />
          <MessageUser text="Add a plenary." failed onRetry={noop} />
        </div>
      )
    },
    {
      name: 'MessageAssistant · intro, reply with result, streaming, error',
      render: () => (
        <div style={column}>
          <MessageAssistant
            heading="What are we teaching?"
            text="Paste your learning objectives, or drop the document they’re in."
          />
          <MessageAssistant text="Done! 8 slides in your Science style — **Do Now**, tick-box objectives and key word chips.">
            <ResultDemo />
          </MessageAssistant>
          <MessageAssistant text={'I’m adding:\n- a labelled diagram\n- a caption'} streaming />
          <MessageAssistant
            variant="error"
            text="I couldn’t make that change cleanly. Nothing was changed."
            action={{ label: 'Try again', onClick: noop }}
          />
        </div>
      )
    },
    {
      name: 'MessageProgress · simple, steps, determinate',
      render: () => (
        <div style={column}>
          <MessageProgress label="Drawing your leaf diagram…" onStop={noop} />
          <MessageProgress
            label="Making your quiz…"
            steps={[
              { label: 'Reading the slides', state: 'done' },
              { label: 'Writing questions', state: 'running' },
              { label: 'Checking answers', state: 'upcoming' }
            ]}
          />
          <MessageProgress
            label="Making slide 3 of 8…"
            progress={{ value: 3, max: 8, label: '3 of 8 slides' }}
            onStop={noop}
          />
        </div>
      )
    },
    {
      name: 'Composer · empty, draft with staged items, busy, generate, disabled',
      render: () => (
        <div style={column}>
          <ComposerDemo />
          <ComposerDemo
            text="Swap this photo for a labelled diagram."
            regions={[REGION]}
            attachments={[{ id: 'a', name: 'LOs.docx', sizeBytes: 48 * 1024 }]}
            onRemoveRegion={noop}
            onRemoveAttachment={noop}
          />
          <ComposerDemo busy text="Add a plenary" onStop={noop} />
          <ComposerDemo
            mode="generate"
            minRows={4}
            text="LO1: Describe where photosynthesis happens"
          />
          <ComposerDemo disabled />
        </div>
      )
    },
    {
      name: 'ChatPanel · conversation (the editor), no key',
      render: () => (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', height: 620 }}>
          <ChatPanel
            subtitle="Knows your Science style"
            status={{ label: 'Working', tone: 'working' }}
            composer={<ComposerDemo />}
          >
            <MessageUser
              attachments={[{ id: 'a', name: 'Y8 Photosynthesis LOs.docx' }]}
              text="Can you build tomorrow’s lesson from these?"
            />
            <MessageAssistant text="Done! 8 slides in your Science style.">
              <ResultDemo />
            </MessageAssistant>
            <MessageUser regions={[REGION]} text="Swap this photo for a diagram." />
            <MessageProgress label="Drawing your leaf diagram…" onStop={noop} />
          </ChatPanel>
          <ChatPanel
            subtitle="Ready to plan with you"
            offline
            needsKey
            onConnect={noop}
            composer={<ComposerDemo disabled />}
          />
        </div>
      )
    }
  ]
}

export default gallery
