// Makes sure dependencies are installed and Electron's binary is downloaded.
// A fast no-op when everything is already in place. Run by the VS Code F5 pre-launch task.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync, utimesSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    // npm.cmd needs a shell on Windows; arguments here are fixed strings.
    shell: process.platform === 'win32'
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// 1. node_modules missing, or package.json / package-lock.json newer than the last install.
const installMarker = join(root, 'node_modules', '.package-lock.json')
const manifests = ['package.json', 'package-lock.json']
  .map((name) => join(root, name))
  .filter((file) => existsSync(file))
const stale =
  !existsSync(installMarker) ||
  manifests.some((file) => statSync(file).mtimeMs > statSync(installMarker).mtimeMs)

if (stale) {
  console.log('[ensure-deps] Installing dependencies (npm install)...')
  run(npm, ['install', '--no-audit', '--no-fund'])
  if (existsSync(installMarker)) {
    const now = new Date()
    utimesSync(installMarker, now, now) // avoid re-installing on every run if npm left it untouched
  }
}

// 2. Electron downloads its binary lazily; fetch it now so the first launch is not mysteriously slow.
const electronDir = join(root, 'node_modules', 'electron')
const pathFile = join(electronDir, 'path.txt')
const binaryReady =
  existsSync(pathFile) &&
  existsSync(join(electronDir, 'dist', readFileSync(pathFile, 'utf8').trim()))

if (!binaryReady) {
  console.log('[ensure-deps] Downloading the Electron binary (first run only)...')
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env
  const result = spawnSync(process.execPath, [join(electronDir, 'install.js')], {
    cwd: root,
    stdio: 'inherit',
    env
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

console.log('[ensure-deps] OK')
