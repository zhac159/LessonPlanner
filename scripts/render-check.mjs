// Real check of the offscreen slide renderer: builds the app, runs the SlideRenderer in Electron (hidden
// window, never shown) on the photosynthesis fixture and writes PNGs to .artifacts/render/ (plain slides,
// a slide with a region loop, the 2x crop, a thumbnail, no-style, and a slide with a real picture asset).
// Read one PNG next to design/images/06-editor.png (slide content only).
//
//   node scripts/render-check.mjs            # build (to .artifacts/render-out), bundle, run, report
//   node scripts/render-check.mjs --no-build # reuse the last build
//
// Prints one line per image and "render-check: OK" / "FAILED". The entry is src/main/render/devCheck.ts.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanElectronEnv } from './e2e/args.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const buildDir = join(root, '.artifacts', 'render-out')
const outDir = join(root, '.artifacts', 'render')
const bundle = join(buildDir, 'devCheck.cjs')
const TIMEOUT_MS = 90_000

const run = (command, args, options = {}) =>
  new Promise((done, fail) => {
    const child = spawn(command, args, { cwd: root, stdio: 'ignore', shell: false, ...options })
    child.on('error', fail)
    child.on('exit', (code) =>
      code === 0 ? done() : fail(new Error(`${command} exited with ${code}`))
    )
  })

async function build() {
  const cli = join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js')
  await run(process.execPath, [cli, 'build', '--outDir', buildDir, '--logLevel', 'error'])
  const { build: esbuild } = await import('esbuild')
  await esbuild({
    entryPoints: [join(root, 'src', 'main', 'render', 'devCheck.ts')],
    outfile: bundle,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
    alias: { '@shared': join(root, 'src', 'shared'), '@main': join(root, 'src', 'main') },
    logLevel: 'error'
  })
}

function launchElectron(profile) {
  const electron = require('electron')
  return new Promise((done, fail) => {
    const child = spawn(electron, [bundle, `--user-data-dir=${profile}`], {
      cwd: root,
      stdio: 'ignore',
      env: {
        ...cleanElectronEnv(process.env),
        RENDER_CHECK_OUT: outDir,
        RENDER_CHECK_BUILD: buildDir
      }
    })
    const timer = setTimeout(() => {
      child.kill()
      fail(new Error(`Electron did not finish within ${TIMEOUT_MS / 1000} s (killed)`))
    }, TIMEOUT_MS)
    child.on('error', fail)
    child.on('exit', () => {
      clearTimeout(timer)
      done()
    })
  })
}

const profile = mkdtempSync(join(tmpdir(), 'slide-planner-render-'))
try {
  if (process.argv.includes('--no-build') ? !existsSync(bundle) : true) await build()
  rmSync(join(outDir, 'result.json'), { force: true })
  await launchElectron(profile)
  const result = JSON.parse(readFileSync(join(outDir, 'result.json'), 'utf8'))
  if (!result.ok) throw new Error(result.error)
  for (const file of result.files)
    console.log(`${file.name}  ${file.size}  ${file.bytes} bytes  ${file.ms} ms`)
  console.log(`targets of the loop on slide 3: ${result.targets.join(', ') || '(none)'}`)
  console.log(`render-check: OK  (${outDir})`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  console.error('render-check: FAILED')
  process.exitCode = 1
} finally {
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
