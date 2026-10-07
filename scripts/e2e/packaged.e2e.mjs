// The packaged-app risks, in one launch: the three features that depend on native code or files
// that are NOT inside the JavaScript bundle. Run it against the packaged app:
//
//   node scripts/e2e/run.mjs --exe "release/win-unpacked/Slide Planner.exe" --only packaged
//
//   1. slide render      a lesson's thumbnail is drawn by the hidden render window (render.html + its preload)
//   2. PowerPoint export pptxgenjs + jszip + resvg (native .node, unpacked from the asar) write a real .pptx
//   3. PDF import        pdfjs-dist (its worker file, unpacked from the asar) reads a PDF; the .pptx from step 2
//                        is imported too (jszip + XML), as style sources
//   4. data folder       (packaged only) a launch with no overrides writes next to the exe, not to %APPDATA%, and a
//                        second launch finds the same lesson (what an update in place relies on; see build/installer.nsh)
//   5. lazy screens     the Lessons and Styles screens are separate chunks loaded on first use: they must open from the asar
//   6. your assets      a generated PDF (a JPEG and a Flate picture), an SVG and a PNG are added to the library: pdfjs and its
//                       JPEG decoder (pdfjs-dist/legacy/image_decoders, unpacked from the asar) cut the pictures out, nativeImage
//                       and resvg make the thumbnails, and a deck with a JPEG and an SVG asset is exported to .pptx
//                       (the library also has to be written under <exe folder>/data in the packaged check below)
// Fake AI, throwaway data folder. Against out/ (no --exe) it runs steps 1 to 3 and 6 only.
import JSZip from 'jszip'
import PptxGenJS from 'pptxgenjs'
import { _electron as electron } from 'playwright-core'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { crc32, deflateSync } from 'node:zlib'
import { cleanElectronEnv } from './args.mjs'

/** A photo-like RGBA picture (gradient, a few shapes, noise), deterministic per seed: it passes the "is a real picture" checks. */
function photoRgba(width, height, seed) {
  let s = seed * 2654435761 + 1
  const rand = () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296
  const shapes = Array.from({ length: 12 }, () => ({
    cx: rand() * width,
    cy: rand() * height,
    rx: (0.08 + rand() * 0.25) * width,
    ry: (0.08 + rand() * 0.25) * height,
    color: [rand() * 255, rand() * 255, rand() * 255]
  }))
  const out = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let c = [60 + (x / width) * 150, 40 + (y / height) * 160, 200 - (x / width) * 120]
      for (const sh of shapes) {
        const dx = (x - sh.cx) / sh.rx
        const dy = (y - sh.cy) / sh.ry
        if (dx * dx + dy * dy < 1) c = sh.color
      }
      const noise = (rand() - 0.5) * 12
      const at = (y * width + x) * 4
      out[at] = Math.max(0, Math.min(255, c[0] + noise))
      out[at + 1] = Math.max(0, Math.min(255, c[1] + noise))
      out[at + 2] = Math.max(0, Math.min(255, c[2] + noise))
      out[at + 3] = 255
    }
  return out
}

/** A PNG file (8-bit RGBA) of the pixels. */
function encodePng(width, height, rgba) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const out = Buffer.alloc(body.length + 8)
    out.writeUInt32BE(data.length, 0)
    body.copy(out, 4)
    out.writeUInt32BE(crc32(body), body.length + 4)
    return out
  }
  const head = Buffer.alloc(13)
  head.writeUInt32BE(width, 0)
  head.writeUInt32BE(height, 4)
  head[8] = 8
  head[9] = 6
  const rows = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++)
    rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/**
 * A one-page PDF holding two pictures: a DCTDecode one (the JPEG bytes as they are) and a FlateDecode RGB one.
 * Object ids: 1 catalog, 2 pages, 3 page, 4 content, 5 JPEG, 6 RGB.
 */
function makePdfWithPictures(jpeg, jpegSize, rgb, rgbSize) {
  const content =
    'q 250 0 0 190 40 180 cm /Im1 Do Q\nq 250 0 0 190 400 180 cm /Im2 Do Q\n' +
    'BT /F1 20 Tf 40 360 Td (Plant cell and leaf) Tj ET\n'
  const rgbBytes = Buffer.alloc(rgbSize.width * rgbSize.height * 3)
  for (let i = 0, j = 0; i < rgb.length; i += 4, j += 3) rgb.copy(rgbBytes, j, i, i + 3)
  const parts = []
  const offsets = []
  let length = 0
  const push = (value) => {
    const buf = typeof value === 'string' ? Buffer.from(value, 'latin1') : value
    parts.push(buf)
    length += buf.length
  }
  const object = (id, dict, stream) => {
    offsets[id] = length
    push(`${id} 0 obj\n<< ${dict}${stream ? ` /Length ${stream.length}` : ''} >>\n`)
    if (stream) {
      push('stream\n')
      push(stream)
      push('\nendstream\n')
    }
    push('endobj\n')
  }
  push('%PDF-1.4\n')
  object(1, '/Type /Catalog /Pages 2 0 R')
  object(2, '/Type /Pages /Kids [3 0 R] /Count 1')
  object(
    3,
    '/Type /Page /Parent 2 0 R /MediaBox [0 0 720 405] /Contents 4 0 R /Resources << /Font << /F1 7 0 R >> /XObject << /Im1 5 0 R /Im2 6 0 R >> >>'
  )
  object(4, '', Buffer.from(content, 'latin1'))
  const image = (size) =>
    `/Type /XObject /Subtype /Image /Width ${size.width} /Height ${size.height} /ColorSpace /DeviceRGB /BitsPerComponent 8`
  object(5, `${image(jpegSize)} /Filter /DCTDecode`, jpeg)
  object(6, `${image(rgbSize)} /Filter /FlateDecode`, deflateSync(rgbBytes))
  object(7, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')
  const xref = length
  push(`xref\n0 8\n0000000000 65535 f \n`)
  for (let id = 1; id < 8; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  push(`trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return Buffer.concat(parts)
}

const SVG_ASSET =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160" width="240" height="160"><rect width="240" height="160" fill="#f4a261"/><circle cx="80" cy="80" r="48" fill="#264653"/><path d="M130 40 L210 80 L130 120 Z" fill="#e9c46a"/></svg>'

/** A one-page PDF with real text (Helvetica, not embedded), byte offsets computed for a valid xref. */
function makePdf(text) {
  const content = `BT /F1 24 Tf 72 700 Td (${text}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((body, i) => {
    const at = pdf.length
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
    return at
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const at of offsets) pdf += `${String(at).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

const call = (page, moduleId, channel, ...args) =>
  page.evaluate(([m, c, a]) => window.api.modules.invoke(m, c, ...a), [moduleId, channel, args])

/** Adds files to the library the way a drop does: cut out, review batch, tick everything, save. */
async function addToLibrary(page, paths, sleep) {
  const added = await call(page, 'assets', 'add:paths', { paths })
  if (added.ok !== true) return { added, view: null, saved: [] }
  const view = await until(
    () => call(page, 'assets', 'review:get'),
    (v) => v.stillReading === 0 && v.batches.every((b) => !b.working),
    45_000,
    sleep
  )
  for (const c of view.candidates.filter((c) => !c.keep))
    await call(page, 'assets', 'review:edit', { candidateId: c.id, keep: true })
  const accepted = await call(page, 'assets', 'review:accept', { batchId: added.batchId })
  return { added, view, saved: accepted.added ?? [] }
}

async function until(read, done, timeoutMs, sleep) {
  const deadline = Date.now() + timeoutMs
  for (let value = await read(); ; value = await read()) {
    if (done(value) || Date.now() > deadline) return value
    await sleep(250)
  }
}

const listTree = (dir, base = dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory()
      ? [`${path.slice(base.length + 1)}/`, ...listTree(path, base)]
      : [path.slice(base.length + 1)]
  })

/** Files under the per-user folders Electron apps normally use that changed after `since` (ms). */
function profileWrites(since) {
  const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming')
  const newer = (dir) =>
    existsSync(dir) ? listTree(dir).filter((f) => statSync(join(dir, f)).mtimeMs > since) : []
  return ['Slide Planner', 'slide-planner', 'Planning App'].flatMap((name) =>
    newer(join(appData, name)).map((f) => `${name}/${f}`)
  )
}

export default async function packaged({ launch, check, go, sleep, waitForSplashGone, root }) {
  const work = mkdtempSync(join(tmpdir(), 'slide-planner-packaged-'))
  const exportPath = join(work, 'Photosynthesis.pptx')
  const pdfPath = join(work, 'Scheme of work.pdf')
  writeFileSync(
    pdfPath,
    makePdf('Photosynthesis scheme of work for Year 8 science: light, water and carbon dioxide')
  )
  try {
    const { app, page, errors, close } = await launch({
      env: { SLIDE_PLANNER_TEST_SAVE_PATH: exportPath }
    })
    await waitForSplashGone(page)
    const info = await page.evaluate(() => window.api.app.getInfo())

    // 1. A lesson with one blank slide; its thumbnail is drawn by the hidden render window.
    const made = await call(page, 'deck-builder', 'createLesson', {
      objectivesText: 'Explain how plants make food',
      documentIds: [],
      styleId: null,
      title: 'Photosynthesis',
      meta: {},
      startGeneration: false,
      blankSlide: true
    })
    check('a lesson can be created', made.ok === true, JSON.stringify(made).slice(0, 200))
    const lessonId = made.lessonId
    const withThumb = await until(
      async () => (await call(page, 'deck-builder', 'listLessons')).find((l) => l.id === lessonId),
      (lesson) => Boolean(lesson?.thumbDataUrl),
      20_000,
      sleep
    )
    check(
      'slide render: the lesson thumbnail is a PNG drawn by the render window',
      /^data:image\/png;base64,/.test(withThumb?.thumbDataUrl ?? '') &&
        withThumb.thumbDataUrl.length > 1000,
      String(withThumb?.thumbDataUrl).slice(0, 40)
    )

    // 2. PowerPoint export (the Save dialog is answered by SLIDE_PLANNER_TEST_SAVE_PATH).
    const opened = await call(page, 'deck-builder', 'openLesson', { lessonId })
    check('the lesson opens', opened.ok === true)
    // A diagram goes through resvg (the native module) when it is exported.
    const diagram = {
      id: 'el_packaged_diagram',
      type: 'diagram',
      x: 100,
      y: 300,
      w: 600,
      h: 300,
      alt: 'A white circle on teal',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="#2a9d8f"/><circle cx="100" cy="50" r="30" fill="#ffffff"/></svg>'
    }
    const edited = await call(page, 'deck-builder', 'applyOps', {
      lessonId,
      summary: 'Add a diagram',
      ops: [{ op: 'addElement', slideId: opened.deck.slides[0].id, element: diagram }]
    })
    check(
      'a diagram is added to the slide',
      edited.ok === true,
      JSON.stringify(edited).slice(0, 200)
    )
    const exported = await call(page, 'deck-builder', 'exportPptx', { lessonId })
    check(
      'PowerPoint export reports saved',
      exported.status === 'saved',
      JSON.stringify(exported).slice(0, 200)
    )
    const bytes = existsSync(exportPath) ? readFileSync(exportPath) : Buffer.alloc(0)
    check(
      'the .pptx is a zip file',
      bytes.length > 5000 && bytes.subarray(0, 2).toString() === 'PK'
    )
    const zip = await JSZip.loadAsync(bytes)
    const pictures = await Promise.all(
      Object.keys(zip.files)
        .filter((name) => /^ppt\/media\/.+\.png$/.test(name))
        .map((name) => zip.file(name).async('nodebuffer'))
    )
    const widths = pictures.map((png) => png.readUInt32BE(16))
    check(
      'the diagram was rasterised into the .pptx (resvg)',
      widths.some((width) => width >= 600),
      `picture widths: ${widths.join(', ') || 'none'}`
    )

    // 3. PDF and PowerPoint import, as the sources of a new style.
    const draft = await call(page, 'style-library', 'createDraft', {
      paths: [pdfPath, exportPath]
    })
    check('both files are accepted as style sources', draft.ok === true && draft.added === 2)
    const settled = await until(
      async () => (await call(page, 'style-library', 'get', { styleId: draft.styleId })).style,
      (style) => style.files.every((f) => f.status === 'learned' || f.status === 'failed'),
      30_000,
      sleep
    )
    const byKind = Object.fromEntries(settled.files.map((f) => [f.kind, f]))
    check(
      'PDF import: pdfjs read the page',
      byKind.pdf?.units === 1 && byKind.pdf.status === 'learned',
      JSON.stringify(byKind.pdf)
    )
    check(
      'PowerPoint import: the exported deck was digested',
      byKind.pptx?.units === 1 && byKind.pptx.status === 'learned',
      JSON.stringify(byKind.pptx)
    )
    // 5. The two lazily loaded screens (their code is fetched from the asar the first time they open).
    for (const [moduleId, marker] of [
      ['style-library', 'Create a style|Your styles|Styles'],
      ['deck-builder', 'New lesson|Lessons|lesson']
    ]) {
      await go(page, moduleId)
      const slot = page.locator(`[data-testid="module-${moduleId}"]`)
      await slot.locator('.module-loading').waitFor({ state: 'detached', timeout: 15_000 })
      const text = (await slot.innerText()).trim()
      check(
        `lazy screen "${moduleId}" loaded and rendered`,
        text.length > 0 && new RegExp(marker, 'i').test(text) && !/hit a problem/i.test(text),
        text.slice(0, 80)
      )
    }
    // 6. Your assets: extraction from a PDF, an SVG and a PNG, thumbnails, and an export that embeds assets.
    const jpegSize = { width: 640, height: 480 }
    const rgbSize = { width: 600, height: 450 }
    // nativeImage (main process) makes the JPEGs, so the packaged Electron's image codecs are used too.
    const makeJpeg = async (size, seed) => {
      const pixels = photoRgba(size.width, size.height, seed)
      const bgra = Buffer.alloc(pixels.length)
      for (let i = 0; i < pixels.length; i += 4) {
        bgra[i] = pixels[i + 2]
        bgra[i + 1] = pixels[i + 1]
        bgra[i + 2] = pixels[i]
        bgra[i + 3] = 255
      }
      const base64 = await app.evaluate(
        ({ nativeImage }, [b64, w, h]) =>
          nativeImage
            .createFromBitmap(Buffer.from(b64, 'base64'), { width: w, height: h })
            .toJPEG(90)
            .toString('base64'),
        [bgra.toString('base64'), size.width, size.height]
      )
      return Buffer.from(base64, 'base64')
    }
    const jpegFile = await makeJpeg(jpegSize, 7)
    const looseJpeg = await makeJpeg({ width: 500, height: 380 }, 33)
    check(
      'nativeImage encodes a JPEG in the packaged app',
      jpegFile[0] === 0xff && jpegFile[1] === 0xd8
    )
    const assetPdf = join(work, 'Cells deck.pdf')
    writeFileSync(
      assetPdf,
      makePdfWithPictures(jpegFile, jpegSize, photoRgba(rgbSize.width, rgbSize.height, 11), rgbSize)
    )
    const svgPath = join(work, 'Sun and moon.svg')
    writeFileSync(svgPath, SVG_ASSET)
    const pngPath = join(work, 'Leaf photo.png')
    writeFileSync(pngPath, encodePng(220, 160, photoRgba(220, 160, 21)))

    const pdfBatch = await addToLibrary(page, [assetPdf], sleep)
    const found = (pdfBatch.view?.candidates ?? []).filter(
      (c) => c.batchId === pdfBatch.added.batchId
    )
    check(
      'asset extraction: the PDF gives two pictures (JPEG through pdfjs decoder, Flate through pdfjs)',
      found.length === 2 &&
        found.every((c) => c.width >= 600 && c.thumbDataUrl && c.leftOut === null),
      `candidates: ${found.map((c) => `${c.width}x${c.height}/${c.leftOut?.reason ?? 'ok'}`).join(', ')}; ` +
        `files: ${JSON.stringify(pdfBatch.view?.batches.find((b) => b.id === pdfBatch.added.batchId)?.files.map((f) => [f.state, f.found, f.error]))}`
    )
    check('the PDF pictures are saved in the library', pdfBatch.saved.length === 2)
    // A loose JPEG is decoded by the pdfjs JPEG decoder (pdfjs-dist/legacy/image_decoders), read from disk at run time.
    const jpgPath = join(work, 'Classroom.jpg')
    writeFileSync(jpgPath, looseJpeg)
    const vector = await addToLibrary(page, [svgPath, pngPath, jpgPath], sleep)
    check(
      'an SVG, a PNG and a JPEG file are saved in the library',
      vector.saved.length === 3,
      JSON.stringify(vector.added).slice(0, 200)
    )
    const looseCandidates = (vector.view?.candidates ?? []).filter(
      (c) => c.batchId === vector.added.batchId
    )
    check(
      'a loose JPEG is decoded (pdfjs image decoder is in the package): not left out as unreadable',
      looseCandidates.length === 3 &&
        looseCandidates.every((c) => c.leftOut?.reason !== 'unreadable'),
      looseCandidates.map((c) => `${c.width}x${c.height}/${c.leftOut?.reason ?? 'ok'}`).join(', ')
    )
    // A JPEG inside a .pptx goes through the pure decoder (pdfjs-dist/legacy/image_decoders): a package that
    // lacks that file reads every such picture as "unreadable".
    const deckPptx = join(work, 'Old deck.pptx')
    const oldDeck = new PptxGenJS()
    oldDeck.layout = 'LAYOUT_16x9'
    oldDeck.addSlide().addImage({
      data: `image/jpeg;base64,${(await makeJpeg({ width: 700, height: 500 }, 44)).toString('base64')}`,
      x: 1,
      y: 1,
      w: 5,
      h: 3.5
    })
    writeFileSync(deckPptx, await oldDeck.write({ outputType: 'nodebuffer' }))
    const fromDeck = await addToLibrary(page, [deckPptx], sleep)
    const deckCandidates = (fromDeck.view?.candidates ?? []).filter(
      (c) => c.batchId === fromDeck.added.batchId
    )
    check(
      'a JPEG in a PowerPoint is cut out and readable (pdfjs JPEG decoder is packaged)',
      deckCandidates.length === 1 && deckCandidates[0].leftOut === null,
      deckCandidates.map((c) => `${c.width}x${c.height}/${c.leftOut?.reason ?? 'ok'}`).join(', ') ||
        'no candidates'
    )
    const library = await until(
      () => call(page, 'assets', 'list', { limit: 100 }),
      (list) => list.items.length >= 6 && list.items.every((a) => a.thumbDataUrl),
      20_000,
      sleep
    )
    const pngThumb = /^data:image\/png;base64,/
    check(
      'library thumbnails exist for every asset (SVG via resvg, PNG and JPEG via nativeImage)',
      library.items.length >= 6 && library.items.every((a) => pngThumb.test(a.thumbDataUrl ?? '')),
      library.items
        .map((a) => `${a.title}:${a.thumbDataUrl ? a.thumbDataUrl.length : 'none'}`)
        .join(', ')
    )
    const svgAsset =
      vector.saved.find((a) => /svg|sun|moon/i.test(`${a.name} ${a.title}`)) ?? vector.saved[0]
    const jpegAsset = pdfBatch.saved.find((a) => a.width === jpegSize.width) ?? pdfBatch.saved[0]
    const slideId = opened.deck.slides[0].id
    const placedSvg = await call(page, 'deck-builder', 'placeAsset', {
      lessonId,
      slideId,
      source: { kind: 'library', assetId: svgAsset.id },
      target: { kind: 'box', box: { x: 100, y: 80, w: 480, h: 240 } },
      fit: 'fit'
    })
    const placedJpeg = await call(page, 'deck-builder', 'placeAsset', {
      lessonId,
      slideId,
      source: { kind: 'library', assetId: jpegAsset.id },
      target: { kind: 'box', box: { x: 1000, y: 80, w: 600, h: 450 } },
      fit: 'fit'
    })
    check(
      'an SVG asset and a JPEG asset are placed on the slide',
      placedSvg.ok === true && placedJpeg.ok === true,
      JSON.stringify([placedSvg, placedJpeg]).slice(0, 240)
    )
    rmSync(exportPath, { force: true })
    const exportedAssets = await call(page, 'deck-builder', 'exportPptx', { lessonId })
    check(
      'PowerPoint export with assets reports saved',
      exportedAssets.status === 'saved',
      JSON.stringify(exportedAssets).slice(0, 200)
    )
    const assetZip = await JSZip.loadAsync(
      existsSync(exportPath) ? readFileSync(exportPath) : Buffer.alloc(0)
    )
    const media = Object.keys(assetZip.files).filter((n) => /^ppt\/media\//.test(n))
    check(
      'the .pptx embeds the JPEG asset and the rasterised SVG asset',
      media.some((n) => /\.jpe?g$/i.test(n)) && media.filter((n) => /\.png$/i.test(n)).length >= 2,
      media.join(', ')
    )
    check('no renderer errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    await close()

    // 4. Where a packaged app keeps its data.
    if (info.isPackaged) {
      const exe = resolve(root, process.argv[process.argv.indexOf('--exe') + 1])
      const dataFolder = join(dirname(exe), 'data')
      const existed = existsSync(dataFolder)
      const started = Date.now()
      const env = cleanElectronEnv(process.env)
      delete env.SLIDE_PLANNER_DATA_DIR
      env.SLIDE_PLANNER_FAKE_AI = '1'
      const app = await electron.launch({ executablePath: exe, args: [], env, timeout: 30_000 })
      try {
        const win = await until(
          async () => app.windows().find((w) => !w.url().endsWith('/render.html')),
          Boolean,
          20_000,
          sleep
        )
        await win.waitForFunction(() => typeof window.api !== 'undefined')
        const created = await win.evaluate(() =>
          window.api.modules.invoke('deck-builder', 'createLesson', {
            objectivesText: 'x',
            documentIds: [],
            styleId: null,
            title: 'Data folder check',
            meta: {},
            startGeneration: false,
            blankSlide: true
          })
        )
        const stored = await addToLibrary(win, [pngPath], sleep)
        await sleep(1500)
        check('a lesson is saved in the packaged app', created.lessonId !== undefined)
        check('a library asset is saved in the packaged app', stored.saved.length === 1)
      } finally {
        await app.close().catch(() => undefined)
        await sleep(500)
      }
      // A second launch (an update in place restarts the app on the same folder) must still see the lesson.
      const again = await electron.launch({ executablePath: exe, args: [], env, timeout: 30_000 })
      try {
        const win = await until(
          async () => again.windows().find((w) => !w.url().endsWith('/render.html')),
          Boolean,
          20_000,
          sleep
        )
        await win.waitForFunction(() => typeof window.api !== 'undefined')
        const lessons = await win.evaluate(() =>
          window.api.modules.invoke('deck-builder', 'listLessons')
        )
        check(
          'a second launch still lists the lesson (data persists in <exe folder>/data)',
          lessons.some((l) => l.title === 'Data folder check'),
          lessons.map((l) => l.title).join(', ')
        )
      } finally {
        await again.close().catch(() => undefined)
        await sleep(500)
      }
      const files = existsSync(dataFolder) ? listTree(dataFolder) : []
      mkdirSync(join(root, '.artifacts', 'e2e'), { recursive: true })
      writeFileSync(
        join(root, '.artifacts', 'e2e', 'packaged-data-listing.txt'),
        `${dataFolder}\n${files.join('\n')}\n`
      )
      check(
        'data is written next to the exe (<exe folder>/data)',
        files.some((f) => /lessons[\\/].+deck\.json$/.test(f)) &&
          files.some((f) => /assets[\\/]library[\\/].+[\\/]file\.png$/.test(f)) &&
          files.some((f) => /assets[\\/]library[\\/].+[\\/]thumb\.png$/.test(f)) &&
          files.length > 8,
        `${files.length} entries in ${dataFolder}`
      )
      const strays = profileWrites(started - 1000)
      check('nothing is written to %APPDATA%', strays.length === 0, strays.slice(0, 3).join(', '))
      if (!existed) rmSync(dataFolder, { recursive: true, force: true })
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}
