import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const alias = {
  '@shared': resolve('src/shared'),
  '@main': resolve('src/main'),
  '@renderer': resolve('src/renderer/src'),
  '@ui': resolve('src/renderer/src/ui'),
  '@modules': resolve('src/modules'),
  '@test': resolve('src/test')
}

/**
 * Two fast projects (see agents/TESTING.md):
 *  - unit:      node environment, `src/**\/*.test.ts`  (pure logic, main-process services)
 *  - component: happy-dom, `src/**\/*.test.tsx`        (React components with Testing Library)
 * End-to-end flows live in scripts/e2e and are NOT run by vitest.
 */
export default defineConfig({
  resolve: { alias },
  esbuild: { jsx: 'automatic' },
  test: {
    // Several agents and test runs share this machine: generous timeouts avoid false failures under load.
    testTimeout: 20_000,
    // Same for hooks: `vi.resetModules()` + `await import()` in a `beforeEach` is a cold transform and took >10 s (the
    // default) when a starved worker had to compile the module.
    hookTimeout: 30_000,
    // `expect.poll` defaults to 1 s, too tight when types, unit and component runs share the CPU.
    expect: { poll: { timeout: 10_000, interval: 25 } },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/*.live.test.ts'],
          environment: 'node'
        }
      },
      {
        extends: true,
        test: {
          name: 'component',
          include: ['src/**/*.test.tsx'],
          environment: 'happy-dom',
          setupFiles: ['src/test/setup.ts'],
          css: false
        }
      }
    ]
  }
})
