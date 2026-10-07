/**
 * Finds the plugin folders of src/plugins with `import.meta.glob`, like src/main/modules.ts does for modules.
 * A folder starting with "_" is ignored (the easy way to switch a plugin off).
 */
import { PluginRegistry } from './registry'
import type { Logger } from '../lessons/types'

const manifests = import.meta.glob([
  '../../../plugins/*/manifest.ts',
  '!../../../plugins/_*/manifest.ts'
])
const runs = import.meta.glob(['../../../plugins/*/run.ts', '!../../../plugins/_*/run.ts'])

/** A registry over every plugin in src/plugins (call `load()` before use). */
export const createPluginRegistry = (log?: Logger): PluginRegistry =>
  new PluginRegistry({ manifests, runs }, log)
