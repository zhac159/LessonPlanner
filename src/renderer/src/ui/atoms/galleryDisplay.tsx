import { Monitor } from 'lucide-react'
import type { GallerySection } from '../gallery'
import { Avatar } from './Avatar/Avatar'
import { Callout } from './Callout/Callout'
import { Card } from './Card/Card'
import { CardHeaderBand } from './CardHeaderBand/CardHeaderBand'
import { FileTypeBadge } from './FileTypeBadge/FileTypeBadge'
import { IconTile } from './IconTile/IconTile'
import { NumberDisc } from './NumberDisc/NumberDisc'
import { StatusPill, type StatusTone } from './StatusPill/StatusPill'
import { SwatchStack } from './SwatchStack/SwatchStack'

const TONES: StatusTone[] = ['done', 'working', 'waiting', 'error', 'neutral', 'inverse']
const WORDS: Record<StatusTone, string> = {
  done: 'Learned',
  working: 'Reading…',
  waiting: 'Waiting',
  error: 'Couldn’t read this file',
  neutral: 'Neutral',
  inverse: 'Default',
  tag: 'Year 8'
}

/** Specimens for the static display atoms: pills, badges, cards, callouts, small shapes. */
export const displaySections: GallerySection[] = [
  {
    name: 'StatusPill · tones',
    render: () => (
      <>
        {TONES.map((tone) => (
          <StatusPill key={tone} tone={tone}>
            {WORDS[tone]}
          </StatusPill>
        ))}
        <StatusPill tone="done" size="md" check live>
          Connected
        </StatusPill>
        <StatusPill tone="tag" color="var(--year-8)" size="xs">
          Year 8
        </StatusPill>
        <StatusPill tone="working" size="lg">
          Learning · 6 of 8 files
        </StatusPill>
      </>
    )
  },
  {
    name: 'FileTypeBadge',
    render: () => (
      <>
        <FileTypeBadge kind="pdf" />
        <FileTypeBadge kind="pptx" />
        <FileTypeBadge kind="docx" />
        <FileTypeBadge kind="file" />
      </>
    )
  },
  {
    name: 'Card · variants and tones',
    render: () => (
      <>
        <Card variant="page">page · lg</Card>
        <Card variant="raised">raised · md</Card>
        <Card variant="selected">selected · sm</Card>
        <Card variant="inner">inner · none</Card>
        <Card variant="raised" tone="accent">
          accent
        </Card>
        <Card variant="raised" tone="style">
          style
        </Card>
        <Card variant="raised" tone="sunken">
          sunken
        </Card>
      </>
    )
  },
  {
    name: 'CardHeaderBand · yellow and peach',
    render: () => (
      <div style={{ display: 'grid', gap: 16, width: 420 }}>
        <Card variant="panel" padding={0}>
          <CardHeaderBand
            leading={
              <IconTile size={44} tone="white">
                <Monitor size={20} />
              </IconTile>
            }
            title="Your planning buddy"
            subtitle="Knows your Science style"
          />
          <p style={{ margin: 16 }}>Panel body</p>
        </Card>
        <Card variant="panel" padding={0}>
          <CardHeaderBand
            tone="peach"
            title="Quiz"
            subtitle="Questions from your slides"
            padding="14px 16px"
          />
          <p style={{ margin: 16 }}>Plugin body</p>
        </Card>
      </div>
    )
  },
  {
    name: 'Callout · info, soft, tip, action, warning, error',
    render: () => (
      <div style={{ display: 'grid', gap: 12, width: 560 }}>
        <Callout title="Can I use my Claude Pro or Max subscription?">
          Not in other apps. Anthropic only allows subscription sign-in inside its own apps.
        </Callout>
        <Callout variant="soft">
          <strong>Tip:</strong> 10 or more decks gives the closest match.
        </Callout>
        <Callout variant="tip" onDismiss={() => {}}>
          Circle it, then say what you want — the assistant does the rest.
        </Callout>
        <Callout variant="action" action={<span>(a Button goes here)</span>}>
          Claude isn’t connected yet, so I can’t make slides.
        </Callout>
        <Callout variant="warning">Some slides may contain pupil names.</Callout>
        <Callout variant="error">I couldn’t load your lessons.</Callout>
      </div>
    )
  },
  {
    name: 'Avatar, NumberDisc, IconTile, SwatchStack',
    render: () => (
      <>
        <Avatar name="Alice" />
        <NumberDisc tone="orange">1</NumberDisc>
        <NumberDisc>2</NumberDisc>
        <NumberDisc tone="upcoming">3</NumberDisc>
        <NumberDisc done>4</NumberDisc>
        <NumberDisc size={36} tone="peach">
          5
        </NumberDisc>
        <IconTile>
          <Monitor size={24} />
        </IconTile>
        <IconTile size={60} tone="yellow">
          <Monitor size={26} />
        </IconTile>
        <SwatchStack colors={['#0f766e', '#1b1530', '#ffe36e', '#ffffff', '#ff6b3d', '#d7e8ff']} />
      </>
    )
  }
]
