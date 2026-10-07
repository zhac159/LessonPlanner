import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { PictureFacts } from '../../../ai/schemas/pictures'
import { cleanTemp, tempDir } from '../testing'
import { createFileDescribeCache, DESCRIBE_CACHE_FILE } from './describeCache'
import { writeTemp } from './testing'

afterEach(cleanTemp)

const facts: PictureFacts = {
  title: 'School logo',
  name: 'school_logo',
  kind: 'logo',
  description: 'A navy badge.',
  tags: ['logo'],
  maybePupils: false,
  blurry: false
}

describe('the describe cache file', () => {
  it('remembers a description by sha256, also in a later session', async () => {
    const dir = await tempDir()
    const cache = createFileDescribeCache(dir)
    expect(await cache.get('abc')).toBeUndefined()
    await cache.set('abc', facts)
    const later = createFileDescribeCache(dir)
    expect(await later.get('abc')).toEqual(facts)
    expect(JSON.parse(await readFile(join(dir, DESCRIBE_CACHE_FILE), 'utf8'))).toMatchObject({
      schemaVersion: 1,
      entries: { abc: { name: 'school_logo' } }
    })
  })

  it('hands out copies, so a caller cannot change what is remembered', async () => {
    const cache = createFileDescribeCache(await tempDir())
    await cache.set('abc', facts)
    const got = await cache.get('abc')
    got!.tags.push('changed')
    expect((await cache.get('abc'))?.tags).toEqual(['logo'])
  })

  it('treats a broken file as an empty cache and keeps working', async () => {
    const dir = await tempDir()
    await writeTemp(dir, DESCRIBE_CACHE_FILE, '{ not json')
    const cache = createFileDescribeCache(dir)
    expect(await cache.get('abc')).toBeUndefined()
    await cache.set('abc', facts)
    await cache.flush()
    expect(await createFileDescribeCache(dir).get('abc')).toEqual(facts)
  })

  it('ignores entries that are not descriptions', async () => {
    const dir = await tempDir()
    await writeTemp(
      dir,
      DESCRIBE_CACHE_FILE,
      JSON.stringify({ schemaVersion: 1, entries: { bad: { name: 3 }, good: facts } })
    )
    const cache = createFileDescribeCache(dir)
    expect(await cache.get('bad')).toBeUndefined()
    expect(await cache.get('good')).toEqual(facts)
  })
})
