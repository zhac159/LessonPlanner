/**
 * The editor chat's tools (design/ai-pipeline.md §5): definitions and the code that runs them.
 * Simple tools are `strict`. `apply_changes` and `run_plugin` carry open-ended objects (deck operations,
 * plugin inputs) that strict schemas cannot express, so their inputs are validated here and by `applyOps`.
 */
import { z } from 'zod'
import type { ChangeSet, DeckOp } from '@shared/deck/types'
import type { ChatAssets, ChatPlugins, ChatSink } from '@shared/ai/types'
import { stableStringify } from '../json'
import type { ToolParam, ToolUseBlock } from '../sdk'
import { pngBlock } from '../calls/deps'
import { LIST_ASSETS, PLACE_ASSET, runAssetTool } from './assetTools'
import { invalidInput, text, tool, type ToolOutcome } from './toolKit'

export type { ToolOutcome } from './toolKit'

const OP_NAMES = [
  'insertSlides',
  'deleteSlides',
  'moveSlide',
  'replaceSlide',
  'updateSlide',
  'addElement',
  'updateElement',
  'removeElement',
  'setMeta'
]

const READ_SLIDES = tool(
  'read_slides',
  'Returns the full JSON of the given slides. Use it for slides whose details were not included in the message.',
  { slideIds: { type: 'array', items: { type: 'string' } } },
  ['slideIds'],
  true
)
const VIEW_SLIDE = tool(
  'view_slide',
  'Renders one slide to an image so you can check how it looks (layout, overflow, overlap). Use after visual changes.',
  { slideId: { type: 'string' } },
  ['slideId'],
  true
)
const APPLY_CHANGES = tool(
  'apply_changes',
  'Validates and applies deck operations as ONE change (one undo step for the teacher). Returns { ok, changeSetId } or { ok: false, errors } to fix.',
  {
    summary: {
      type: 'string',
      description: 'One short sentence describing the change, e.g. "Shortened slide 3".'
    },
    ops: {
      type: 'array',
      description: 'Deck operations, exactly as described in the deck model.',
      items: {
        type: 'object',
        properties: { op: { type: 'string', enum: OP_NAMES } },
        required: ['op']
      }
    }
  },
  ['summary', 'ops'],
  false
)
const RUN_PLUGIN = tool(
  'run_plugin',
  'Runs a plugin the teacher asked for in words (e.g. a quiz) with sensible defaults for its inputs. Call list_plugins first if unsure.',
  { pluginId: { type: 'string' }, inputs: { type: 'object', description: 'The plugin inputs.' } },
  ['pluginId', 'inputs'],
  false
)
const LIST_PLUGINS = tool(
  'list_plugins',
  'Lists the enabled plugins and their input schemas.',
  {},
  [],
  true
)

/**
 * Tool list for a turn (plugin tools only when a plugin bridge exists, asset tools only when the library is
 * reachable). Order is fixed: the list is cached.
 */
export const toolsFor = (hasPlugins: boolean, hasAssets = false): ToolParam[] => [
  READ_SLIDES,
  VIEW_SLIDE,
  APPLY_CHANGES,
  ...(hasAssets ? [LIST_ASSETS, PLACE_ASSET] : []),
  ...(hasPlugins ? [RUN_PLUGIN, LIST_PLUGINS] : [])
]

export const STEP_LABELS: Record<string, string> = {
  read_slides: 'Reading the slides',
  view_slide: 'Checking how it looks',
  apply_changes: 'Making the changes',
  run_plugin: 'Running the plugin',
  list_plugins: 'Checking the plugins',
  list_assets: 'Looking through your assets',
  place_asset: 'Placing the picture'
}

export interface ToolHost {
  sink: ChatSink
  now: () => Date
  readSlides: (slideIds: string[]) => unknown
  viewSlide: (slideId: string) => Promise<Uint8Array>
  applyOps: (
    summary: string,
    ops: DeckOp[]
  ) => Promise<{ ok: true; changeSetId: string } | { ok: false; errors: string[] }>
  plugins?: ChatPlugins
  assets?: ChatAssets
}

const readInput = z.object({ slideIds: z.array(z.string()) })
const viewInput = z.object({ slideId: z.string() })
const applyInput = z.object({
  summary: z.string(),
  ops: z.array(z.looseObject({ op: z.string() })).min(1)
})
const pluginInput = z.object({ pluginId: z.string(), inputs: z.record(z.string(), z.unknown()) })

async function applyChanges(block: ToolUseBlock, host: ToolHost): Promise<ToolOutcome> {
  const parsed = applyInput.safeParse(block.input)
  if (!parsed.success) return invalidInput(block.id, parsed.error)
  const { summary, ops } = parsed.data
  const outcome = await host.applyOps(summary, ops as unknown as DeckOp[])
  if (!outcome.ok) {
    return {
      rejected: true,
      result: text(
        block.id,
        stableStringify({
          ok: false,
          errors: outcome.errors,
          hint: 'Nothing was changed. Fix these and call apply_changes once more.'
        }),
        true
      )
    }
  }
  const changeSet: ChangeSet = {
    id: outcome.changeSetId,
    by: 'ai',
    summary,
    ops: ops as unknown as DeckOp[],
    at: host.now().toISOString()
  }
  host.sink.changes(changeSet)
  return {
    rejected: false,
    result: text(block.id, stableStringify({ ok: true, changeSetId: outcome.changeSetId }))
  }
}

async function execute(block: ToolUseBlock, host: ToolHost): Promise<ToolOutcome> {
  switch (block.name) {
    case 'read_slides': {
      const parsed = readInput.safeParse(block.input)
      if (!parsed.success) return invalidInput(block.id, parsed.error)
      return {
        rejected: false,
        result: text(block.id, stableStringify(host.readSlides(parsed.data.slideIds)))
      }
    }
    case 'view_slide': {
      const parsed = viewInput.safeParse(block.input)
      if (!parsed.success) return invalidInput(block.id, parsed.error)
      const png = await host.viewSlide(parsed.data.slideId)
      return {
        rejected: false,
        result: { type: 'tool_result', tool_use_id: block.id, content: [pngBlock(png) as never] }
      }
    }
    case 'apply_changes':
      return applyChanges(block, host)
    case 'list_assets':
    case 'place_asset':
      if (!host.assets) break
      return runAssetTool(block, host.assets, host.sink)
    case 'list_plugins':
      if (!host.plugins) break
      return { rejected: false, result: text(block.id, stableStringify(host.plugins.list())) }
    case 'run_plugin': {
      if (!host.plugins) break
      const parsed = pluginInput.safeParse(block.input)
      if (!parsed.success) return invalidInput(block.id, parsed.error)
      const result = await host.plugins.run(parsed.data.pluginId, parsed.data.inputs)
      return { rejected: false, result: text(block.id, stableStringify(result)) }
    }
  }
  return { rejected: false, result: text(block.id, `Unknown tool: ${block.name}`, true) }
}

/**
 * Runs one tool call and reports it to the UI as a progress step. A tool that throws becomes an error
 * `tool_result` (the model can recover); it never aborts the turn.
 */
export async function runTool(block: ToolUseBlock, host: ToolHost): Promise<ToolOutcome> {
  const label = STEP_LABELS[block.name] ?? 'Working'
  host.sink.status(label, 'running')
  try {
    const outcome = await execute(block, host)
    host.sink.status(label, outcome.result.is_error ? 'error' : 'done')
    return outcome
  } catch (error) {
    host.sink.status(label, 'error')
    const message = error instanceof Error ? error.message : 'unknown error'
    return {
      rejected: block.name === 'apply_changes',
      result: text(block.id, `Tool failed: ${message}`, true)
    }
  }
}
