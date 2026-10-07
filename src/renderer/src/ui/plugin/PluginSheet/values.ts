import type { PluginInput } from '@shared/contracts/deck-builder-plugins'

/** The editor state the sheet needs to word "Which slides?" (slide numbers are 1-based). */
export interface SlideContext {
  /** Slides in the lesson. */
  total: number
  /** The slide on the stage. */
  current: number
  /** Slides selected in the filmstrip (the current slide when only one is selected). */
  selected: number[]
}

export type SlideRangeValue = 'all' | 'selected' | 'current'

export interface SlideRangeOption {
  value: SlideRangeValue
  label: string
}

/** Values keyed by input id: string, string[], number or boolean by input type. */
export type FormValues = Record<string, unknown>

/** Error messages keyed by input id; absent when the field is valid. */
export type FormErrors = Record<string, string>

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many)

function selectedLabel(selected: number[]): string {
  const sorted = [...new Set(selected)].sort((a, b) => a - b)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const contiguous = last - first + 1 === sorted.length
  return contiguous ? `Slides ${first}–${last}` : `${sorted.length} selected slides`
}

/**
 * The "Which slides?" options, computed from the editor (07 §8): "All {n} slides", "Slides {a}–{b}"
 * or "{m} selected slides" only when more than one slide is selected, and "Just slide {k}". A
 * one-slide lesson has just "Just slide 1"; an empty lesson has none.
 */
export function slideRangeOptions(slides: SlideContext): SlideRangeOption[] {
  if (slides.total <= 0) return []
  const current: SlideRangeOption = { value: 'current', label: `Just slide ${slides.current}` }
  if (slides.total === 1) return [current]
  const options: SlideRangeOption[] = [
    { value: 'all', label: `All ${slides.total} ${plural(slides.total, 'slide', 'slides')}` }
  ]
  if (new Set(slides.selected).size > 1) {
    options.push({ value: 'selected', label: selectedLabel(slides.selected) })
  }
  options.push(current)
  return options
}

/** The slide range chosen when the teacher has not touched the field. */
function defaultSlideRange(
  options: SlideRangeOption[],
  manifestDefault: SlideRangeValue
): SlideRangeValue {
  const has = (value: SlideRangeValue): boolean => options.some((o) => o.value === value)
  if (has('selected')) return 'selected'
  if (has(manifestDefault)) return manifestDefault
  return options[0]?.value ?? manifestDefault
}

const isString = (value: unknown): value is string => typeof value === 'string'

/** A previously used value if it still fits the input, else undefined. */
function reuse(input: PluginInput, last: unknown): unknown {
  switch (input.type) {
    case 'choice':
      return isString(last) && input.options.some((o) => o.value === last) ? last : undefined
    case 'multi': {
      if (!Array.isArray(last)) return undefined
      return input.options.map((o) => o.value).filter((v) => last.includes(v))
    }
    case 'number':
      return typeof last === 'number' && Number.isFinite(last)
        ? Math.min(input.max, Math.max(input.min, last))
        : undefined
    case 'text':
      return isString(last) ? last.slice(0, input.maxLength ?? last.length) : undefined
    case 'boolean':
      return typeof last === 'boolean' ? last : undefined
    case 'slideRange':
      return undefined
  }
}

/**
 * The form's starting values: the manifest defaults, overlaid with the values last used for this
 * plugin when they still fit (unknown or malformed ones are ignored). "Which slides?" always
 * follows the current selection, never a previous run.
 */
export function initialValues(
  inputs: PluginInput[],
  slides: SlideContext,
  last?: Record<string, unknown> | null
): FormValues {
  const options = slideRangeOptions(slides)
  const values: FormValues = {}
  for (const input of inputs) {
    const base =
      input.type === 'slideRange'
        ? defaultSlideRange(options, input.default)
        : input.type === 'text'
          ? ''
          : input.default
    values[input.id] = reuse(input, last?.[input.id]) ?? base
  }
  return values
}

/** Keeps "Which slides?" valid when the selection changes under an open sheet. */
export function reconcileSlideRanges(
  inputs: PluginInput[],
  values: FormValues,
  slides: SlideContext,
  previous: SlideContext
): FormValues {
  const options = slideRangeOptions(slides)
  const before = slideRangeOptions(previous)
  const next = { ...values }
  for (const input of inputs) {
    if (input.type !== 'slideRange') continue
    const chosen = values[input.id]
    const stillThere = options.some((o) => o.value === chosen)
    // A new multi-selection selects its option (07 §7); a lost option falls back to a valid one.
    const gained =
      options.some((o) => o.value === 'selected') && !before.some((o) => o.value === 'selected')
    if (gained || !stillThere) next[input.id] = defaultSlideRange(options, input.default)
  }
  return next
}

/** Checks every input and returns the messages of the invalid ones (empty when all are fine). */
export function validate(
  inputs: PluginInput[],
  values: FormValues,
  slides: SlideContext
): FormErrors {
  const errors: FormErrors = {}
  for (const input of inputs) {
    const value = values[input.id]
    switch (input.type) {
      case 'slideRange':
        if (!slideRangeOptions(slides).some((o) => o.value === value)) {
          errors[input.id] = 'There are no slides to use.'
        }
        break
      case 'choice':
        if (!input.options.some((o) => o.value === value)) errors[input.id] = 'Choose one.'
        break
      case 'multi': {
        const need = input.minSelected ?? 0
        const count = Array.isArray(value) ? value.length : 0
        if (count < need) {
          errors[input.id] = need === 1 ? 'Pick at least one.' : `Pick at least ${need}.`
        }
        break
      }
      case 'number':
        if (typeof value !== 'number' || value < input.min || value > input.max) {
          errors[input.id] = `Choose between ${input.min} and ${input.max}.`
        }
        break
      case 'text': {
        const text = isString(value) ? value : ''
        if (input.required && text.trim() === '') errors[input.id] = 'Please fill this in.'
        else if (input.maxLength !== undefined && text.length > input.maxLength) {
          errors[input.id] = `Keep it to ${input.maxLength} characters or fewer.`
        }
        break
      }
      case 'boolean':
        break
    }
  }
  return errors
}

/** "Make quiz" becomes "Making quiz…"; any other label just gains an ellipsis. */
export function progressLabel(action: string): string {
  const label = action.trim().replace(/…$/, '')
  return /^make\b/i.test(label) ? `Making${label.slice(4)}…` : `${label}…`
}
