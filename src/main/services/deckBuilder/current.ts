/**
 * The running deck-builder services, published by the module's `main.ts` when it activates so that other
 * main-process code (the dev seeds, quit handling) can reach the SAME instances instead of building second ones.
 */
import type { EmitEvent } from '../lessons/types'
import type { DeckBuilderServices } from './services'

export interface CurrentDeckBuilder {
  services: DeckBuilderServices
  emit: EmitEvent
}

let current: CurrentDeckBuilder | null = null

/** Called by the module on activation (null on deactivation). */
export function setCurrentDeckBuilder(next: CurrentDeckBuilder | null): void {
  current = next
}

/** The active services, or null before the module has activated. */
export function getCurrentDeckBuilder(): CurrentDeckBuilder | null {
  return current
}
