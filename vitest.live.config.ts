import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * LIVE tests: they call the real Claude API with the key in keyt.txt and cost real money.
 * Off by default (`npm run check` excludes `*.live.test.ts`). Run: `npm run test:live` (or add a file filter).
 * See src/main/ai/live/README in the file header of harness.ts.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@main': resolve('src/main'),
      '@renderer': resolve('src/renderer/src'),
      '@ui': resolve('src/renderer/src/ui'),
      '@modules': resolve('src/modules'),
      '@test': resolve('src/test')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.live.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    fileParallelism: false
  }
})
