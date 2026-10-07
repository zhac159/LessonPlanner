/** Waiting until a freshly drawn slide is final: fonts loaded, pictures decoded, text fitted. */

/** Longest wait for pictures before the render goes ahead without them. */
export const IMAGE_TIMEOUT_MS = 5000
/** If the window does not tick animation frames, carry on after this long instead of hanging. */
const FRAME_FALLBACK_MS = 50

/** Resolves after the next animation frame (or shortly, if frames are not being delivered). */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, FRAME_FALLBACK_MS)
    requestAnimationFrame(() => {
      clearTimeout(timer)
      resolve()
    })
  })
}

async function frames(count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) await nextFrame()
}

/** Resolves when the picture has loaded (or failed: the alt text is then what is drawn). */
async function imageSettled(image: HTMLImageElement): Promise<void> {
  if (!image.complete) {
    await new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true })
      image.addEventListener('error', () => resolve(), { once: true })
    })
  }
  try {
    await image.decode()
  } catch {
    // Broken or undecodable pictures are drawn as the browser shows them.
  }
}

export interface SettleOptions {
  /** Loads the style's fonts (the `@ui/slide` loader); a failure only means the fallback stack is used. */
  loadFonts: () => Promise<unknown>
  imageTimeoutMs?: number
}

/**
 * Resolves once `root` is ready to be photographed. Fonts are loaded first, then two frames pass so the
 * browser has requested the font files the text actually uses, then everything pending is awaited
 * (`document.fonts.ready`, every `<img>`), then two more frames let the text fitting re-measure and paint.
 */
export async function waitUntilSettled(root: HTMLElement, options: SettleOptions): Promise<void> {
  await options.loadFonts().catch(() => undefined)
  await frames(2)
  await document.fonts?.ready
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, options.imageTimeoutMs ?? IMAGE_TIMEOUT_MS)
  })
  const images = Array.from(root.querySelectorAll('img')).map(imageSettled)
  try {
    await Promise.race([Promise.all(images), timeout])
  } finally {
    clearTimeout(timer)
  }
  await frames(2)
}
