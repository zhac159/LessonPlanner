import type { ReactNode } from 'react'
import deckJson from '../../../../../design/fixtures/deck.photosynthesis.json'
import type { StyleFile } from '@shared/contracts/style-library'
import type { Deck } from '@shared/deck/types'
import type { GallerySection } from '@ui/gallery'
import { ColourRole } from './ColourRole/ColourRole'
import { ColoursSection } from './ColoursSection/ColoursSection'
import { CorrectionDemo } from './galleryDemos'
import { sampleData, sampleStyle } from './galleryData'
import { FontSample } from './FontSample/FontSample'
import { FontsSection } from './FontsSection/FontsSection'
import { HabitsSection } from './HabitsSection/HabitsSection'
import { SlideTypesSection } from './SlideTypesSection/SlideTypesSection'
import { StyleFileRow } from './StyleFileRow/StyleFileRow'
import { TestSlidePreview } from './TestSlidePreview/TestSlidePreview'
import { VoiceSection } from './VoiceSection/VoiceSection'

const slide = (deckJson as unknown as Deck).slides[0]
const colours = sampleData.colours ?? []
const fonts = sampleData.fonts ?? []

const column = (width: number, children: ReactNode) => (
  <div style={{ display: 'grid', gap: 12, width }}>{children}</div>
)
const grid = (children: ReactNode) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: 16,
      alignItems: 'start'
    }}
  >
    {children}
  </div>
)

const file = (over: Partial<StyleFile>): StyleFile => ({
  id: over.name ?? 'f',
  name: 'Y8 Photosynthesis.pptx',
  kind: 'pptx',
  units: 14,
  status: 'learned',
  mayContainNames: false,
  ...over
})

const files: StyleFile[] = [
  file({}),
  file({ name: 'Y7 Cells and organelles.pdf', kind: 'pdf', units: 18 }),
  file({ name: 'Y8 Acids and alkalis.pptx', units: 15, status: 'reading' }),
  file({ name: 'Y7 Energy stores.pdf', kind: 'pdf', units: null, status: 'waiting' }),
  file({ name: 'Y9 Pupil reports.pptx', mayContainNames: true }),
  file({
    name: 'Y9 Scanned worksheets.pdf',
    kind: 'pdf',
    units: null,
    status: 'failed',
    error: { code: 'scanned', message: 'This PDF is scanned images only', retryable: false }
  }),
  file({
    name: 'Y8 Periodic table.pdf',
    kind: 'pdf',
    units: null,
    status: 'failed',
    error: { code: 'network', message: 'Couldn’t reach Claude', retryable: true }
  }),
  file({ name: 'A very long file name for a Year 8 lesson on photosynthesis and respiration.pptx' })
]

/** The Create a style kit: colours, fonts, test slide, correction box, file rows and learned cards. */
const gallery: { title: string; sections: GallerySection[] } = {
  title: 'Style',
  sections: [
    {
      name: 'ColourRole',
      render: () =>
        column(
          360,
          colours.map((colour) => <ColourRole key={colour.token} {...colour} />)
        )
    },
    {
      name: 'FontSample (installed, then not installed)',
      render: () =>
        column(
          360,
          <>
            {fonts.map((font) => (
              <FontSample
                key={font.use}
                {...font}
                textColour={sampleStyle.tokens.colors.text.hex}
              />
            ))}
            <FontSample
              {...fonts[0]}
              available={false}
              fallbackStack="'Lexend', 'Segoe UI', sans-serif"
            />
          </>
        )
    },
    {
      name: 'StyleFileRow (every status, warning, failure, retry, long name)',
      render: () =>
        column(
          520,
          <ul style={{ display: 'grid', gap: 10, margin: 0, padding: 0 }}>
            {files.map((f) => (
              <StyleFileRow key={f.id} file={f} onRemove={() => {}} onRetry={() => {}} />
            ))}
          </ul>
        )
    },
    {
      name: 'TestSlidePreview (slide, placeholder, loading)',
      render: () =>
        grid(
          <>
            <TestSlidePreview slide={slide} style={sampleStyle} version={1} />
            <TestSlidePreview slide={null} style={null} />
            <TestSlidePreview slide={slide} style={sampleStyle} loading />
          </>
        )
    },
    {
      name: 'CorrectionBox (idle, typed, busy, error, confirmed with history)',
      render: () =>
        column(
          640,
          <>
            <CorrectionDemo />
            <CorrectionDemo initial="I never use yellow on title slides" />
            <CorrectionDemo initial="I never use yellow on title slides" busy />
            <CorrectionDemo
              initial="I never use yellow on title slides"
              error="I couldn’t reach Claude. Check your connection and try again."
            />
            <CorrectionDemo
              confirmation="Got it: title slides won’t use the yellow box."
              confirmationMs={3600000}
              corrections={[
                { text: 'Title slides never use the yellow box', at: '2026-10-05T09:00:00Z' },
                { text: 'British spelling only', at: '2026-10-06T09:00:00Z' }
              ]}
            />
          </>
        )
    },
    {
      name: 'Learned cards (filled)',
      render: () =>
        grid(
          <>
            <ColoursSection colours={sampleData.colours} />
            <FontsSection
              fonts={sampleData.fonts}
              textColour={sampleStyle.tokens.colors.text.hex}
            />
            <HabitsSection habits={sampleData.habits} />
            <SlideTypesSection names={sampleData.slideTypes} />
            <VoiceSection rules={sampleData.voiceRules} />
          </>
        )
    },
    {
      name: 'Learned cards (building skeletons)',
      render: () =>
        grid(
          <>
            <ColoursSection colours={null} />
            <FontsSection fonts={null} />
            <HabitsSection habits={null} />
            <SlideTypesSection names={null} />
            <VoiceSection rules={null} />
          </>
        )
    },
    {
      name: 'Learned cards (long lists with Show all)',
      render: () =>
        grid(
          <>
            <ColoursSection
              colours={Array.from({ length: 8 }, (_, i) => ({
                token: `c${i}`,
                hex: `#${(i * 2 + 1).toString(16).repeat(6)}`,
                label: `Colour ${i + 1}`,
                usage: 'extra colour'
              }))}
            />
            <HabitsSection habits={Array.from({ length: 8 }, (_, i) => `Layout habit ${i + 1}`)} />
            <VoiceSection rules={Array.from({ length: 7 }, (_, i) => `Writing rule ${i + 1}`)} />
          </>
        )
    }
  ]
}

export default gallery
