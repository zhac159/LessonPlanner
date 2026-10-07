/**
 * What the "Add a picture maker" section says about a key check (agents/ASSETS.md §3.7, A7). Pure: the pill and the
 * helper line. The check is free (it lists Google's models), so a key can pass and still fail later when billing
 * is off; `FREE_TEST_NOTE` says so before and after the check.
 */
import type { TestOutcome } from './outcome'

export interface PictureOutcomeCopy {
  pill: string
  /** Helper line under the test row; null when there is nothing to add. */
  helper: string | null
}

/** Always shown under the test button. Honest about what a test can and cannot see. */
export const FREE_TEST_NOTE =
  'Testing is free: it only checks the key. Picture making needs a paid Google project (the image models have no free tier), and Google only says if billing is off when it makes a picture.'

/** The pill and helper for a test outcome; messages follow the A7 copy. */
export function pictureOutcomeCopy(outcome: TestOutcome): PictureOutcomeCopy {
  switch (outcome) {
    case 'connected':
      return { pill: 'Connected', helper: null }
    case 'invalid-key':
    case 'no-key':
      return { pill: 'Key not accepted', helper: 'Google didn’t accept that key.' }
    case 'no-credit':
      return {
        pill: 'No credit',
        helper:
          'Google says this key has no credit. Picture makers need a paid Google project (a $5 top-up).'
      }
    case 'rate-limited':
    case 'overloaded':
      return { pill: 'Google is busy', helper: 'Google is busy. Try again in a minute.' }
    case 'network':
      return { pill: 'Can’t reach Google', helper: 'Couldn’t reach Google. Check your internet.' }
    case 'model-unavailable':
      return {
        pill: 'Not on this key',
        helper: 'That picture maker isn’t available on this key.'
      }
    case 'permission':
      return {
        pill: 'Not allowed',
        helper: 'This Google key isn’t allowed to make pictures (or not in your country yet).'
      }
    default:
      return {
        pill: 'Something went wrong',
        helper: 'Try again. If it keeps happening, create a new key in Google AI Studio.'
      }
  }
}
