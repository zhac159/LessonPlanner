/** Renders the whole Home view with fake clients (imported by `*.test.tsx` only). */
import type { ModuleApi, ShellState } from '@renderer/sdk'
import { renderWithApp } from '@test/render'
import { HomeView } from './HomeView'
import { homeFakes, type HomeFakeOptions } from './testSupport'

const api: ModuleApi = { invoke: async () => undefined as never, on: () => () => {} }

/** Home with Alice signed in; `shell` overrides the fake shell, `active` is the visible flag. */
export function renderHome(
  options: HomeFakeOptions = {},
  shell: Partial<ShellState> = {},
  active = true
) {
  const fakes = homeFakes(options)
  const view = renderWithApp(<HomeView api={api} active={active} />, {
    clients: fakes.clients,
    shell: { activeId: 'home', user: { name: 'Alice', claudeConnected: true }, ...shell }
  })
  const rerenderActive = (next: boolean) => view.rerender(<HomeView api={api} active={next} />)
  return { ...view, ...fakes, rerenderActive }
}
