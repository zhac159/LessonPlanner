/**
 * FREE replay of WP6 on the teacher's real example decks: the real PDFs go through the styles service (real local picture
 * extraction, real exemplar reading, real defect fixes) but the AI is replaced by what the earlier live run saved in
 * .artifacts/example/old/ (the analyses and the profile Claude synthesised BEFORE the fixes, with its leaked colours,
 * copied dates and photosynthesis test slide). Nothing is sent anywhere. Skips when that cache or the decks are absent.
 * Writes .artifacts/example/replay.json for a look.
 * Run: npm run test:live -- src/main/ai/live/example.replay.live.test.ts
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AiService, FileAnalysis } from '@shared/ai/types'
import type { Slide } from '@shared/deck/types'
import { ok } from '@shared/result'
import type { StyleProfile } from '@shared/style/types'
import { StylesService } from '../../services/styles/service'
import { fakePorts } from '../../services/styles/picturesTesting'

const OUT = join(resolve(process.cwd()), '.artifacts', 'example')
const OLD = join(OUT, 'old')
const EXAMPLE = join(resolve(process.cwd()), 'example')
const DECKS = [
  { id: 'L1', fileName: 'L1-Illustration and Meaning (Monday).pdf' },
  { id: 'L3', fileName: 'L3- Regular Irregular Plurals (Wednesday).pdf' }
]
const ready =
  existsSync(join(OLD, 'profile.json')) &&
  DECKS.every(
    (d) => existsSync(join(OLD, `analysis-${d.id}.json`)) && existsSync(join(EXAMPLE, d.fileName))
  )
const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T

describe.skipIf(!ready)(
  'replay: the example decks through the styles service (no AI spend)',
  () => {
    it('fixes the defects of the earlier real run and finds the logo, pictures and exemplars locally', async () => {
      const old = read<{ profile: StyleProfile; testSlide: Slide }>(join(OLD, 'profile.json'))
      const ai = {
        analyseStyleFile: async (input: { fileName: string }) =>
          ok({
            analysis: read<FileAnalysis>(
              join(OLD, `analysis-${DECKS.find((d) => d.fileName === input.fileName)!.id}.json`)
            )
          }),
        synthesiseProfile: async () => ok({ profile: old.profile, testSlide: old.testSlide })
      } as unknown as AiService
      const fakes = fakePorts()
      const dir = mkdtempSync(join(tmpdir(), 'wp6-replay-'))
      const service = new StylesService({ dir, ai, ports: () => fakes.ports })
      try {
        const { styleId } = await service.create('Stonebridge English')
        await service.addFiles(
          styleId,
          DECKS.map((d) => join(EXAMPLE, d.fileName))
        )
        await service.whenIdle(styleId)
        const logo = fakes.review.batches[0]?.candidates.find((c) => c.kind === 'logo')
        if (logo)
          fakes.library.saved.set(logo.image.hash, { id: 'ast_school_logo', name: 'school_logo' })
        const view = await service.get(styleId)
        const profile = (await service.getProfile(styleId))!
        mkdirSync(OUT, { recursive: true })
        writeFileSync(
          join(OUT, 'replay.json'),
          JSON.stringify(
            {
              colours: Object.fromEntries(
                Object.entries(profile.tokens.colors).map(([k, v]) => [k, `${v.hex} ${v.label}`])
              ),
              fonts: profile.tokens.fonts,
              fontsNeeded: profile.fontsNeeded,
              kicker: profile.components.kicker,
              habits: profile.habits,
              phrases: profile.voice.phrases,
              rules: profile.voice.rules,
              regions: profile.layouts.map((l) => l.regions.filter((r) => /date/i.test(r.name))),
              testSlide: view.ok ? view.style.profile?.testSlide : undefined,
              exemplars: profile.exemplars,
              candidates: (fakes.review.batches[0]?.candidates ?? []).map((c) => ({
                name: c.suggestedName,
                kind: c.kind,
                keep: c.keep,
                foundOn: c.foundOn,
                leftOut: c.leftOut ?? null
              })),
              pictureHabits: view.ok ? view.style.profile?.pictureHabits : undefined,
              assetsFound: view.ok
                ? { ...view.style.profile?.assetsFound, preview: undefined }
                : undefined,
              placements: profile.pictures?.placements,
              slideKindsUsage: profile.pictures?.slideKinds
            },
            null,
            2
          )
        )
        expect(profile.tokens.colors.muted?.hex).not.toBe('#00A651')
        expect(JSON.stringify([profile.habits, profile.voice, profile.exemplars])).not.toMatch(
          /October|2026/
        )
      } finally {
        await service.dispose()
        rmSync(dir, { recursive: true, force: true })
      }
    })
  }
)
