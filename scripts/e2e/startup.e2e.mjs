// Startup flow: splash, window chrome, first screen, renderer <-> main round trip, maximise, close.
// First run (no profile) shows the settings wizard instead of Home, so either module is accepted
// until the final integration pass tightens this.

export default async function startup({ launch, check, shot, sleep, waitForSplashGone }) {
  const { app, page, errors } = await launch()

  await page.waitForSelector('[data-testid="splash"]', { state: 'visible', timeout: 15_000 })
  check('splash is shown on launch', true)
  const splashText = (await page.textContent('[data-testid="splash"]')) ?? ''
  check('splash says "Welcome"', /Welcome/.test(splashText), splashText.trim())
  await shot(page, 'startup-splash')

  const closeBox = await page.locator('[data-testid="window-close"]').boundingBox()
  const innerWidth = await page.evaluate(() => window.innerWidth)
  check(
    'close (X) button is in the top-right corner',
    closeBox !== null && closeBox.y < 40 && innerWidth - (closeBox.x + closeBox.width) < 4,
    closeBox
      ? `x=${Math.round(closeBox.x)} y=${Math.round(closeBox.y)} width=${innerWidth}`
      : 'not found'
  )

  await waitForSplashGone(page)
  check('splash exits', true)
  // The first screen is a module: Home, or the settings first-run wizard on a fresh data folder.
  const firstModule = page.locator('[data-testid^="module-"]:visible').first()
  await firstModule.waitFor({ state: 'visible', timeout: 10_000 })
  const moduleId = ((await firstModule.getAttribute('data-testid')) ?? '').replace('module-', '')
  check(
    'home or the settings first-run wizard is shown',
    ['home', 'settings'].includes(moduleId),
    moduleId
  )

  const info = await page.evaluate(() => window.api.app.getInfo())
  check('renderer <-> main round trip works', typeof info.version === 'string', info.version)

  await sleep(700) // let the reveal transition finish before the screenshot
  await shot(page, 'startup-app')

  const isMaximized = () =>
    app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized())
  await page.click('[data-testid="window-maximize"]')
  await sleep(400)
  check('maximize button maximizes the window', (await isMaximized()) === true)
  await page.click('[data-testid="window-maximize"]')
  await sleep(400)
  check('maximize button restores the window', (await isMaximized()) === false)

  check('no renderer errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  const closed = app.waitForEvent('close', { timeout: 10_000 }).then(
    () => true,
    () => false
  )
  await page.click('[data-testid="window-close"]')
  check('close (X) button quits the app', await closed)
}
