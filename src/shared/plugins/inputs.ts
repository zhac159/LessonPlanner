/**
 * Plugin inputs: defaults and validation against the manifest (design/plugin-architecture.md §4).
 * The renderer builds the form from the manifest; main validates again with this, because the
 * renderer is not trusted to send well-formed values.
 */
import { fail, ok, type Result } from '../result'
import type { PluginInput, PluginManifest } from './manifest'

export type PluginInputs = Record<string, unknown>

/** The value a field starts with. Text fields start empty. */
export function defaultValue(input: PluginInput): unknown {
  return input.type === 'text' ? '' : input.default
}

/** Every input at its default. */
export function defaultInputs(manifest: Pick<PluginManifest, 'inputs'>): PluginInputs {
  return Object.fromEntries(manifest.inputs.map((input) => [input.id, defaultValue(input)]))
}

type Checked = { value: unknown } | { error: string }

const bad = (input: PluginInput, why: string): Checked => ({ error: `${input.label}: ${why}` })

function check(input: PluginInput, raw: unknown): Checked {
  switch (input.type) {
    case 'slideRange':
      return raw === 'all' || raw === 'selected' || raw === 'current'
        ? { value: raw }
        : bad(input, 'choose all, selected or current')
    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return bad(input, 'enter a number')
      const stepped = Math.round((raw - input.min) / input.step) * input.step + input.min
      const clamped = Math.min(input.max, Math.max(input.min, stepped))
      return { value: Number(clamped.toFixed(6)) }
    }
    case 'multi': {
      if (!Array.isArray(raw) || !raw.every((v) => typeof v === 'string'))
        return bad(input, 'choose from the list')
      const allowed = new Set(input.options.map((o) => o.value))
      if (!raw.every((v) => allowed.has(v)))
        return bad(input, 'one of the choices is not available')
      const picked = [...new Set(raw)]
      return picked.length >= (input.minSelected ?? 0)
        ? { value: picked }
        : bad(input, `choose at least ${input.minSelected}`)
    }
    case 'choice':
      return typeof raw === 'string' && input.options.some((o) => o.value === raw)
        ? { value: raw }
        : bad(input, 'choose one of the options')
    case 'text': {
      if (typeof raw !== 'string') return bad(input, 'enter some text')
      const text = raw.trim()
      if (input.required && !text) return bad(input, 'this is required')
      if (input.maxLength !== undefined && text.length > input.maxLength)
        return bad(input, `use at most ${input.maxLength} characters`)
      return { value: text }
    }
    case 'boolean':
      return typeof raw === 'boolean' ? { value: raw } : bad(input, 'choose yes or no')
  }
}

/**
 * Validates `raw` against the manifest: unknown keys are dropped, missing ones take their default, any
 * wrong value is an `invalid-input` failure naming the field.
 */
export function validateInputs(
  manifest: Pick<PluginManifest, 'inputs'>,
  raw: unknown
): Result<{ inputs: PluginInputs }> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    return fail('invalid-input', 'The options are not valid.')
  const given = raw as Record<string, unknown>
  const inputs: PluginInputs = {}
  for (const input of manifest.inputs) {
    const checked = check(input, input.id in given ? given[input.id] : defaultValue(input))
    if ('error' in checked) return fail('invalid-input', checked.error)
    inputs[input.id] = checked.value
  }
  return ok({ inputs })
}
