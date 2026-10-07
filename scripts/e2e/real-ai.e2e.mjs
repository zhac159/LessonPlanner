// LIVE flow: one real run of the whole product with the REAL Claude API. It costs money (about $1 to $2 on
// claude-sonnet-5-5), so it is NOT part of `npm run test:e2e` (run.mjs skips this file) and only runs when asked:
//
//   npm run build
//   node scripts/e2e/real-ai.e2e.mjs --real [--budget 3.5] [--only style,lesson,chat,circle,quiz,export]
//
// `--keep` re-uses the previous run's data folder (style, library, lessons) so a later step can be re-run cheaply.
//
// It needs `keyt.txt` (the Claude key, git-ignored) in the repo root. The key is read here with fs and handed to the
// app through its real Settings API (`setApiKey`), exactly like the Connect screen does; it is never printed, and the
// flow checks that the encrypted file the app wrote does not contain it.
//
// What it does (like the teacher): saves the key, learns a style from the real example decks (example/*.pdf), reviews and
// accepts "assets I found", generates a Year 3 plurals lesson, chats ("make slide 3 shorter", a {{logo}} asset chip,
// Undo), circle-edits a picture, makes a 5-question Quiz, exports a .pptx and opens it in PowerPoint windowless
// (scripts/verify-pptx-com.ps1). It stops by itself when the app's usage log reaches the budget (default $3.50).
//
// Output: one line per step; screenshots, PNGs and results.json in .artifacts/real-ai/. The window is hidden (never
// set SLIDE_PLANNER_HEADLESS=0). The Google picture maker is never called (the free tier answers 429).
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { cleanElectronEnv } from './args.mjs'
import { launchApp, root, waitForSplashGone, go, settle } from './lib.mjs'

const argv = process.argv.slice(2)
const flagValue = (name) => {
  const at = argv.indexOf(name)
  return at >= 0 ? argv[at + 1] : undefined
}
const budgetUsd = Number(flagValue('--budget') ?? 3.5)
const only = new Set((flagValue('--only') ?? '').split(',').filter(Boolean))
const wanted = (name) => only.size === 0 || only.has(name)

const outDir = join(root, '.artifacts', 'real-ai')
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/** Runs the whole flow; returns the results object. Exported so a runner could call it; `--real` is the gate. */
export async function runRealAi() {
  const keyFile = join(root, 'keyt.txt')
  if (!existsSync(keyFile)) throw new Error('keyt.txt (the Claude key) is missing in the repo root')
  const claudeKey = readFileSync(keyFile, 'utf8').trim()
  const redact = (text) =>
    String(text)
      .split(claudeKey)
      .join('[key]')
      .replace(/sk-ant-[\w-]+/g, '[key]')

  const keep = argv.includes('--keep')
  if (!keep) rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  const results = { steps: [], notes: [], images: [], spend: null }
  const log = (text) => console.log(redact(text))
  const exampleDir = join(root, 'example')
  const pdfs = readdirSync(exampleDir)
    .filter((name) => name.toLowerCase().endsWith('.pdf'))
    .map((name) => join(exampleDir, name))
  if (pdfs.length === 0) throw new Error('example/*.pdf not found')

  // Never fake: strip every switch that would replace Claude.
  const env = { SLIDE_PLANNER_TEST_SAVE_PATH: join(outDir, 'lesson.pptx') }
  const dataDir = join(outDir, 'data')
  mkdirSync(dataDir, { recursive: true })
  const instance = await launchApp({
    fakeAi: false,
    dataDir,
    env,
    reducedMotion: true,
    size: { width: 1440, height: 900 }
  })
  const { page, app } = instance
  const closeAll = () => instance.close()

  // ---- helpers ----------------------------------------------------------------------------------
  const usageFile = () => findFile(dataDir, 'usage.jsonl')
  const spend = () => {
    const file = usageFile()
    const out = {
      usd: 0,
      calls: 0,
      byTask: {},
      tokens: { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 }
    }
    if (!file) return out
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        const e = JSON.parse(line)
        out.usd += e.costUsd
        out.calls++
        const t = (out.byTask[e.task] ??= { usd: 0, calls: 0 })
        t.usd += e.costUsd
        t.calls++
        out.tokens.in += e.usage.inputTokens
        out.tokens.out += e.usage.outputTokens
        out.tokens.cacheRead += e.usage.cacheReadTokens
        out.tokens.cacheWrite += e.usage.cacheWriteTokens
      } catch {
        /* half-written line */
      }
    }
    return out
  }
  class BudgetStop extends Error {}
  const guard = () => {
    const now = spend().usd
    if (now >= budgetUsd)
      throw new BudgetStop(`spend $${now.toFixed(3)} reached the $${budgetUsd} stop`)
  }
  const call = async (moduleId, channel, ...args) => {
    guard()
    try {
      return await page.evaluate(
        ([m, c, a]) => window.api.modules.invoke(m, c, ...a),
        [moduleId, channel, args]
      )
    } catch (error) {
      throw new Error(redact(error instanceof Error ? error.message : error))
    }
  }
  /** Polls `probe` (async, returns a truthy value) every `every` ms; checks the budget on every poll. */
  const waitFor = async (label, probe, { timeout = 120_000, every = 1500 } = {}) => {
    const deadline = Date.now() + timeout
    for (;;) {
      guard()
      const value = await probe()
      if (value) return value
      if (Date.now() > deadline)
        throw new Error(`timed out waiting for ${label} (${timeout / 1000}s)`)
      await sleep(every)
    }
  }
  const events = async (since = 0) =>
    (await page.evaluate((from) => window.__real.slice(from), since)) ?? []
  const eventCount = () => page.evaluate(() => window.__real.length)
  const shotWindow = async (name) => {
    const file = join(outDir, `${name}.png`)
    const base64 = await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(
        (w) => !w.webContents.getURL().endsWith('/render.html')
      )
      return (await win.webContents.capturePage()).toPNG().toString('base64')
    })
    writeFileSync(file, Buffer.from(base64, 'base64'))
    results.images.push(file)
    return file
  }
  const shotRect = async (name, selector) => {
    const box = await page.locator(selector).first().boundingBox()
    if (!box) return shotWindow(name)
    const file = join(outDir, `${name}.png`)
    const base64 = await app.evaluate(async ({ BrowserWindow }, rect) => {
      const win = BrowserWindow.getAllWindows().find(
        (w) => !w.webContents.getURL().endsWith('/render.html')
      )
      const image = await win.webContents.capturePage({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      })
      return image.toPNG().toString('base64')
    }, box)
    writeFileSync(file, Buffer.from(base64, 'base64'))
    results.images.push(file)
    return file
  }
  const selectSlide = (n) =>
    page
      .locator('[aria-label="Slides"]')
      .getByRole('button', { name: new RegExp(`^Slide ${n}(:|$)`) })
      .first()
      .click({ timeout: 5000 })
  let aborted = null
  const step = async (name, fn) => {
    if (aborted) {
      results.steps.push({ name, status: 'SKIP', seconds: 0, detail: aborted })
      log(`SKIP  ${name}  (${aborted})`)
      return undefined
    }
    const started = Date.now()
    const before = spend().usd
    try {
      const detail = await fn()
      const seconds = (Date.now() - started) / 1000
      const cost = spend().usd - before
      results.steps.push({ name, status: 'PASS', seconds, costUsd: cost, detail })
      log(
        `PASS  ${name}  ${seconds.toFixed(1)}s  $${cost.toFixed(3)}${detail ? `  ${detail}` : ''}`
      )
      return detail
    } catch (error) {
      const seconds = (Date.now() - started) / 1000
      const cost = spend().usd - before
      const message = redact(error instanceof Error ? error.message : error).split('\n')[0]
      results.steps.push({ name, status: 'FAIL', seconds, costUsd: cost, detail: message })
      log(`FAIL  ${name}  ${seconds.toFixed(1)}s  $${cost.toFixed(3)}  ${message}`)
      if (error instanceof BudgetStop) aborted = 'budget stop'
      return undefined
    }
  }
  const assertOk = (what, result) => {
    if (!result || result.ok === false) {
      throw new Error(`${what}: ${result?.code ?? 'no result'} ${result?.message ?? ''}`.trim())
    }
    return result
  }
  const state = { styleId: null, lessonId: null, deck: null, logo: null }

  try {
    await waitForSplashGone(page)
    await page.waitForFunction(() => window.__shell !== undefined, undefined, { timeout: 15_000 })
    // Collect the events we care about (compact copies only).
    const installListeners = () =>
      page.evaluate(() => {
        window.__real = []
        const trunc = (value) => (typeof value === 'string' ? value.slice(0, 160) : value)
        const push = (tag, payload) => window.__real.push({ at: Date.now(), tag, payload })
        const on = (m, c, map) => window.api.modules.on(m, c, (p) => push(`${m}:${c}`, map(p)))
        const same = (p) => p
        on('style-library', 'progress', (p) => ({
          file: p.file
            ? { name: p.file.name, status: p.file.status, error: p.file.error?.code }
            : null,
          progress: p.progress
        }))
        on('assets', 'review:changed', (p) => ({
          found: p.found,
          keeping: p.keeping,
          leftOut: p.leftOut,
          stillReading: p.stillReading,
          working: p.batches.map((b) => b.working)
        }))
        on('deck-builder', 'gen-progress', same)
        on('deck-builder', 'slide-ready', (p) => ({
          index: p.index,
          id: p.slide.id,
          kind: p.slide.kind
        }))
        on('deck-builder', 'chat:status', (p) => ({ step: p.step, state: p.state }))
        on('deck-builder', 'chat:changes', (p) => ({
          summary: trunc(p.changeSet.summary),
          ops: p.changeSet.ops.map((o) => o.op)
        }))
        on('deck-builder', 'chat:done', (p) => ({ messageId: p.messageId, usage: p.usage }))
        on('deck-builder', 'ai:error', same)
        on('deck-builder', 'plugins:file', (p) => ({ file: p.file }))
      })
    await installListeners()
    results.notes.push(`pdfs: ${pdfs.map((p) => p.split('\\').pop()).join(' | ')}`)

    // ---- 0. the key goes in through Settings ----------------------------------------------------
    await step('settings: save key through the real Settings API', async () => {
      const info = await page.evaluate(() => window.api.app.getInfo())
      const profile = assertOk(
        'setProfile',
        await call('settings', 'setProfile', { name: 'Ms Patel', subject: 'English' })
      )
      void profile
      const status0 = await call('settings', 'getAiStatus')
      if (status0.hasKey && !keep) throw new Error('throwaway data dir already had a key')
      if (!status0.encryptionAvailable) throw new Error('safeStorage encryption is not available')
      let saved
      try {
        saved = await page.evaluate(
          (k) => window.api.modules.invoke('settings', 'setApiKey', k),
          claudeKey
        )
      } catch (error) {
        throw new Error(redact(error instanceof Error ? error.message : error))
      }
      assertOk('setApiKey', saved)
      await call('settings', 'setModel', 'sonnet-5.5')
      await call('settings', 'completeOnboarding', { skippedAi: false })
      // The shell caches the profile: reload so it sees the finished onboarding (as after the real wizard).
      await page.reload()
      await waitForSplashGone(page)
      await page.waitForFunction(() => window.__shell !== undefined, undefined, { timeout: 15_000 })
      await installListeners()
      const status = await call('settings', 'getAiStatus')
      if (!status.hasKey || status.model !== 'sonnet-5.5') {
        throw new Error(`status after save: hasKey=${status.hasKey} model=${status.model}`)
      }
      // The stored file must not hold the plain key: search every file in the data dir for it.
      const hits = []
      const keyFiles = []
      for (const file of walk(dataDir)) {
        const bytes = readFileSync(file)
        if (file.endsWith('.key')) keyFiles.push(file.slice(dataDir.length))
        if (
          bytes.includes(Buffer.from(claudeKey, 'utf8')) ||
          bytes.includes(Buffer.from(claudeKey, 'utf16le'))
        ) {
          hits.push(file.slice(dataDir.length))
        }
        if (bytes.includes(Buffer.from('sk-ant', 'utf8')))
          hits.push(`${file.slice(dataDir.length)} (sk-ant)`)
      }
      if (keyFiles.length === 0) throw new Error('no secrets/*.key file was written')
      if (hits.length > 0) throw new Error(`plain key text found in: ${hits.join(', ')}`)
      return `app ${info.version}, stored as ${keyFiles.join(',')} (ends ${saved.keyLast4}), model ${status.model}, no plain key or "sk-ant" in any data file`
    })
    await step('settings: test connection (one tiny call)', async () => {
      const tested = assertOk('testConnection', await call('settings', 'testConnection'))
      return `${tested.model} ${tested.latencyMs} ms`
    })

    // ---- 1. learn a style from the real example decks ---------------------------------------------
    if (wanted('style')) {
      await step('style: drop the 2 example PDFs and learn', async () => {
        const created = assertOk(
          'createDraft',
          await call('style-library', 'createDraft', { paths: pdfs })
        )
        state.styleId = created.styleId
        await go(page, 'style-library', { kind: 'new-style', styleId: state.styleId })
        if (created.added !== pdfs.length)
          throw new Error(`added ${created.added}, rejected ${JSON.stringify(created.rejected)}`)
        let lastStage = ''
        const view = await waitFor(
          'learning to finish',
          async () => {
            const got = assertOk(
              'get',
              await call('style-library', 'get', { styleId: state.styleId })
            )
            const p = got.style.progress
            if (p.stage !== lastStage) {
              lastStage = p.stage
              log(
                `      learning: stage=${p.stage} ${p.learned}/${p.total} failed=${p.failed} $${spend().usd.toFixed(3)}`
              )
              await shotWindow(`01-style-${p.stage}`).catch(() => {})
            }
            if (p.stage === 'paused') throw new Error(`paused: ${p.pausedFor}`)
            return p.stage === 'done' ? got.style : null
          },
          { timeout: 420_000, every: 4000 }
        )
        const failed = view.files.filter((f) => f.status === 'failed')
        if (failed.length > 0)
          throw new Error(
            `files failed: ${failed.map((f) => `${f.name}:${f.error?.code}`).join(', ')}`
          )
        return `${view.files.length} files learned, name "${view.name}", fonts ${view.profile?.fonts.map((f) => f.family).join('/')}`
      })
      await step('style: pictures reviewed batch appears (~16, logo merged)', async () => {
        if (!state.styleId) throw new Error('no style')
        await waitFor(
          'the review batch to finish',
          async () => {
            const view = await call('assets', 'review:get')
            return view.batches.length > 0 && view.batches.every((b) => !b.working) ? view : null
          },
          { timeout: 360_000, every: 4000 }
        )
        const review = await call('assets', 'review:get')
        const found = await call('style-library', 'get', { styleId: state.styleId })
        const af = found.style.profile?.assetsFound
        const logos = review.candidates.filter((c) => c.kind === 'logo' || /logo/i.test(c.name))
        results.review = review.candidates.map((c) => ({
          name: c.name,
          kind: c.kind,
          decks: c.decks,
          keep: c.keep,
          leftOut: c.leftOut?.reason ?? null,
          size: `${c.width}x${c.height}`
        }))
        log(
          `      candidates: ${results.review.map((c) => `${c.name}[${c.kind}${c.keep ? '' : ',left:' + c.leftOut}]x${c.decks}`).join('; ')}`
        )
        await go(page, 'assets')
        await settle(page)
        await shotWindow('02-assets-review-banner')
        if (logos.length !== 1)
          results.notes.push(
            `logo candidates: ${logos.length} (${logos.map((l) => l.name).join(', ')})`
          )
        return `found=${review.found} keeping=${review.keeping} leftOut=${review.leftOut}; assetsFound=${JSON.stringify(af && { found: af.found, suggested: af.suggested })}; logo candidates=${logos.length} (decks ${logos.map((l) => l.decks).join(',')})`
      })
      await step('style: save the style', async () => {
        const saved = assertOk(
          'save',
          await call('style-library', 'save', { styleId: state.styleId })
        )
        await go(page, 'style-library', { kind: 'edit-style', styleId: state.styleId })
        await settle(page, 5000)
        await shotWindow('03-style-edit')
        return `${saved.style.name} status=${saved.style.status} swatches=${saved.style.swatches.join(',')}`
      })
      await step('assets: accept the review batch into the library', async () => {
        const review = await call('assets', 'review:get')
        const batch = review.batches.find((b) => b.origin.kind === 'style')
        if (!batch) throw new Error('no style review batch')
        const accepted = assertOk(
          'review:accept',
          await call('assets', 'review:accept', { batchId: batch.id })
        )
        const page1 = await call('assets', 'list', { limit: 100 })
        state.library = page1.items.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))
        state.logo =
          page1.items.find((a) => a.kind === 'logo') ??
          page1.items.find((a) => /logo/i.test(a.name)) ??
          null
        results.library = state.library
        await go(page, 'assets')
        await settle(page)
        await shotWindow('04-assets-library')
        return `added ${accepted.added.length}, library ${page1.libraryCount}; logo asset name "${state.logo?.name}"`
      })
    }

    // ---- 2. generate the lesson ---------------------------------------------------------------------
    if (
      wanted('lesson') ||
      wanted('chat') ||
      wanted('circle') ||
      wanted('quiz') ||
      wanted('export')
    ) {
      if (!state.styleId) {
        const styles = await call('style-library', 'list')
        state.styleId = styles.find((s) => s.status === 'ready')?.id ?? null
      }
      await step('lesson: generate a Year 3 plurals lesson (6-8 slides)', async () => {
        const mark = await eventCount()
        const created = assertOk(
          'createLesson',
          await call('deck-builder', 'createLesson', {
            objectivesText:
              'Year 3 English, 45 minutes, about 7 slides. Learning objectives: I can spell regular plurals by adding s or es (cat/cats, box/boxes). I can learn and use some common irregular plurals (child/children, mouse/mice, foot/feet, man/men).',
            documentIds: [],
            styleId: state.styleId,
            title: null,
            meta: { yearGroup: 'Year 3', subject: 'English', durationMin: 45, targetSlideCount: 7 },
            startGeneration: true
          })
        )
        state.lessonId = created.lessonId
        await go(page, 'deck-builder', { kind: 'open-lesson', lessonId: state.lessonId })
        await shotWindow('05-generating').catch(() => {})
        const done = await waitFor(
          'generation to finish',
          async () => {
            const evs = await events(mark)
            const last = [...evs].reverse().find((e) => e.tag === 'deck-builder:gen-progress')
            if (last?.payload.stage === 'error')
              throw new Error(`generation error: ${last.payload.message}`)
            const err = evs.find((e) => e.tag === 'deck-builder:ai:error')
            if (err) throw new Error(`ai:error ${err.payload.code}: ${err.payload.message}`)
            return last?.payload.stage === 'done' ? last.payload : null
          },
          { timeout: 360_000, every: 2500 }
        )
        const opened = assertOk(
          'openLesson',
          await call('deck-builder', 'openLesson', { lessonId: state.lessonId })
        )
        state.deck = opened.deck
        const slides = opened.deck.slides
        const kinds = slides.map((s) => s.kind).join(',')
        const spots = slides.flatMap((s, i) =>
          s.elements.filter((e) => e.type === 'image' && !e.assetId).map(() => i + 1)
        )
        const placed = slides.flatMap((s, i) =>
          s.elements.filter((e) => e.type === 'image' && e.assetId).map(() => i + 1)
        )
        await settle(page, 5000)
        await sleep(1500)
        await shotWindow('06-editor-generated')
        return `title "${done.title ?? opened.deck.title}", ${slides.length} slides [${kinds}], spots on slides [${spots}], placed pictures on slides [${placed}]`
      })
      await step('lesson: screenshot each slide in the editor', async () => {
        if (!state.deck) throw new Error('no deck')
        const count = state.deck.slides.length
        for (let n = 1; n <= count; n++) {
          await selectSlide(n)
          await sleep(500)
          await settle(page, 3000)
          await shotRect(
            `slide-${String(n).padStart(2, '0')}-editor`,
            '[aria-label="Slide editing area"]'
          )
        }
        return `${count} stage shots`
      })
    }

    // ---- 3. chat ----------------------------------------------------------------------------------------
    const sendChat = async (text, extra = {}) => {
      const mark = await eventCount()
      const started = assertOk(
        'chat:send',
        await call('deck-builder', 'chat:send', {
          lessonId: state.lessonId,
          text,
          attachmentIds: [],
          regions: [],
          markup: [],
          selectedSlideId: state.deck.slides[0].id,
          assetRefs: [],
          ...extra
        })
      )
      const evs = await waitFor(
        `chat turn "${text.slice(0, 30)}"`,
        async () => {
          const all = await events(mark)
          const err = all.find((e) => e.tag === 'deck-builder:ai:error')
          if (err) throw new Error(`ai:error ${err.payload.code}: ${err.payload.message}`)
          return all.some((e) => e.tag === 'deck-builder:chat:done') ? all : null
        },
        { timeout: 240_000, every: 1500 }
      )
      const changes = evs.filter((e) => e.tag === 'deck-builder:chat:changes').map((e) => e.payload)
      const opened = assertOk(
        'openLesson',
        await call('deck-builder', 'openLesson', { lessonId: state.lessonId })
      )
      const reply = [...opened.chat].reverse().find((m) => m.role === 'assistant')
      return { started, changes, opened, reply }
    }
    const textOf = (slide) =>
      slide.elements
        .filter((e) => 'paragraphs' in e)
        .map((e) => e.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join(' '))
        .join(' ')
    if (wanted('chat') && state.lessonId) {
      await step('chat: "make slide 3 shorter"', async () => {
        const before = state.deck.slides[2]
        const out = await sendChat('Make slide 3 shorter.', { selectedSlideId: before.id })
        const after = out.opened.deck.slides.find((s) => s.id === before.id)
        state.deck = out.opened.deck
        const a = textOf(before).length
        const b = textOf(after).length
        await selectSlide(3).catch(() => {})
        await sleep(800)
        await shotWindow('07-chat-shorter')
        if (out.changes.length === 0)
          throw new Error(`no change made; reply: ${out.reply?.text?.slice(0, 200)}`)
        if (!(b < a)) throw new Error(`slide 3 text not shorter: ${a} -> ${b} chars`)
        return `slide 3 text ${a} -> ${b} chars; changes: ${out.changes.map((c) => c.summary).join(' | ')}`
      })
      await step(
        'chat: logo asset chip "put {{logo}} in the top right of slide 4 and make it smaller"',
        async () => {
          if (!state.logo) throw new Error('no logo asset in the library')
          const slide4 = state.deck.slides[3]
          const name = state.logo.name
          const out = await sendChat(
            `Put {{${name}}} in the top right of slide 4 and make it smaller.`,
            {
              selectedSlideId: slide4.id,
              assetRefs: [{ assetId: state.logo.id, name }]
            }
          )
          state.deck = out.opened.deck
          const after = out.opened.deck.slides[3]
          const logoEl = after.elements.find((e) => e.type === 'image' && e.assetId)
          await selectSlide(4).catch(() => {})
          await sleep(800)
          await shotRect('08-chat-logo-slide4', '[aria-label="Slide editing area"]')
          state.afterLogo = out.opened.history
          if (!logoEl)
            throw new Error(
              `no placed picture on slide 4; reply: ${out.reply?.text?.slice(0, 200)}`
            )
          const topRight = logoEl.x + logoEl.w / 2 > 1920 / 2 && logoEl.y + logoEl.h / 2 < 1080 / 2
          return `logo at x=${Math.round(logoEl.x)} y=${Math.round(logoEl.y)} w=${Math.round(logoEl.w)} h=${Math.round(logoEl.h)} (top right: ${topRight}); asset ids in message: ${out.reply?.assets?.length ?? 0}; changes: ${out.changes.map((c) => c.summary).join(' | ')}`
        }
      )
      await step('chat: Undo the last change', async () => {
        const beforeUndo = (await call('deck-builder', 'openLesson', { lessonId: state.lessonId }))
          .history
        const undone = assertOk(
          'undo',
          await call('deck-builder', 'undo', { lessonId: state.lessonId })
        )
        const redone = assertOk(
          'redo',
          await call('deck-builder', 'redo', { lessonId: state.lessonId })
        )
        void redone
        // Leave the deck undone once (that is what the teacher asked for), then redo is available.
        const undoneAgain = assertOk(
          'undo again',
          await call('deck-builder', 'undo', { lessonId: state.lessonId })
        )
        state.deck = undoneAgain.deck
        return `undo available: ${beforeUndo.canUndo} ("${beforeUndo.undoSummary}"); after undo canRedo=${undone.history.canRedo}; slide 4 has a picture now: ${undoneAgain.deck.slides[3].elements.some((e) => e.type === 'image' && e.assetId)}`
      })
    }

    // ---- 4. circle edit ----------------------------------------------------------------------------------------
    if (wanted('circle') && state.lessonId) {
      await step('circle edit: a circled picture area', async () => {
        const deck = (await call('deck-builder', 'openLesson', { lessonId: state.lessonId })).deck
        let slide = deck.slides.find((s) => s.elements.some((e) => e.type === 'image'))
        if (!slide) slide = deck.slides[1]
        const target =
          slide.elements.find((e) => e.type === 'image') ??
          slide.elements.find((e) => e.type !== 'shape')
        const { x, y, w, h } = target
        const pad = 16
        const path = [
          [x - pad, y - pad],
          [x + w / 2, y - pad - 8],
          [x + w + pad, y - pad],
          [x + w + pad + 8, y + h / 2],
          [x + w + pad, y + h + pad],
          [x + w / 2, y + h + pad + 8],
          [x - pad, y + h + pad],
          [x - pad - 8, y + h / 2],
          [x - pad, y - pad]
        ].map(([px, py]) => [Math.round(px), Math.round(py)])
        const region = {
          id: 'reg_1',
          n: 1,
          slideId: slide.id,
          path,
          bbox: { x: x - pad, y: y - pad, w: w + 2 * pad, h: h + 2 * pad },
          targetElementIds: [target.id]
        }
        const idx = deck.slides.indexOf(slide) + 1
        const before = JSON.stringify(target)
        state.deck = deck
        const out = await sendChat('Make this picture area a bit smaller and keep it tidy.', {
          selectedSlideId: slide.id,
          regions: [region]
        })
        const after = out.opened.deck.slides
          .find((s) => s.id === slide.id)
          .elements.find((e) => e.id === target.id)
        await selectSlide(idx).catch(() => {})
        await sleep(800)
        await shotRect('09-circle-edit', '[aria-label="Slide editing area"]')
        state.deck = out.opened.deck
        if (out.changes.length === 0)
          throw new Error(`no change; reply: ${out.reply?.text?.slice(0, 200)}`)
        return `slide ${idx} target ${target.type}${target.placeholder ? ' (spot)' : ''}: ${Math.round(w)}x${Math.round(h)} -> ${after ? `${Math.round(after.w)}x${Math.round(after.h)}` : 'gone'}; changed=${before !== JSON.stringify(after)}; changes: ${out.changes.map((c) => c.summary).join(' | ')}`
      })
    }

    // ---- 5. quiz plugin ----------------------------------------------------------------------------------------
    if (wanted('quiz') && state.lessonId) {
      await step('plugin: Quiz, 5 questions, slides at the end', async () => {
        const mark = await eventCount()
        const before = (await call('deck-builder', 'openLesson', { lessonId: state.lessonId })).deck
          .slides.length
        const started = assertOk(
          'plugins:run',
          await call('deck-builder', 'plugins:run', {
            pluginId: 'quiz',
            lessonId: state.lessonId,
            inputs: {
              slides: 'all',
              count: 5,
              types: ['mcq', 'tf'],
              difficulty: 'mixed',
              destination: 'slides'
            },
            context: {
              currentSlideId: state.deck.slides[0].id,
              selectedSlideIds: [state.deck.slides[0].id]
            }
          })
        )
        void started
        await waitFor(
          'the quiz',
          async () => {
            const all = await events(mark)
            const err = all.find((e) => e.tag === 'deck-builder:ai:error')
            if (err) throw new Error(`ai:error ${err.payload.code}: ${err.payload.message}`)
            return all.some((e) => e.tag === 'deck-builder:chat:done') ? all : null
          },
          { timeout: 240_000, every: 1500 }
        )
        const opened = assertOk(
          'openLesson',
          await call('deck-builder', 'openLesson', { lessonId: state.lessonId })
        )
        state.deck = opened.deck
        const added = opened.deck.slides.slice(before)
        await go(page, 'deck-builder', { kind: 'open-lesson', lessonId: state.lessonId })
        await sleep(1000)
        const last = opened.deck.slides.length
        await selectSlide(before + 1).catch(() => {})
        await sleep(800)
        await shotRect('10-quiz-first-slide', '[aria-label="Slide editing area"]')
        if (added.length === 0) throw new Error('no slides were added')
        void last
        return `${before} -> ${opened.deck.slides.length} slides; added kinds [${added.map((s) => s.kind)}]`
      })
    }

    // ---- 6. export + PowerPoint ----------------------------------------------------------------------------------
    if (wanted('export') && state.lessonId) {
      await step('export: .pptx (spots check first, then export anyway)', async () => {
        const first = await call('deck-builder', 'exportPptx', { lessonId: state.lessonId })
        let result = first
        if (first.status === 'spots') {
          results.notes.push(
            `export asked about ${first.count} empty picture spot(s) on slides ${first.slides}`
          )
          result = await call('deck-builder', 'exportPptx', {
            lessonId: state.lessonId,
            ignoreSpots: true
          })
        }
        if (result.status !== 'saved')
          throw new Error(`export: ${JSON.stringify(result).slice(0, 200)}`)
        const bytes = statSync(result.path).size
        return `first call "${first.status}"${first.status === 'spots' ? ` (${first.count} on ${first.slides})` : ''}; saved ${result.fileName} ${Math.round(bytes / 1024)} KB, missing fonts [${result.missingFonts}]`
      })
      await step('export: opens in PowerPoint (COM, windowless) and slide PNGs', async () => {
        const pptx = join(outDir, 'lesson.pptx')
        const comDir = join(outDir, 'com')
        const run = spawnSync(
          'powershell',
          [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            join(root, 'scripts', 'verify-pptx-com.ps1'),
            pptx,
            '-OutDir',
            comDir
          ],
          { encoding: 'utf8', cwd: root, env: cleanElectronEnv(process.env), timeout: 180_000 }
        )
        const out = `${run.stdout ?? ''}${run.stderr ?? ''}`
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
        results.com = out
        if (run.status !== 0)
          throw new Error(
            `PowerPoint check failed: ${out
              .filter((l) => /PROBLEM|error/i.test(l))
              .join(' / ')
              .slice(0, 300)}`
          )
        const pngs = existsSync(comDir) ? readdirSync(comDir).filter((n) => n.endsWith('.png')) : []
        return `${out.find((l) => l.startsWith('slides')) ?? ''}; ${out.at(-1)}; ${pngs.length} PNGs`
      })
    }

    // ---- 7. cost ----------------------------------------------------------------------------------------------------
    await step('usage: app-reported cost vs own tally', async () => {
      const reported = await call('settings', 'getUsage')
      const own = spend()
      // Independent tally from the price table in the docs: $2/M in, $10/M out, $0.20/M cache read, $2.50/M write.
      const hand =
        (own.tokens.in * 2 +
          own.tokens.out * 10 +
          own.tokens.cacheRead * 0.2 +
          own.tokens.cacheWrite * 2.5) /
        1e6
      results.spend = { reported, own, hand }
      if (Math.abs(reported.costUsd - own.usd) > 0.0005)
        throw new Error(`Settings says $${reported.costUsd}, usage.jsonl sums to $${own.usd}`)
      if (Math.abs(hand - own.usd) > 0.005)
        throw new Error(
          `token tally $${hand.toFixed(4)} differs from logged $${own.usd.toFixed(4)}`
        )
      return `Settings: $${reported.costUsd.toFixed(4)} over ${reported.calls} calls; usage.jsonl: $${own.usd.toFixed(4)}; hand tally from tokens: $${hand.toFixed(4)}`
    })
  } finally {
    results.spend ??= { own: spend() }
    const own = spend()
    log(
      `SPEND  $${own.usd.toFixed(3)} in ${own.calls} calls  ${Object.entries(own.byTask)
        .map(([t, v]) => `${t}:${v.calls}/$${v.usd.toFixed(3)}`)
        .join(' ')}`
    )
    log(
      `ERRORS renderer: ${instance.errors.length}${instance.errors.length ? ' ' + redact(instance.errors.slice(0, 3).join(' | ')).slice(0, 400) : ''}`
    )
    results.rendererErrors = instance.errors.map(redact)
    writeFileSync(join(outDir, 'results.json'), redact(JSON.stringify(results, null, 2)))
    await closeAll()
  }
  return results
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) yield* walk(full)
    else yield full
  }
}

function findFile(dir, name) {
  if (!existsSync(dir)) return null
  for (const file of walk(dir)) if (file.endsWith(name)) return file
  return null
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename ?? '')) {
  if (!argv.includes('--real')) {
    console.log('real-ai flow: pass --real to run it (costs real money; needs keyt.txt).')
    process.exit(0)
  }
  try {
    await runRealAi()
  } catch (error) {
    console.error(String(error instanceof Error ? error.message : error).split('\n')[0])
    process.exitCode = 1
  }
}
