import type { CSSProperties } from 'react'
import { Monitor } from 'lucide-react'
import { EmptyState } from '../atoms'
import type { GalleryGroup } from '../gallery'
import { allElementsSlide, sampleDeck, sampleStyle } from '../slide/galleryData'
import { FilmstripDemo, LessonCardMenuDemo } from './galleryDemos'
import {
  Filmstrip,
  LessonCard,
  SlideStage,
  SlideThumb,
  StyleCard,
  formatRelativeDate
} from './index'

const NOW = new Date(2026, 9, 6, 10)
const daysAgo = (days: number): string => new Date(NOW.getTime() - days * 86_400_000).toISOString()
const [first, second, third] = sampleDeck.slides
const noop = (): void => {}

const row: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }
const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: 20
}
const column: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }

/** Lesson and style cards, slide thumbnails, the filmstrip and the slide stage. */
const gallery: GalleryGroup = {
  title: 'Lesson',
  sections: [
    {
      name: 'LessonCard (ready, empty, building, no year, menu)',
      render: () => (
        <div style={grid}>
          <LessonCardMenuDemo now={NOW} />
          <LessonCard
            title="Y9 Maths — Ratio"
            yearTag="Year 9"
            slideCount={12}
            updatedAt={daysAgo(0)}
            now={NOW}
            thumbDataUrl={null}
            slide={second}
            styleProfile={sampleStyle}
            onOpen={noop}
            onMenu={noop}
          />
          <LessonCard
            title="Form time — Kindness"
            yearTag="Form"
            slideCount={0}
            updatedAt={daysAgo(20)}
            now={NOW}
            onOpen={noop}
          />
          <LessonCard
            title="Y7 History — Romans"
            yearTag="Year 7"
            slideCount={0}
            updatedAt={daysAgo(0)}
            now={NOW}
            status="generating"
            onOpen={noop}
          />
          <LessonCard
            title="Untitled lesson"
            slideCount={1}
            updatedAt={daysAgo(400)}
            now={NOW}
            onOpen={noop}
          />
        </div>
      )
    },
    {
      name: 'StyleCard (default, other, learning, with actions)',
      render: () => (
        <div style={column}>
          <StyleCard
            name="Science KS3"
            titleFont="Lexend"
            deckCount={24}
            swatches={['#0E7C7B', '#12263A', '#FFE36E', '#E3F2F1']}
            isDefault
            onOpen={noop}
          />
          <StyleCard
            name="Maths — clean"
            titleFont="Poppins"
            deckCount={1}
            swatches={['#2B59C3', '#1B1530', '#FFD6C9']}
            onOpen={noop}
          />
          <StyleCard
            name="History"
            titleFont="Merriweather"
            deckCount={6}
            swatches={['#7A3E1D', '#1B1530']}
            status="learning"
            onOpen={noop}
          />
          <StyleCard
            name="Form time"
            titleFont="Lexend"
            deckCount={3}
            swatches={['#8F5BD6', '#1B1530', '#EAD9FF']}
            onOpen={noop}
            onEdit={noop}
            onSetDefault={noop}
          />
        </div>
      )
    },
    {
      name: 'SlideThumb (resting, selected, dragging, placeholder, generating, card)',
      render: () => (
        <div style={row}>
          <SlideThumb slide={first} styleProfile={sampleStyle} number={1} onSelect={noop} />
          <SlideThumb slide={second} styleProfile={sampleStyle} number={2} selected />
          <SlideThumb slide={third} styleProfile={sampleStyle} number={3} dragging />
          <SlideThumb styleProfile={null} variant="placeholder" />
          <SlideThumb styleProfile={null} variant="generating" />
          <div style={{ width: 240, border: '2px solid var(--ink)' }}>
            <SlideThumb slide={first} styleProfile={sampleStyle} variant="card" />
          </div>
        </div>
      )
    },
    {
      name: 'Filmstrip (horizontal: click, arrows, Alt+arrows, Delete, drag)',
      render: () => (
        <div style={{ maxWidth: 900 }}>
          <FilmstripDemo layout="horizontal" />
        </div>
      )
    },
    {
      name: 'Filmstrip (vertical)',
      render: () => (
        <div style={{ height: 360 }}>
          <FilmstripDemo layout="vertical" />
        </div>
      )
    },
    {
      name: 'Filmstrip (generating and empty)',
      render: () => (
        <div style={{ maxWidth: 900, display: 'grid', gap: 12 }}>
          <Filmstrip
            slides={sampleDeck.slides.slice(0, 2)}
            styleProfile={sampleStyle}
            selectedId={first.id}
            pendingCount={4}
            reveal
            onSelect={noop}
          />
          <Filmstrip slides={[]} styleProfile={null} selectedId={null} onSelect={noop} />
        </div>
      )
    },
    {
      name: 'SlideStage (slide, overlay slot, fit badge)',
      render: () => (
        <div style={{ ...row, alignItems: 'flex-start' }}>
          <div style={{ width: 640 }}>
            <SlideStage slide={allElementsSlide} styleProfile={sampleStyle} label="All elements">
              <svg viewBox="0 0 1920 1080" width="100%" height="100%" aria-hidden="true">
                <ellipse
                  cx="1400"
                  cy="380"
                  rx="420"
                  ry="260"
                  fill="none"
                  stroke="var(--orange)"
                  strokeWidth="5"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                />
              </svg>
            </SlideStage>
          </div>
          <div style={{ width: 400 }}>
            <SlideStage slide={first} styleProfile={null} cursor="crosshair" label="No style" />
          </div>
        </div>
      )
    },
    {
      name: 'SlideStage (loading and empty)',
      render: () => (
        <div style={row}>
          <div style={{ width: 400 }}>
            <SlideStage slide={null} styleProfile={null} loading />
          </div>
          <div style={{ width: 400 }}>
            <SlideStage
              slide={null}
              styleProfile={null}
              empty={
                <EmptyState icon={<Monitor size={34} />} title="Your slides will appear here">
                  Tell the planning buddy what you are teaching.
                </EmptyState>
              }
            />
          </div>
        </div>
      )
    },
    {
      name: 'Relative dates',
      render: () => (
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {[0, 1, 3, 9, 16, 40, 100, 400].map((days) => (
            <li key={days}>
              {days} days: {formatRelativeDate(daysAgo(days), NOW)}
            </li>
          ))}
        </ul>
      )
    }
  ]
}

export default gallery
