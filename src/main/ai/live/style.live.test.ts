/**
 * LIVE checks c, d: style analysis (a real .pptx digest AND a real PDF made by PowerPoint) and profile synthesis.
 * Run: npm run test:live -- style
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { FileAnalysis } from '@shared/ai/types'
import { slideSchema } from '@shared/deck/schema'
import { parseStyleProfile } from '@shared/style/schema'
import { exportDeckToPptx } from '../../export/pptx'
import { loadFixtureDeck, loadFixtureStyle } from '../../export/testkit'
import { digestPptx } from '../../import/pptxDigest'
import {
  artifactDir,
  createLiveService,
  hasKey,
  readArtifact,
  saveArtifact,
  SKIP_MESSAGE,
  unwrap
} from './harness'

const PS_SCRIPT = `
param([string]$In, [string]$Out)
$ErrorActionPreference = 'Stop'
$ppt = New-Object -ComObject PowerPoint.Application
try {
  # ReadOnly, Untitled, WithWindow = false: no PowerPoint window appears
  $pres = $ppt.Presentations.Open($In, -1, 0, 0)
  $pres.SaveAs($Out, 32)
  $pres.Close()
} finally {
  $ppt.Quit()
}
`

const powerpointPids = (): number[] => {
  try {
    const out = execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        "(Get-Process POWERPNT -ErrorAction SilentlyContinue).Id -join ','"
      ],
      { encoding: 'utf8' }
    ).trim()
    return out ? out.split(',').map(Number) : []
  } catch {
    return []
  }
}

/** The fixture deck as a real .pptx and as a PDF exported by PowerPoint (COM, windowless). */
async function buildInputs(): Promise<{ pptx: Uint8Array; pdf: Uint8Array | null; how: string }> {
  const dir = artifactDir()
  const pptxPath = join(dir, 'fixture-deck.pptx')
  const pdfPath = join(dir, 'fixture-deck.pdf')
  const { bytes } = await exportDeckToPptx(loadFixtureDeck(), loadFixtureStyle(), {
    readAsset: async () => undefined
  })
  writeFileSync(pptxPath, bytes)
  let how = 'PowerPoint COM'
  if (!existsSync(pdfPath)) {
    const before = powerpointPids()
    const script = join(tmpdir(), 'slide-planner-live-pdf.ps1')
    writeFileSync(script, PS_SCRIPT)
    try {
      execFileSync(
        'powershell',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          script,
          '-In',
          pptxPath,
          '-Out',
          pdfPath
        ],
        { stdio: 'pipe', timeout: 120_000 }
      )
    } catch (error) {
      how = `COM failed: ${(error as Error).message.slice(0, 200)}`
    } finally {
      rmSync(script, { force: true })
      for (const pid of powerpointPids().filter((p) => !before.includes(p))) {
        try {
          process.kill(pid)
        } catch {
          /* already gone */
        }
      }
    }
  }
  console.log(`[live] PDF made by: ${how}; pdf exists: ${existsSync(pdfPath)}`)
  return {
    pptx: bytes,
    pdf: existsSync(pdfPath) ? new Uint8Array(readFileSync(pdfPath)) : null,
    how
  }
}

const hex = /^#[0-9A-Fa-f]{6}$/

function checkAnalysis(a: FileAnalysis): void {
  expect(a.colors.length).toBeGreaterThanOrEqual(3)
  for (const c of a.colors) expect(c.hex).toMatch(hex)
  expect(a.fonts.length).toBeGreaterThanOrEqual(1)
  expect(a.layouts.length).toBeGreaterThanOrEqual(1)
  expect(a.slideKinds.length).toBeGreaterThanOrEqual(2)
  expect(a.voice.spelling).not.toBe('en-US')
}

describe.skipIf(!hasKey())('live: style analysis and synthesis', () => {
  if (!hasKey()) console.log(SKIP_MESSAGE)
  let inputs: Awaited<ReturnType<typeof buildInputs>>
  beforeAll(async () => {
    inputs = await buildInputs()
  }, 180_000)

  it('c1) analyseStyleFile from a .pptx digest', async () => {
    const digest = await digestPptx(inputs.pptx)
    const ai = createLiveService()
    const { analysis } = unwrap(
      await ai.analyseStyleFile({ kind: 'pptx', fileName: 'photosynthesis.pptx', digest }),
      'analyseStyleFile(pptx)'
    )
    saveArtifact('c-analysis-pptx.json', analysis)
    checkAnalysis(analysis)
  })

  it('c2) analyseStyleFile from a real PDF (document block)', async () => {
    expect(inputs.pdf, 'PDF export failed: ' + inputs.how).not.toBeNull()
    const ai = createLiveService()
    const { analysis } = unwrap(
      await ai.analyseStyleFile({ kind: 'pdf', fileName: 'photosynthesis.pdf', pdf: inputs.pdf! }),
      'analyseStyleFile(pdf)'
    )
    saveArtifact('c-analysis-pdf.json', analysis)
    checkAnalysis(analysis)
  })

  it('d) synthesiseProfile from two analyses -> valid StyleProfile + test slide', async () => {
    const a = readArtifact<FileAnalysis>('c-analysis-pptx.json')
    const b = readArtifact<FileAnalysis>('c-analysis-pdf.json')
    expect(a && b, 'run c1 and c2 first').toBeTruthy()
    const ai = createLiveService()
    const { profile, testSlide } = unwrap(
      await ai.synthesiseProfile({ name: 'Live test style', analyses: [a!, b!] }),
      'synthesiseProfile'
    )
    saveArtifact('d-profile.json', { profile, testSlide })
    expect(parseStyleProfile(profile)).toBeTruthy()
    expect(profile.layouts.length).toBeGreaterThanOrEqual(1)
    expect(Object.keys(profile.tokens.colors).length).toBeGreaterThanOrEqual(5)
    expect(slideSchema.safeParse(testSlide).success).toBe(true)
  })
})
