// Verifies build/installer.nsh (the data-safety part of the installer) WITHOUT running the real installer.
//
//   node build/verify-installer.mjs
//
// It compiles build/keep-data.harness.nsi with the makensis that electron-builder downloaded (so run
// `npm run package` or `package:dir` once), runs the harness against throwaway folders and checks what is left:
//   update, silent uninstall, "--delete-app-data", the "No, delete my data" answer, and the install step.
// What it cannot show: the Windows dialog itself and electron-builder's own wiring; `npm run package` compiles those.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const cache = join(
  process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
  'electron-builder',
  'Cache'
)
const nsisRoot = existsSync(join(cache, 'nsis-3.0.4.1'))
  ? readdirSync(join(cache, 'nsis-3.0.4.1')).find(
      (n) => !n.endsWith('.7z') && !n.endsWith('.state')
    )
  : undefined
const makensis = nsisRoot && join(cache, 'nsis-3.0.4.1', nsisRoot, 'Bin', 'makensis.exe')
if (!makensis || !existsSync(makensis)) {
  console.log(
    'verify-installer: SKIPPED (makensis not in the electron-builder cache; run npm run package once)'
  )
  process.exit(0)
}

const work = mkdtempSync(join(tmpdir(), 'keep-data-'))
let failed = 0
const check = (name, ok) => {
  if (!ok) failed += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
}
const compile = (name, ...defines) => {
  const out = join(work, `${name}.exe`)
  execFileSync(makensis, ['/V1', `/DHARNESS_OUT=${out}`, ...defines, 'keep-data.harness.nsi'], {
    cwd: here
  })
  return out
}
const touch = (dir, rel) => {
  const file = join(dir, rel)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, 'x')
}
/** An install folder as electron-builder lays it out, with the teacher's data inside. */
function fakeInstall(name) {
  const dir = join(work, name)
  for (const rel of [
    'Slide Planner.exe',
    'Uninstall Slide Planner.exe',
    'resources/app.asar',
    'resources/app.asar.unpacked/node_modules/x/y.node',
    'locales/en-GB.pak',
    'data/lessons/les_1/deck.json',
    'data/assets/library/a.png',
    'data/.hidden/secret.json'
  ])
    touch(dir, rel)
  return dir
}
const run = (exe, dir, ...args) =>
  execFileSync(exe, args, { env: { ...process.env, HARNESS_DIR: dir } })
const left = (dir) =>
  existsSync(dir) ? readdirSync(dir, { recursive: true }).map((p) => p.replaceAll('\\', '/')) : []
const dataIntact = (dir) =>
  ['data/lessons/les_1/deck.json', 'data/assets/library/a.png', 'data/.hidden/secret.json'].every(
    (rel) => existsSync(join(dir, rel))
  )
const onlyData = (dir) => left(dir).every((p) => p === 'data' || p.startsWith('data/'))

try {
  const keeper = compile('keeper')
  const asker = compile('asker', '/DKEEPDATA_TEST_ANSWER_NO')

  let dir = fakeInstall('update')
  run(keeper, dir, '--updated')
  check('update: every program file is removed', onlyData(dir))
  check('update: data survives', dataIntact(dir))

  dir = fakeInstall('update-says-no')
  run(asker, dir, '--updated')
  check('update: even a "No" answer cannot delete data (no question is asked)', dataIntact(dir))

  dir = fakeInstall('silent')
  run(keeper, dir)
  check('silent uninstall: program files removed, data kept', onlyData(dir) && dataIntact(dir))

  dir = fakeInstall('answer-yes')
  run(keeper, dir)
  check('uninstall, answer Yes (default): data kept', dataIntact(dir))

  dir = fakeInstall('answer-no')
  run(asker, dir)
  check('uninstall, answer No: everything including data is removed', !existsSync(dir))

  dir = fakeInstall('flag')
  run(keeper, dir, '--delete-app-data')
  check('--delete-app-data removes the data too', !existsSync(dir))

  dir = fakeInstall('flag-update')
  run(keeper, dir, '--updated', '--delete-app-data')
  check('update with --delete-app-data still keeps data', dataIntact(dir))

  dir = join(work, 'fresh')
  mkdirSync(dir)
  run(keeper, dir, '--install')
  check('install: creates data/ and leaves no test file', left(dir).join() === 'data')
} finally {
  rmSync(work, { recursive: true, force: true })
}
console.log(
  failed === 0 ? 'verify-installer: all checks passed' : `verify-installer: ${failed} FAILED`
)
process.exit(failed === 0 ? 0 : 1)
