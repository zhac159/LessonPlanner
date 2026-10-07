// One screenshot of one screen of the BUILT app (run `npm run build` first), for comparing with
// design/images/NN-*.png. Prints only the PNG path, so reading the result costs one image.
//
//   node scripts/shot.mjs home --seed two-lessons
//   node scripts/shot.mjs deck-builder --intent '{"lessonId":"dck_1"}' --size 1440x940 --name editor
//   node scripts/shot.mjs settings --exe "release/win-unpacked/Slide Planner.exe"
//
// The app starts with the fake AI, test mode and prefers-reduced-motion (no animation, stable
// pixels) on a throwaway data folder; `--seed <name>` is passed as SLIDE_PLANNER_SEED. Default
// size 1440x900 = the width of the design images (03-home is 1440x1320, 01-welcome 1440x940).
import { parseShotArgs } from './e2e/args.mjs'
import { go, launchApp, settle, shot, waitForSplashGone } from './e2e/lib.mjs'

let instance
try {
  const args = parseShotArgs(process.argv.slice(2))
  instance = await launchApp({
    seed: args.seed ?? undefined,
    exe: args.exe ?? undefined,
    reducedMotion: true,
    size: args.size
  })
  const { page } = instance
  await waitForSplashGone(page)
  await go(page, args.moduleId, args.intent)
  await settle(page)
  console.log(await shot(page, args.name))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  await instance?.close()
}
