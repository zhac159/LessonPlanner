import type { ReactNode } from 'react'
import { SlideView } from './SlideView'
import { allElementsSlide, overflowSlide, sampleDeck, sampleStyle } from './galleryData'

export interface GallerySection {
  name: string
  render: () => ReactNode
}

const frame = (width: number) =>
  ({ width, border: '2px solid #1b1530', borderRadius: 8, overflow: 'hidden' }) as const
const row = { display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' } as const

/** The slide renderer showing the photosynthesis fixture, every element type, no-profile and overflow states. */
const gallery: { title: string; sections: GallerySection[] } = {
  title: 'Slides',
  sections: [
    {
      name: 'Photosynthesis deck (Science KS3 style)',
      render: () => (
        <div style={row}>
          {sampleDeck.slides.map((slide) => (
            <div key={slide.id} style={frame(520)}>
              <SlideView slide={slide} style={sampleStyle} aria-label={`Slide ${slide.id}`} />
            </div>
          ))}
        </div>
      )
    },
    {
      name: 'Every element type',
      render: () => (
        <div style={frame(960)}>
          <SlideView slide={allElementsSlide} style={sampleStyle} aria-label="All element types" />
        </div>
      )
    },
    {
      name: 'No style profile (plain default)',
      render: () => (
        <div style={frame(520)}>
          <SlideView slide={sampleDeck.slides[2]} style={null} aria-label="Default style slide" />
        </div>
      )
    },
    {
      name: 'Doesn’t fit badge (editor only)',
      render: () => (
        <div style={row}>
          <div style={frame(520)}>
            <SlideView
              slide={overflowSlide}
              style={sampleStyle}
              showFitBadges
              aria-label="With badge"
            />
          </div>
          <div style={frame(520)}>
            <SlideView slide={overflowSlide} style={sampleStyle} aria-label="Without badge" />
          </div>
        </div>
      )
    }
  ]
}

export default gallery
