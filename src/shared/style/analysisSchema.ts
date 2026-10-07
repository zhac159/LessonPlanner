/** Runtime validation for a stored per-file analysis (`sources/<id>.analysis.json`). Pure zod. */
import { z } from 'zod'
import type { FileAnalysis } from '../ai/types'
import { slideKindSchema } from './schema'

const box = { x: z.number(), y: z.number(), w: z.number(), h: z.number() }

export const fileAnalysisSchema = z.object({
  colors: z.array(
    z.object({
      hex: z.string(),
      role: z.enum(['background', 'text', 'accent', 'highlight', 'chip', 'other']),
      evidence: z.string(),
      frequency: z.enum(['most', 'many', 'some'])
    })
  ),
  fonts: z.array(
    z.object({
      family: z.string(),
      usedFor: z.enum(['title', 'body', 'other']),
      sizePt: z.number().optional(),
      weight: z.number().optional()
    })
  ),
  layouts: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      regions: z.array(z.object({ name: z.string(), elementType: z.string(), ...box })),
      pages: z.array(z.number())
    })
  ),
  decorations: z.array(
    z.object({
      description: z.string(),
      shape: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      w: z.number().optional(),
      h: z.number().optional(),
      color: z.string().optional()
    })
  ),
  slideKinds: z.array(
    z.object({ page: z.number(), kind: slideKindSchema, title: z.string().optional() })
  ),
  voice: z.object({
    rules: z.array(z.string()),
    phrases: z.array(z.string()),
    spelling: z.enum(['en-GB', 'en-US', 'unknown'])
  }),
  habits: z.array(z.string()),
  exemplarCandidates: z.array(z.object({ page: z.number(), why: z.string() })),
  problems: z.array(z.string()).optional()
}) satisfies z.ZodType<FileAnalysis>

/** Parses unknown data into a FileAnalysis; throws a ZodError when it does not fit. */
export const parseFileAnalysis = (raw: unknown): FileAnalysis => fileAnalysisSchema.parse(raw)
