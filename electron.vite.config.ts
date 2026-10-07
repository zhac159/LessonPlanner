import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Path aliases shared by all three build targets. Keep in sync with tsconfig.*.json "paths".
const alias = {
  '@shared': resolve('src/shared'),
  '@main': resolve('src/main'),
  '@renderer': resolve('src/renderer/src'),
  '@ui': resolve('src/renderer/src/ui'),
  '@modules': resolve('src/modules')
}

export default defineConfig({
  main: {
    resolve: { alias }
  },
  preload: {
    resolve: { alias },
    build: {
      // The app window's bridge, plus the one of the hidden window that renders slides to PNG.
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts'), render: resolve('src/preload/render.ts') }
      }
    }
  },
  renderer: {
    resolve: { alias },
    plugins: [react()],
    build: {
      // electron-vite leaves the renderer unminified unless asked; minified loads faster.
      minify: 'esbuild',
      // index.html is the app; render.html is the offscreen page that draws slides for the main process.
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          render: resolve('src/renderer/render.html')
        }
      }
    }
  }
})
