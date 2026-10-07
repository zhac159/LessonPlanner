// A lesson, end to end with the fake AI: Home quick card -> slides stream in -> editor -> chat edit -> result chip ->
// Undo -> circle edit on a region -> export to a temp path (SLIDE_PLANNER_TEST_SAVE_PATH) and read the .pptx back
// (slide count, every XML part well-formed) -> the Quiz plugin adds slides in one undo step.
import { mkdtempSync, existsSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { drawLoop, inspectPptx } from './fixtures.mjs'

const OBJECTIVES =
  'Year 8 Science: Photosynthesis\nLO1: Describe where photosynthesis happens\nLO2: Write the word equation'
const TITLE = 'Year 8 Science: Photosynthesis'

export default async function lesson({
  launch,
  check,
  shot,
  invoke,
  waitUntil,
  waitForSplashGone
}) {
  const work = mkdtempSync(join(tmpdir(), 'slide-planner-lesson-'))
  const exportPath = join(work, 'Photosynthesis.pptx')
  try {
    const { page, errors } = await launch({
      seed: 'home',
      reducedMotion: true,
      env: { SLIDE_PLANNER_TEST_SAVE_PATH: exportPath }
    })
    await waitForSplashGone(page)
    const home = page.locator('[data-testid="module-home"]')
    await home.waitFor({ state: 'visible' })

    // Which slide cards exist right now (the editor's thumbnails are buttons named "Slide N: ...").
    const slideCount = () => page.getByRole('button', { name: /^Slide \d+:/ }).count()
    const lessonId = async () =>
      (await invoke(page, 'deck-builder', 'listLessons')).find((l) => l.title === TITLE)?.id
    const deckOf = async () =>
      (await invoke(page, 'deck-builder', 'openLesson', { lessonId: await lessonId() })).deck
    const bodyOf = (deck, index) =>
      deck.slides[index].elements.find((e) => e.type === 'text' && e.role === 'body')
    const paragraphCount = async (index) => bodyOf(await deckOf(), index).paragraphs.length

    // 1. Generation: the thumbnails appear as the slides arrive. Record every count the strip goes through.
    await page.evaluate(() => {
      window.__slideCounts = []
      const note = () => {
        const n = [...document.querySelectorAll('button[aria-label^="Slide "]')].filter((b) =>
          /^Slide \d+:/.test(b.getAttribute('aria-label') ?? '')
        ).length
        if (window.__slideCounts.at(-1) !== n) window.__slideCounts.push(n)
      }
      new MutationObserver(note).observe(document.body, { childList: true, subtree: true })
    })
    await page.getByLabel('Learning objectives').fill(OBJECTIVES)
    await page.getByRole('button', { name: 'Create lesson' }).click()
    await page.getByText('8 slides added').waitFor({ timeout: 20_000 })
    check('the editor opens with the 8 generated slides', (await slideCount()) === 8)
    const counts = await page.evaluate(() => window.__slideCounts)
    check(
      'the slides arrive in the strip (not an empty editor)',
      counts.at(-1) === 8,
      counts.join(',')
    )
    check('the lesson is saved with its slides', (await deckOf()).slides.length === 8)
    await shot(page, 'lesson-generated')

    // 2. Chat edit on slide 4 (the fake "make it shorter" trims the selected slide's body), the result chip, Undo.
    const before = await paragraphCount(3)
    await page.getByRole('button', { name: /^Slide 4:/ }).click()
    const composer = page.getByPlaceholder('Paste learning objectives or ask for a change…')
    await composer.fill('make it shorter')
    await page.getByRole('button', { name: 'Send' }).click()
    await page.getByText('Slide 4 changed').waitFor()
    const shorter = await paragraphCount(3)
    check(
      'the chat edit shortened slide 4 and a result chip says so',
      shorter < before,
      `${before} -> ${shorter}`
    )
    await page.getByRole('button', { name: 'Undo' }).last().click()
    await page.getByText('Undone').waitFor()
    check('Undo on the chip restores the slide', (await paragraphCount(3)) === before)

    // 3. Circle edit: draw a loop on the slide, say what to change, send.
    await page.getByRole('button', { name: 'Circle to edit' }).click()
    await drawLoop(page, '.circle-layer')
    await page
      .getByRole('complementary', { name: 'Your planning buddy' })
      .getByRole('button', { name: 'Remove region 1' })
      .waitFor()
    check('a circled region is numbered and kept', true)
    await page.getByPlaceholder('Say what to change in the circled area…').fill('make it shorter')
    await page.getByRole('button', { name: 'Send' }).click()
    await waitUntil(async () => (await paragraphCount(3)) < before)
    check('the circle edit changed the slide', (await paragraphCount(3)) < before)
    await shot(page, 'lesson-circled')

    // 4. Export: the picture-spot notice is answered with "Export anyway"; the Save dialog answers with the temp path.
    await page.getByRole('button', { name: 'Export to PowerPoint' }).click()
    await page.getByRole('button', { name: 'Export anyway' }).click()
    await waitUntil(
      () => existsSync(exportPath) && statSync(exportPath).size > 5000,
      Boolean,
      20_000
    )
    check('PowerPoint export wrote the .pptx to the chosen path', existsSync(exportPath))
    const pptx = await inspectPptx(exportPath)
    check('the .pptx has the 8 slides', pptx.slideCount === 8, `${pptx.slideCount} slides`)
    check(
      'every XML part of the .pptx is well formed',
      pptx.xmlErrors.length === 0,
      pptx.xmlErrors.join(', ')
    )
    check(
      'the .pptx carries the lesson text',
      pptx.slideText.some((text) => /photosynthesis/i.test(text)),
      pptx.slideText[3]
    )

    // 5. Quiz plugin: the + menu, "Make quiz" with the defaults, six slides at the end in one undo step.
    await page.getByRole('button', { name: 'Plugins' }).click()
    await page.getByText('Quiz', { exact: true }).click()
    await page.getByRole('button', { name: 'Make quiz' }).click()
    await page.getByRole('button', { name: /quiz slides added/ }).waitFor({ timeout: 20_000 })
    const withQuiz = await waitUntil(
      async () => (await deckOf()).slides.length,
      (n) => n > 8
    )
    check('the Quiz plugin added slides after the lesson', withQuiz === 14, `${withQuiz} slides`)
    await page.getByRole('button', { name: 'Undo' }).last().click()
    await waitUntil(
      async () => (await deckOf()).slides.length,
      (n) => n === 8
    )
    check('one Undo takes the whole quiz away', (await deckOf()).slides.length === 8)

    check('no renderer errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}
