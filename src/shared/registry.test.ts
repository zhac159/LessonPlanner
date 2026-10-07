import { describe, expect, it } from 'vitest'
import { folderIdFromPath, loadModules, MODULE_ID_PATTERN } from './registry'

interface Def {
  id: string
  order?: number
}

const ok = (def: unknown) => async () => ({ default: def })

describe('folderIdFromPath', () => {
  it('extracts the module folder from glob keys', () => {
    expect(folderIdFromPath('../../../modules/home/ui.tsx')).toBe('home')
    expect(folderIdFromPath('../modules/deck-builder/main.ts')).toBe('deck-builder')
    expect(folderIdFromPath('src\\modules\\home\\ui.tsx')).toBe('home')
  })

  it('returns null for paths outside a module folder', () => {
    expect(folderIdFromPath('src/main/index.ts')).toBeNull()
  })
})

describe('MODULE_ID_PATTERN', () => {
  it('accepts kebab-case ids and rejects everything else', () => {
    for (const good of ['home', 'deck-builder', 'ai2', 'a-b-c', 'v2-editor'])
      expect(MODULE_ID_PATTERN.test(good)).toBe(true)
    for (const bad of ['', 'Home', '1home', 'my_module', 'a b', '-x', 'x-', 'a--b', 'a-b-']) {
      expect(MODULE_ID_PATTERN.test(bad)).toBe(false)
    }
  })
})

describe('loadModules', () => {
  it('loads valid modules and sorts them with the supplied comparator', async () => {
    const { modules, issues } = await loadModules<Def>(
      {
        '../modules/zeta/ui.tsx': ok({ id: 'zeta', order: 1 }),
        '../modules/alpha/ui.tsx': ok({ id: 'alpha', order: 2 })
      },
      { kind: 'ui', compare: (a, b) => (a.order ?? 0) - (b.order ?? 0) }
    )
    expect(issues).toEqual([])
    expect(modules.map((m) => m.id)).toEqual(['zeta', 'alpha'])
  })

  it('sorts alphabetically by default', async () => {
    const { modules } = await loadModules<Def>(
      {
        '../modules/zeta/ui.tsx': ok({ id: 'zeta' }),
        '../modules/alpha/ui.tsx': ok({ id: 'alpha' })
      },
      { kind: 'ui' }
    )
    expect(modules.map((m) => m.id)).toEqual(['alpha', 'zeta'])
  })

  it('isolates a module that throws while loading', async () => {
    const { modules, issues } = await loadModules<Def>(
      {
        '../modules/good/ui.tsx': ok({ id: 'good' }),
        '../modules/broken/ui.tsx': async () => {
          throw new Error('boom')
        }
      },
      { kind: 'ui' }
    )
    expect(modules.map((m) => m.id)).toEqual(['good'])
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ moduleId: 'broken' })
    expect(issues[0].message).toContain('boom')
  })

  it('isolates a loader that throws synchronously', async () => {
    const { modules, issues } = await loadModules<Def>(
      {
        '../modules/sync/ui.tsx': () => {
          throw new Error('sync boom')
        }
      },
      { kind: 'ui' }
    )
    expect(modules).toEqual([])
    expect(issues[0].message).toContain('sync boom')
  })

  it('rejects a missing or non-object default export', async () => {
    const { modules, issues } = await loadModules<Def>(
      {
        '../modules/none/ui.tsx': async () => ({}),
        '../modules/text/ui.tsx': ok('nope')
      },
      { kind: 'ui' }
    )
    expect(modules).toEqual([])
    expect(issues.map((i) => i.moduleId).sort()).toEqual(['none', 'text'])
  })

  it('rejects an id that is invalid or does not match the folder name', async () => {
    const { modules, issues } = await loadModules<Def>(
      {
        '../modules/folder-a/ui.tsx': ok({ id: 'folder-b' }),
        '../modules/folder-c/ui.tsx': ok({ id: 'Folder_C' }),
        '../modules/folder-d/ui.tsx': ok({})
      },
      { kind: 'ui' }
    )
    expect(modules).toEqual([])
    expect(issues).toHaveLength(3)
    expect(issues.find((i) => i.moduleId === 'folder-a')?.message).toContain('must match')
  })

  it('applies the custom validator', async () => {
    const { modules, issues } = await loadModules<Def>(
      { '../modules/picky/ui.tsx': ok({ id: 'picky' }) },
      { kind: 'ui', validate: () => 'missing title' }
    )
    expect(modules).toEqual([])
    expect(issues[0].message).toBe('missing title')
  })
})
