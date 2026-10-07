/**
 * Everything the app checks in code after Claude's synthesis (agents/ASSETS.md §5.7), so a model slip never reaches her style:
 * neutral structural colours (3), no literal dates and an optional `date` slot (4), `uppercase:false` kept explicit for
 * kickers she writes in normal case (5), a test slide about her own subject (6), exemplars of her real slides (7), and
 * which fonts this PC can draw / another PC needs.
 */
import type { FileAnalysis } from '@shared/ai/types'
import type { Slide } from '@shared/deck/types'
import type { ComponentStyle, Exemplar, StyleProfile } from '@shared/style/types'
import { neutraliseColours } from './colours'
import { hasDate, stripDates, stripDatesFromList } from './dates'
import { chooseExemplars } from './exemplars'
import { markFonts, type InstalledFonts } from './fonts'
import { checkTestSlide } from './testSlide'

/** The rule that replaces copied dates: the date is a slot filled from the lesson brief. */
export const DATE_SLOT_RULE =
  'Write a date only when the lesson brief gives one; never copy a date from an example.'

const isDateRegion = (name: string): boolean => /\bdate\b/i.test(name)

/** Sample kicker texts: the kicker lines of her real slides, else the short "Word:" phrases she writes. */
function kickerSamples(exemplars: readonly Exemplar[], profile: StyleProfile): string[] {
  const fromSlides = exemplars.flatMap((e) =>
    e.digest.elements.flatMap((el) =>
      el.type === 'text' && el.role === 'kicker'
        ? el.paragraphs.map((p) =>
            p.runs
              .map((r) => r.text)
              .join('')
              .trim()
          )
        : []
    )
  )
  if (fromSlides.length) return fromSlides
  return profile.voice.phrases.filter((p) => /^[^\n]{1,24}:$/.test(p.trim()))
}

/** `uppercase` is true only when every sampled kicker is written in capitals; otherwise it is an explicit false. */
function withKickerCase(
  components: StyleProfile['components'],
  samples: readonly string[]
): StyleProfile['components'] {
  const usable = samples.filter((s) => /[a-z]/i.test(s))
  if (usable.length === 0) return components
  const allCaps = usable.every((s) => s === s.toUpperCase())
  return Object.fromEntries(
    Object.entries(components).map(([key, style]): [string, ComponentStyle] => [
      key,
      key === 'kicker' || key.startsWith('kicker.') ? { ...style, uppercase: allCaps } : style
    ])
  )
}

function withDateSlot(profile: StyleProfile, hadDates: boolean): StyleProfile {
  const layouts = profile.layouts.map((layout) => ({
    ...layout,
    regions: layout.regions.map((r) => (isDateRegion(r.name) ? { ...r, optional: true } : r))
  }))
  const hasSlot = layouts.some((l) => l.regions.some((r) => isDateRegion(r.name)))
  const rules = profile.voice.rules
  const needsRule = (hasSlot || hadDates) && !rules.includes(DATE_SLOT_RULE)
  return {
    ...profile,
    layouts,
    voice: { ...profile.voice, rules: needsRule ? [...rules, DATE_SLOT_RULE] : rules }
  }
}

function withoutDates(profile: StyleProfile): { profile: StyleProfile; hadDates: boolean } {
  const probe = JSON.stringify([
    profile.habits,
    profile.voice,
    profile.slideTypes,
    Object.values(profile.components).flatMap((c) => c.rules ?? [])
  ])
  const hadDates = hasDate(probe)
  const components = Object.fromEntries(
    Object.entries(profile.components).map(([key, c]): [string, ComponentStyle] => [
      key,
      c.rules ? { ...c, rules: stripDatesFromList(c.rules) } : c
    ])
  )
  return {
    hadDates,
    profile: {
      ...profile,
      components,
      habits: stripDatesFromList(profile.habits),
      voice: {
        ...profile.voice,
        rules: stripDatesFromList(profile.voice.rules),
        phrases: stripDatesFromList(profile.voice.phrases)
      },
      slideTypes: profile.slideTypes.map((t) => ({
        ...t,
        description: stripDates(t.description),
        ...(t.exampleText ? { exampleText: stripDates(t.exampleText) } : {})
      }))
    }
  }
}

export interface FinishContext {
  analyses: readonly FileAnalysis[]
  /** Every file's exemplar digests, in queue order: the case of her kickers is read from all of them. */
  exemplars: readonly (readonly Exemplar[])[]
  installedFonts: InstalledFonts
}

/** Applies every defect fix to a synthesised profile and its test slide. `testSlide: null` = draw the neutral template. */
export async function finishSynthesis(
  synthesised: StyleProfile,
  testSlide: Slide,
  ctx: FinishContext
): Promise<{ profile: StyleProfile; testSlide: Slide | null }> {
  const cleaned = withoutDates(synthesised)
  let profile = withDateSlot(cleaned.profile, cleaned.hadDates)
  profile = {
    ...profile,
    tokens: { ...profile.tokens, colors: neutraliseColours(profile.tokens.colors) },
    components: withKickerCase(profile.components, kickerSamples(ctx.exemplars.flat(), profile)),
    exemplars: chooseExemplars(ctx.exemplars)
  }
  profile = await markFonts(profile, ctx.installedFonts)
  return { profile, testSlide: checkTestSlide(testSlide, profile, ctx.analyses) }
}
