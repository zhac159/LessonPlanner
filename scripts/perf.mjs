// Performance report for the BUILT app (run `npm run build` first; it does not build).
//
//   node scripts/perf.mjs [--runs 3] [--exe "release/win-unpacked/Slide Planner.exe"] [--seed home]
//
// Launches the app hidden (fake AI, throwaway data) N times and prints medians. A seed (dev builds only) is applied by
// ONE extra launch first (its time is printed as "seeding, once"); the measured runs then start on that finished data folder,
// like her second launch, so the numbers show the app and not the generation of the demo data (the "assets" seed
// renders twelve pictures and thumbnails: about 8 s of dev-only work that is not part of the app's startup).
//   main ready    process start -> the window starts loading the page (main startup + module activate())
//   splash mounted process start -> page load finished: scripts ran, splash on screen (hidden windows give no paint events)
//   modules ready process start -> the shell has all UI modules (the splash may now exit)
//   splash gone   process start -> splash removed (it plays a fixed ~3.8 s, so this is mostly design, not speed)
//   cpu           CPU seconds used by the main and the renderer process up to "modules ready" (not affected by machine load)
//   first screen  splash removed -> first screen interactive, ms (Home with a seed, the Settings wizard when packaged)
//   idle memory   sum of the working sets of every process of the app, 2 s after the splash is gone
// plus static sizes: renderer JS per chunk, what the renderer loaded at startup, main bundle, out/ size.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchApp, root } from './e2e/lib.mjs'

const argv = process.argv.slice(2)
const option = (name, fallback) => {
  const at = argv.indexOf(`--${name}`)
  return at >= 0 ? argv[at + 1] : fallback
}
const runs = Number(option('runs', '3'))
const seed = option('seed', 'home')
const exe = option('exe', undefined)

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const kb = (bytes) => `${(bytes / 1024).toFixed(0)} kB`
const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`
const sec = (ms) => `${(ms / 1000).toFixed(2)} s`

/** Sum of working sets (bytes) and the process count of the app's whole process tree. */
function processTree(rootPid) {
  const script = `
$all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, WorkingSetSize
$ids = @(${rootPid}); $sum = 0; $count = 0
for ($i = 0; $i -lt $ids.Count; $i++) {
  foreach ($p in $all) {
    if ($p.ProcessId -eq $ids[$i]) { $sum += $p.WorkingSetSize; $count++ }
    if ($p.ParentProcessId -eq $ids[$i]) { $ids += $p.ProcessId }
  }
}
"$sum $count"`
  const out = execFileSync('powershell', ['-NoProfile', '-Command', script], {
    encoding: 'utf8'
  }).trim()
  const [bytes, count] = out.split(' ').map(Number)
  return { bytes, count }
}

async function measureRun(dataDir) {
  const { app, page, close } = await launchApp({ seed, exe, dataDir })
  try {
    const pid = app.process().pid
    const created = await app.evaluate(() => process.getCreationTime())
    // Hidden windows report no paint entries, so the end of the page load (scripts run, splash mounted) stands in.
    const early = await page.evaluate(async () => {
      const nav = performance.getEntriesByType('navigation')[0]
      const origin = performance.timeOrigin
      const loadEnd = nav ? nav.loadEventEnd : performance.now()
      while (!(window.__shell && window.__shell.getState().modules.length > 0))
        await new Promise((done) => setTimeout(done, 3))
      return { origin, loadEnd, ready: Date.now() }
    })
    // CPU seconds used so far by each kind of process: unlike wall time this does not move with other programs' load.
    const cpu = await app.evaluate(({ app: electronApp }) => {
      const used = (type) =>
        electronApp
          .getAppMetrics()
          .filter((m) => m.type === type)
          .reduce((sum, m) => sum + m.cpu.cumulativeCPUUsage, 0)
      return { main: used('Browser'), renderer: used('Tab') }
    })
    const cdp = await page.context().newCDPSession(page)
    const tree = await cdp.send('Page.getResourceTree')
    const startupFiles = tree.frameTree.resources
      .filter((r) => r.type === 'Script' || r.type === 'Stylesheet')
      .map((r) => r.url.split('/').pop())
    await page.waitForSelector('[data-testid="splash"]', { state: 'detached', timeout: 20_000 })
    const gone = await page.evaluate(() => performance.timeOrigin + performance.now())
    const homeAt = await page.evaluate(async () => {
      const start = performance.now()
      const ready = () => {
        // Home with a seed; the first-run Settings wizard in a packaged app (seeds are ignored there).
        const home = document.querySelector('[data-testid^="module-"]')
        const button = home?.querySelector('button, a, input')
        return home !== null && button !== null && !button.closest('[inert]')
      }
      while (!ready()) await new Promise((done) => setTimeout(done, 5))
      return performance.now() - start
    })
    await sleep(2000)
    const memory = processTree(pid)
    return {
      mainReady: early.origin - created,
      splashPaint: early.origin + early.loadEnd - created,
      modulesReady: early.ready - created,
      splashGone: gone - created,
      homeAfter: homeAt,
      cpuMain: cpu.main,
      cpuRenderer: cpu.renderer,
      memory: memory.bytes,
      processes: memory.count,
      startupFiles
    }
  } finally {
    await close()
  }
}

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(path))
    else files.push({ path, size: statSync(path).size })
  }
  return files
}

function printStatic(startupFiles) {
  const out = join(root, 'out')
  if (!existsSync(out)) return console.log('no out/ folder: run npm run build')
  const assets = walk(join(out, 'renderer', 'assets'))
  const js = assets.filter((f) => f.path.endsWith('.js')).sort((a, b) => b.size - a.size)
  const css = assets.filter((f) => f.path.endsWith('.css'))
  const total = (list) => list.reduce((sum, f) => sum + f.size, 0)
  const name = (f) => f.path.split(/[\\/]/).pop()
  const loaded = new Set(startupFiles)
  console.log(
    `\nrenderer: ${js.length} JS chunks ${kb(total(js))}, ${css.length} CSS ${kb(total(css))}; loaded at startup: ` +
      `${js.filter((f) => loaded.has(name(f))).length} JS ${kb(total(js.filter((f) => loaded.has(name(f)))))}, ` +
      `${css.filter((f) => loaded.has(name(f))).length} CSS`
  )
  const lazy = js.filter((f) => !loaded.has(name(f)))
  console.log(`lazy (loaded on first use of a screen): ${lazy.length} JS ${kb(total(lazy))}`)
  console.log('largest JS chunks (* = loaded at startup):')
  for (const f of js.slice(0, 8))
    console.log(`  ${loaded.has(name(f)) ? '*' : ' '} ${name(f).padEnd(40)} ${kb(f.size)}`)
  const main = walk(join(out, 'main'))
  const mainJs = main.filter((f) => f.path.endsWith('.js'))
  const entry = mainJs.find((f) => name(f) === 'index.js')
  console.log(
    `main: index.js ${kb(entry?.size ?? 0)}, ${mainJs.length} JS files ${kb(total(mainJs))}; ` +
      `native/other ${kb(total(main.filter((f) => !f.path.endsWith('.js'))))}`
  )
  console.log(`out/ total: ${mb(total(walk(out)))}`)
}

// Seeds are ignored by a packaged app, so only a dev build gets the one-off seeding launch.
const dataDir =
  !exe && seed !== 'empty' ? mkdtempSync(join(tmpdir(), 'slide-planner-perf-')) : undefined
let seeding = null
if (dataDir) {
  seeding = await measureRun(dataDir)
  await sleep(500)
}
const results = []
for (let i = 0; i < runs; i++) {
  results.push(await measureRun(dataDir))
  await sleep(500)
}
if (dataDir) rmSync(dataDir, { recursive: true, force: true })
const col = (key) => median(results.map((r) => r[key]))
console.log(`perf: ${runs} runs, seed "${seed}", ${exe ?? 'out/ via electron'}; medians`)
if (seeding)
  console.log(`  seeding, once  ${sec(seeding.mainReady)} (dev-only demo data; not startup)`)
console.log(`  main ready     ${sec(col('mainReady'))}`)
console.log(`  splash mounted ${sec(col('splashPaint'))}`)
console.log(`  modules ready  ${sec(col('modulesReady'))}`)
console.log(`  splash gone    ${sec(col('splashGone'))}`)
console.log(
  `  cpu at ready   main ${col('cpuMain').toFixed(2)} s, renderer ${col('cpuRenderer').toFixed(2)} s`
)
console.log(`  first screen   ${col('homeAfter').toFixed(0)} ms`)
console.log(`  idle memory    ${mb(col('memory'))} in ${col('processes')} processes`)
printStatic(results[0].startupFiles)
