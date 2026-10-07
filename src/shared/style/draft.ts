/** A brand-new, empty StyleProfile: what a style is before any file has been learned. Pure. */
import type { FontSpec, StyleProfile } from './types'

const FALLBACK = "'Segoe UI', Arial, sans-serif"

const font = (weight: FontSpec['weight'], sizePt: number): FontSpec => ({
  family: 'Segoe UI',
  weight,
  sizePt,
  fallbackStack: FALLBACK,
  available: true
})

/** Neutral starting point; replaced piece by piece as files are learned (see provisional.ts). */
export function createDraftProfile(id: string, name: string, now: string): StyleProfile {
  return {
    schemaVersion: 1,
    id,
    name,
    version: 1,
    isDefault: false,
    status: 'draft',
    tokens: {
      colors: {
        background: { hex: '#FFFFFF', label: 'White', usage: 'Slide background' },
        text: { hex: '#1F2937', label: 'Charcoal', usage: 'Body text and titles' },
        accent: { hex: '#2563EB', label: 'Blue', usage: 'Highlights' },
        highlight: { hex: '#FFE36E', label: 'Yellow', usage: 'Question boxes' },
        chipBg: { hex: '#E0E7FF', label: 'Pale blue', usage: 'Key word chips' },
        chipText: { hex: '#1F2937', label: 'Charcoal', usage: 'Key word chip text' },
        muted: { hex: '#6B7280', label: 'Grey', usage: 'Captions' }
      },
      fonts: { title: font(700, 40), body: font(400, 20) }
    },
    components: {},
    layouts: [],
    slideTypes: [],
    lessonFlow: [],
    voice: { spelling: 'en-GB', rules: [], phrases: [] },
    habits: [],
    exemplars: [],
    sources: [],
    corrections: [],
    confidence: { colors: 'low', fonts: 'low', layouts: 'low', voice: 'low', slideTypes: 'low' },
    createdAt: now,
    updatedAt: now
  }
}
