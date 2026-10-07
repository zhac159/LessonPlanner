import type { PluginTint } from '@shared/contracts/deck-builder-plugins'

/** The tones of the CardHeaderBand a plugin tint can map to (a subset of its `BandTone`). */
export type PluginBandTone = 'peach' | 'sky' | 'mint' | 'butter' | 'purple'

/** The CardHeaderBand tone that matches a plugin's tint (the manifest says `purple-soft`, the band `purple`). */
export function bandToneFor(tint: PluginTint): PluginBandTone {
  return tint === 'purple-soft' ? 'purple' : tint
}
