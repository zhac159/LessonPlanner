// First run, as a new teacher: Welcome -> Connect Claude (fake key) -> Create a style by dropping a real .pptx and a
// real PDF -> both are learned -> Save style -> Home lists it. Also proves the data lands in the throwaway data
// folder (SLIDE_PLANNER_DATA_DIR) and that nothing except files was needed from the network (fake AI).
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dropFiles, writePdf, writePptx } from './fixtures.mjs'

const tree = (dir) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))

export default async function firstRun({ launch, check, shot, waitForSplashGone }) {
  const work = mkdtempSync(join(tmpdir(), 'slide-planner-firstrun-'))
  try {
    const pptxPath = await writePptx(work, 'Photosynthesis lesson.pptx')
    const pdfPath = writePdf(work, 'Scheme of work.pdf')
    const { page, errors, dataDir } = await launch()
    await waitForSplashGone(page)

    // 1. Welcome.
    await page.getByRole('heading', { name: 'Welcome!' }).waitFor()
    check('a fresh data folder starts on the Welcome step', true)
    await page.getByLabel('What should I call you?').fill('Alice')
    await page.getByLabel('What do you mostly teach?').fill('KS3 Science')
    await page.getByRole('button', { name: /Next: connect Claude/ }).click()

    // 2. Connect Claude with a fake key (the fake AI accepts any key).
    await page.getByRole('heading', { name: 'Connect Claude' }).waitFor()
    await page.getByLabel('Claude API key').fill('sk-ant-fake-key-for-e2e')
    await page.getByRole('button', { name: /Test connection/ }).click()
    await page.getByText('Saved key ending in').waitFor({ timeout: 10_000 })
    await page
      .getByText(/^Connected/)
      .first()
      .waitFor({ timeout: 10_000 })
    check('Claude reports connected with the fake key', true)
    await page.getByRole('button', { name: /Next: your style/ }).click()

    // 3. Create a style from two real files, dropped on the dropzone.
    await page.getByRole('heading', { name: 'Create a style' }).waitFor()
    await dropFiles(page, '.ui-dropzone', [pptxPath, pdfPath])
    await page.getByText('2 of 2 learned').waitFor({ timeout: 25_000 })
    check('both the .pptx and the PDF are learned', true)
    await page.getByRole('heading', { name: 'Colours' }).waitFor()
    await page.getByPlaceholder('Name this style').fill('My science style')
    await shot(page, 'firstrun-style')
    await page.getByRole('button', { name: 'Save style' }).click()

    // 4. Home shows the style.
    await page.locator('[data-testid="module-home"]').waitFor({ state: 'visible', timeout: 10_000 })
    await page.getByText('My science style').first().waitFor({ timeout: 10_000 })
    check('Home lists the saved style', true)
    check(
      'the teacher is greeted by name',
      (await page.locator('[data-testid="module-home"]').innerText()).includes('Alice')
    )
    await shot(page, 'firstrun-home')

    // 5. Everything is in the data folder.
    const files = tree(dataDir)
    check(
      'the style and the profile were written to SLIDE_PLANNER_DATA_DIR',
      files.length >= 3,
      `${files.length} files`
    )
    check('no renderer errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}
