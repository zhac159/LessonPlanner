/** The fonts bundled with the app for slides (@fontsource, loaded lazily) and the app-wide loader. */
import { createFontLoader, type BundledFont, type FontRegistry } from './fonts'

const fontsource = (cssFamily: string, load: () => Promise<unknown>): BundledFont => ({
  cssFamily,
  load
})

export const BUNDLED_FONTS: FontRegistry = {
  lexend: fontsource('Lexend Variable', () => import('@fontsource-variable/lexend')),
  'open sans': fontsource('Open Sans Variable', () => import('@fontsource-variable/open-sans')),
  nunito: fontsource('Nunito Variable', () => import('@fontsource-variable/nunito')),
  inter: fontsource('Inter Variable', () => import('@fontsource-variable/inter')),
  poppins: fontsource('Poppins', async () => {
    await Promise.all([
      import('@fontsource/poppins/400.css'),
      import('@fontsource/poppins/500.css'),
      import('@fontsource/poppins/600.css'),
      import('@fontsource/poppins/700.css')
    ])
  })
}

/** The app-wide slide font loader. */
export const slideFonts = createFontLoader(BUNDLED_FONTS)
