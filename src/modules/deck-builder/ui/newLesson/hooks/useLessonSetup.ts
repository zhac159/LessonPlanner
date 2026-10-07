import { useCallback, useEffect, useReducer } from 'react'
import { useClient } from '@renderer/sdk'
import { SETTINGS, type SettingsApi } from '@shared/contracts/settings'
import type { DocumentReadResult } from '@shared/contracts/deck-builder'
import { detectDuration, detectYearGroup, normaliseYearGroup } from '../detect'
import { initialSetup, setupReducer, type ChipKey, type LessonSetup } from '../setup'

export interface LessonSetupState {
  setup: LessonSetup
  /** The teacher picked a chip. */
  choose(key: ChipKey, value: string | number): void
  /** Guesses the year group and length from the typed text (only chips she has not touched move). */
  detectFrom(text: string): void
  /** Takes the year group and length Claude found in an attached document (same rule). */
  detectFromDocument(result: DocumentReadResult): void
  /** Saves the choices as the defaults for the next lesson (05 §6). */
  remember(): void
}

/**
 * The set-up chips: defaults from the saved preferences, guesses from the text, and the teacher's own
 * choices, in that order of priority (05 §8.1, §8.2, §8.4).
 */
export function useLessonSetup(): LessonSetupState {
  const settings = useClient<SettingsApi>(SETTINGS)
  const [state, dispatch] = useReducer(setupReducer, undefined, initialSetup)

  useEffect(() => {
    let live = true
    settings
      .getPreferences()
      .then(
        (prefs) =>
          live &&
          dispatch({
            type: 'defaults',
            yearGroup: normaliseYearGroup(prefs.lastYearGroup),
            durationMin: prefs.lastLengthMin,
            ability: prefs.lastAbility
          })
      )
      .catch(() => {})
    return () => {
      live = false
    }
  }, [settings])

  const choose = useCallback(
    (key: ChipKey, value: string | number) => dispatch({ type: 'user', key, value }),
    []
  )
  const detectFrom = useCallback((text: string) => {
    const yearGroup = detectYearGroup(text)
    const durationMin = detectDuration(text)
    if (yearGroup || durationMin) dispatch({ type: 'detected', yearGroup, durationMin })
  }, [])
  const detectFromDocument = useCallback((result: DocumentReadResult) => {
    dispatch({
      type: 'detected',
      yearGroup: normaliseYearGroup(result.yearGroup),
      durationMin: result.durationMin
    })
  }, [])

  const { values } = state
  const remember = useCallback(() => {
    settings
      .setPreferences({
        lastYearGroup: values.yearGroup,
        lastLengthMin: values.durationMin,
        lastAbility: values.ability
      })
      .catch(() => {})
  }, [settings, values])

  return { setup: values, choose, detectFrom, detectFromDocument, remember }
}
