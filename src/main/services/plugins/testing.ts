/** Test-only builders for the plugin services: a registry from inline plugins, a runner on a lessons rig. */
import { join } from 'node:path'
import type { PluginManifest } from '@shared/plugins/manifest'
import type { PluginDefinition } from '@shared/plugins/types'
import { makeServicesRig, type ServicesRig } from '../chat/testing'
import type { FakeAiOptions } from '../../ai/fake'
import { createPluginRegistry } from './discover'
import { PluginInputsStore } from './inputsStore'
import { PluginRegistry } from './registry'
import { PluginRunner } from './runner'

export interface PluginRig extends ServicesRig {
  registry: PluginRegistry
  runner: PluginRunner
  inputs: PluginInputsStore
}

/** Loaders for plugins given as objects (what `import.meta.glob` would return). */
export function inlineSources(
  plugins: Array<{ manifest: unknown; run?: unknown; id: string }>
): ConstructorParameters<typeof PluginRegistry>[0] {
  const manifests: Record<string, () => Promise<unknown>> = {}
  const runs: Record<string, () => Promise<unknown>> = {}
  for (const p of plugins) {
    manifests[`../../../plugins/${p.id}/manifest.ts`] = async () => ({ default: p.manifest })
    if (p.run !== undefined)
      runs[`../../../plugins/${p.id}/run.ts`] = async () => ({ default: p.run })
  }
  return { manifests, runs }
}

/** A minimal valid manifest. */
export function manifestOf(id: string, over: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id,
    name: 'Demo',
    title: 'Demo plugin',
    description: 'Does a demo',
    icon: 'sparkles',
    tint: 'sky',
    scope: 'lesson',
    inputs: [],
    output: ['message'],
    action: 'Run demo',
    needsSlides: false,
    usesStyle: true,
    ...over
  }
}

/** A lesson (photosynthesis fixture) with a runner over `registry` (the real plugins when omitted). */
export async function makePluginRig(
  options: { registry?: PluginRegistry; fake?: FakeAiOptions } = {}
): Promise<PluginRig> {
  const rig = await makeServicesRig({ fake: options.fake })
  const registry = options.registry ?? createPluginRegistry()
  await registry.load()
  const inputs = new PluginInputsStore(join(rig.dir, 'plugin-inputs.json'))
  const runner = new PluginRunner({
    registry,
    lessons: rig.service,
    ai: rig.ai,
    chatLog: rig.store,
    inputs,
    emit: rig.emit
  })
  return { ...rig, registry, runner, inputs }
}

/** An in-memory plugin: `run` is the whole implementation. */
export function demoPlugin(
  id: string,
  run: PluginDefinition['run'],
  manifest: Partial<PluginManifest> = {}
): { id: string; manifest: PluginManifest; run: PluginDefinition } {
  return { id, manifest: manifestOf(id, manifest), run: { id, run } }
}
