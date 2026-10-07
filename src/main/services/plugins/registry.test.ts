import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { tempDir } from '../lessons/testing'
import { createPluginRegistry } from './discover'
import { PluginInputsStore } from './inputsStore'
import { PluginRegistry } from './registry'
import { demoPlugin, inlineSources, manifestOf } from './testing'

const noop = async () => undefined

async function load(
  plugins: Parameters<typeof inlineSources>[0],
  extra?: {
    manifests?: Record<string, () => Promise<unknown>>
    runs?: Record<string, () => Promise<unknown>>
  }
) {
  const sources = inlineSources(plugins)
  const errors: string[] = []
  const registry = new PluginRegistry(
    {
      manifests: { ...sources.manifests, ...extra?.manifests },
      runs: { ...sources.runs, ...extra?.runs }
    },
    { warn: () => undefined, error: (m) => errors.push(m) }
  )
  await registry.load()
  return { registry, errors }
}

describe('PluginRegistry', () => {
  it('pairs each manifest with its run.ts and lists plugins in display order', async () => {
    const { registry, errors } = await load([
      demoPlugin('zeta', noop, { order: 1 }),
      demoPlugin('alpha', noop, { order: 5 }),
      demoPlugin('beta', noop),
      demoPlugin('aardvark', noop)
    ])
    expect(registry.list().map((p) => [p.id, p.order])).toEqual([
      ['zeta', 1],
      ['alpha', 5],
      ['aardvark', 1000],
      ['beta', 1000]
    ])
    expect(registry.issues).toEqual([])
    expect(errors).toEqual([])
  })

  it('lists the menu row from the manifest and hides internals from the view', async () => {
    const { registry } = await load([
      demoPlugin('demo', noop, {
        inputs: [{ id: 'b', type: 'boolean', label: 'Flag', default: true }],
        needsSlides: true,
        order: 3
      })
    ])
    expect(registry.list()[0]).toEqual({
      id: 'demo',
      name: 'Demo',
      description: 'Does a demo',
      icon: 'sparkles',
      tint: 'sky',
      scope: 'lesson',
      hasInputs: true,
      needsSlides: true,
      order: 3
    })
    const view = registry.view('demo')
    expect(view).toMatchObject({ id: 'demo', action: 'Run demo', inputs: [{ id: 'b' }] })
    expect(view).not.toHaveProperty('usesStyle')
    expect(registry.view('nope')).toBeUndefined()
    expect(registry.get('demo')?.manifest.id).toBe('demo')
    expect(registry.get('nope')).toBeUndefined()
  })

  it('skips a plugin whose file throws when imported and still loads the others', async () => {
    const { registry, errors } = await load([demoPlugin('good', noop)], {
      manifests: {
        '../../../plugins/broken/manifest.ts': async () => {
          throw new Error('SyntaxError in manifest')
        }
      },
      runs: {
        '../../../plugins/broken/run.ts': async () => ({ default: { id: 'broken', run: noop } })
      }
    })
    expect(registry.list().map((p) => p.id)).toEqual(['good'])
    expect(registry.issues.map((i) => i.moduleId).sort()).toEqual(['broken', 'broken'])
    expect(registry.issues.find((i) => i.message.includes('SyntaxError'))?.path).toBe(
      '../../../plugins/broken/manifest.ts'
    )
    expect(errors.some((e) => e.includes('Skipped plugin "broken"'))).toBe(true)
  })

  it.each([
    ['an invalid id', manifestOf('Bad_Id'), 'Bad_Id', /invalid plugin id|Invalid module id/i],
    ['a long name', manifestOf('longname', { name: 'Way too long name' }), 'longname', /name/],
    [
      'a long description',
      manifestOf('longdesc', { description: 'x'.repeat(60) }),
      'longdesc',
      /description/
    ],
    [
      'an input with a default outside its range',
      manifestOf('badnum', {
        inputs: [
          {
            id: 'n',
            type: 'number',
            label: 'N',
            min: 1,
            max: 5,
            step: 1,
            default: 9,
            decrementLabel: 'less',
            incrementLabel: 'more'
          }
        ]
      }),
      'badnum',
      /default is outside/
    ]
  ])('skips a manifest with %s', async (_label, manifest, id, message) => {
    const { registry } = await load([{ id, manifest, run: { id, run: noop } }])
    expect(registry.list()).toEqual([])
    expect(registry.issues[0].message).toMatch(message)
  })

  it('skips a manifest with no run.ts, and a run.ts with no manifest', async () => {
    const { registry } = await load([
      { id: 'norun', manifest: manifestOf('norun') },
      { id: 'nomanifest', manifest: undefined, run: { id: 'nomanifest', run: noop } },
      demoPlugin('fine', noop)
    ])
    expect(registry.list().map((p) => p.id)).toEqual(['fine'])
    const messages = registry.issues.map((i) => `${i.moduleId}: ${i.message}`)
    expect(messages.some((m) => m.startsWith('norun:') && m.includes('no working run.ts'))).toBe(
      true
    )
    expect(messages.some((m) => m.startsWith('nomanifest:'))).toBe(true)
  })

  it('skips a run.ts without a run function and one whose id differs from its folder', async () => {
    const { registry } = await load([
      { id: 'norunfn', manifest: manifestOf('norunfn'), run: { id: 'norunfn' } },
      { id: 'mismatch', manifest: manifestOf('mismatch'), run: { id: 'other', run: noop } }
    ])
    expect(registry.list()).toEqual([])
    expect(registry.issues.length).toBeGreaterThanOrEqual(2)
    expect(registry.issues.some((i) => i.message.includes('run() function'))).toBe(true)
  })

  it('reloads cleanly when load() is called again', async () => {
    const { registry } = await load([demoPlugin('a', noop)])
    await registry.load()
    expect(registry.list()).toHaveLength(1)
  })
})

describe('the real plugins in src/plugins', () => {
  it('discovers quiz and speaker-notes with no issues, in menu order', async () => {
    const registry = createPluginRegistry()
    await registry.load()
    expect(registry.issues).toEqual([])
    expect(registry.list().map((p) => p.id)).toEqual(['quiz', 'speaker-notes'])
    expect(registry.list()[0]).toMatchObject({
      name: 'Quiz',
      tint: 'peach',
      hasInputs: true,
      needsSlides: true
    })
    expect(registry.view('quiz')?.action).toBe('Make quiz')
  })
})

describe('PluginInputsStore', () => {
  it('remembers the last inputs per plugin and survives a restart', async () => {
    const file = join(tempDir(), 'plugin-inputs.json')
    const store = new PluginInputsStore(file)
    expect(await store.get('quiz')).toBeNull()
    await Promise.all([store.set('quiz', { count: 5 }), store.set('notes', { length: 'full' })])
    expect(await new PluginInputsStore(file).get('quiz')).toEqual({ count: 5 })
    expect(await store.get('notes')).toEqual({ length: 'full' })
    await store.set('quiz', { count: 8 })
    expect(await store.get('quiz')).toEqual({ count: 8 })
  })

  it('treats a damaged file as empty', async () => {
    const file = join(tempDir(), 'x.json')
    writeFileSync(file, '[1,2')
    const store = new PluginInputsStore(file)
    expect(await store.get('quiz')).toBeNull()
    await store.set('quiz', { a: 1 })
    expect(await store.get('quiz')).toEqual({ a: 1 })
  })
})
