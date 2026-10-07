/** Wire schemas (no optional fields, see slide.ts) and mappers for FileAnalysis, objectives, plans and corrections. */
import { z } from 'zod'
import type { FileAnalysis, ExtractedObjectives, LessonPlan } from '@shared/ai/types'
import { SLIDE_KINDS } from '@shared/style/schema'

const slideKind = z.enum(SLIDE_KINDS)
const numberOrZero = (what: string) => z.number().describe(`${what}; 0 when unknown`)

// ---- 4.1 FileAnalysis
export const analysisWire = z.object({
  colors: z.array(
    z.object({
      hex: z.string().describe('#RRGGBB'),
      role: z.enum(['background', 'text', 'accent', 'highlight', 'chip', 'other']),
      evidence: z.string().describe('where you saw it, with page numbers'),
      frequency: z.enum(['most', 'many', 'some'])
    })
  ),
  fonts: z.array(
    z.object({
      family: z.string(),
      usedFor: z.enum(['title', 'body', 'other']),
      sizePt: numberOrZero('typical size in pt'),
      weight: numberOrZero('400-800')
    })
  ),
  layouts: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      regions: z.array(
        z.object({
          name: z.string(),
          elementType: z.string(),
          x: z.number(),
          y: z.number(),
          w: z.number(),
          h: z.number()
        })
      ),
      pages: z.array(z.number())
    })
  ),
  decorations: z.array(
    z.object({
      description: z.string(),
      shape: z.string().describe('rect, ellipse, line... or ""'),
      x: z.number(),
      y: z.number(),
      w: numberOrZero('width on the 1920x1080 grid'),
      h: numberOrZero('height on the 1920x1080 grid'),
      color: z.string().describe('#RRGGBB or ""')
    })
  ),
  slideKinds: z.array(z.object({ page: z.number(), kind: slideKind, title: z.string() })),
  voice: z.object({
    rules: z.array(z.string()),
    phrases: z.array(z.string()),
    spelling: z.enum(['en-GB', 'en-US', 'unknown'])
  }),
  habits: z.array(z.string()),
  exemplarCandidates: z.array(z.object({ page: z.number(), why: z.string() })),
  problems: z.array(z.string()).describe('pages that are unreadable or not slides; [] when fine')
})

export type AnalysisWire = z.infer<typeof analysisWire>

export function toFileAnalysis(wire: AnalysisWire): FileAnalysis {
  return {
    colors: wire.colors,
    fonts: wire.fonts.map(({ sizePt, weight, ...font }) => ({
      ...font,
      ...(sizePt > 0 ? { sizePt } : {}),
      ...(weight > 0 ? { weight } : {})
    })),
    layouts: wire.layouts,
    decorations: wire.decorations.map(({ shape, x, y, w, h, color, description }) => ({
      description,
      ...(shape ? { shape } : {}),
      ...(w > 0 && h > 0 ? { x, y, w, h } : {}),
      ...(color ? { color } : {})
    })),
    slideKinds: wire.slideKinds.map(({ title, ...kind }) => ({
      ...kind,
      ...(title ? { title } : {})
    })),
    voice: wire.voice,
    habits: wire.habits,
    exemplarCandidates: wire.exemplarCandidates,
    ...(wire.problems.length ? { problems: wire.problems } : {})
  }
}

// ---- 4.4 objectives
export const objectivesWire = z.object({
  title: z.string().describe('e.g. "Y8 Science — Photosynthesis"'),
  subject: z.string().describe('or ""'),
  yearGroup: z.string().describe('or ""'),
  objectives: z.array(z.string()).describe('learning objectives, verbatim'),
  context: z.string().describe('anything else the teacher said about the lesson, or ""')
})

export function toObjectives(wire: z.infer<typeof objectivesWire>): ExtractedObjectives {
  return {
    title: wire.title,
    ...(wire.subject ? { subject: wire.subject } : {}),
    ...(wire.yearGroup ? { yearGroup: wire.yearGroup } : {}),
    objectives: wire.objectives,
    ...(wire.context ? { context: wire.context } : {})
  }
}

// ---- 4.5 plan
export const planWire = z.object({
  title: z.string(),
  summary: z.string().describe('one paragraph shown in chat'),
  slides: z.array(
    z.object({
      kind: slideKind,
      layoutId: z.string().describe('id from the profile layouts, or "" with no profile'),
      purpose: z.string(),
      keyContent: z.array(z.string()),
      minutes: numberOrZero('minutes'),
      objectiveRefs: z.array(z.number().int()).describe('0-based indexes of the objectives served')
    })
  )
})

export function toPlan(wire: z.infer<typeof planWire>): LessonPlan {
  return {
    title: wire.title,
    summary: wire.summary,
    slides: wire.slides.map(({ minutes, ...slide }) => ({
      ...slide,
      ...(minutes > 0 ? { minutes } : {})
    }))
  }
}

// ---- 4.3 correction
export const patchWire = z.object({
  patch: z.array(
    z.object({
      op: z.enum(['add', 'replace', 'remove']),
      path: z
        .string()
        .describe('JSON Pointer into the style profile, e.g. /tokens/colors/accent/hex'),
      valueJson: z.string().describe('the new value as JSON text; "" for remove')
    })
  ),
  message: z.string().describe('one friendly sentence saying what changed')
})

export type PatchWire = z.infer<typeof patchWire>
