import { Monitor } from 'lucide-react'
import type { GallerySection } from '../gallery'
import { Button } from './Button/Button'
import { Dropzone } from './Dropzone/Dropzone'
import { EmptyState } from './EmptyState/EmptyState'
import { ProgressBar } from './ProgressBar/ProgressBar'
import { ProgressDots } from './ProgressDots/ProgressDots'
import { ProgressPills } from './ProgressPills/ProgressPills'
import { SetupSteps } from './SetupSteps/SetupSteps'

const noop = (): void => {}
const STEPS = [
  { id: 'about', label: 'About you' },
  { id: 'claude', label: 'Connect Claude' },
  { id: 'style', label: 'Your style' }
]
const ITEMS = [
  { id: 'a', title: 'Tell me about you' },
  { id: 'b', title: 'Connect Claude' },
  { id: 'c', title: 'Teach me your style', optional: true }
]

/** Specimens for progress, onboarding steps, dropzones and empty states. */
export const flowSections: GallerySection[] = [
  {
    name: 'ProgressBar and ProgressDots',
    render: () => (
      <>
        <div style={{ width: 360 }}>
          <ProgressBar
            value={6}
            max={8}
            label="6 of 8 learned"
            estimate="About a minute left"
            valueText="6 of 8 files learned"
          />
        </div>
        <div style={{ width: 360 }}>
          <ProgressBar value={0} max={8} label="0 of 8 learned" />
        </div>
        <ProgressDots />
        <ProgressDots size="sm" />
      </>
    )
  },
  {
    name: 'ProgressPills',
    render: () => <ProgressPills steps={STEPS} current={1} onStepClick={noop} />
  },
  {
    name: 'SetupSteps · checklist, hero, cards',
    render: () => (
      <>
        <div style={{ width: 340 }}>
          <SetupSteps items={ITEMS} current={1} />
        </div>
        <div style={{ width: 300 }}>
          <SetupSteps items={ITEMS} variant="hero" aria-label="How it works" />
        </div>
        <div style={{ width: 560 }}>
          <SetupSteps
            variant="cards"
            aria-label="How to get a key"
            items={[
              { id: '1', title: 'Sign in', detail: 'Go to platform.claude.com' },
              { id: '2', title: 'Create a key', detail: 'Name it Slide Planner' },
              { id: '3', title: 'Paste it here' }
            ]}
          />
        </div>
      </>
    )
  },
  {
    name: 'Dropzone · large, compact, chat (drop files to see the drag state)',
    render: () => (
      <div style={{ display: 'grid', gap: 16, width: 420 }}>
        <Dropzone
          title="Create a new style"
          description={
            <>
              Drop old PDFs or PowerPoints here, or{' '}
              <span className="ui-dropzone__link">browse files</span>
            </>
          }
          meta=".pdf and .pptx · up to 50 files"
          accept={['.pdf', '.pptx']}
          onFiles={noop}
          onBrowse={noop}
        />
        <Dropzone
          variant="compact"
          title="Add more PDFs or PowerPoints"
          description="Drop files here, or browse"
          accept={['.pdf', '.pptx']}
          onFiles={noop}
          onBrowse={noop}
        />
        <Dropzone
          variant="chat"
          title="Drop your learning objectives"
          description="Word, PDF or PowerPoint · or click to browse"
          accept={['.docx', '.pdf', '.pptx']}
          onFiles={noop}
          onBrowse={noop}
        />
      </div>
    )
  },
  {
    name: 'Dropzone · disabled and loading',
    render: () => (
      <div style={{ display: 'grid', gap: 16, width: 420 }}>
        <Dropzone
          variant="compact"
          title="Limit reached"
          description="Remove a file to add another"
          disabled
          onFiles={noop}
          onBrowse={noop}
        />
        <Dropzone
          variant="compact"
          title="Add more"
          loading
          loadingLabel="Adding 3 files…"
          onFiles={noop}
          onBrowse={noop}
        />
      </div>
    )
  },
  {
    name: 'EmptyState · stage and list',
    render: () => (
      <>
        <div style={{ width: 520 }}>
          <EmptyState
            icon={<Monitor size={34} />}
            title="Your slides will appear here"
            actions={
              <>
                <Button shape="pill">Start from a past lesson</Button>
                <Button shape="pill">Blank slide</Button>
              </>
            }
          >
            Tell the planning buddy what you’re teaching, or drop your learning objectives.
          </EmptyState>
        </div>
        <div style={{ width: 360 }}>
          <EmptyState variant="list" icon={<Monitor size={24} />} title="No styles yet">
            Drop some old decks and I’ll learn your style.
          </EmptyState>
        </div>
      </>
    )
  }
]
