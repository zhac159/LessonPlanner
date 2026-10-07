/** Test-only: renders the Create a style screen with a fake style-library client. */
import type { ContractImpl } from '@shared/contract'
import type { StyleDraftView, StyleLibraryApi } from '@shared/contracts/style-library'
import type { ShellState } from '@renderer/sdk'
import { createFakeClients, renderWithApp } from '@test/render'
import { fakeStyles } from '../testClients'
import { StyleEditor, type StyleEditorProps } from './StyleEditor'

export interface HarnessOptions {
  view: StyleDraftView | null
  styleId?: string | null
  mode?: 'new' | 'edit'
  firstStyle?: boolean
  client?: Partial<ContractImpl<StyleLibraryApi>>
  shell?: Partial<ShellState>
  props?: Partial<StyleEditorProps>
  /** The window is narrow: the two cards stack and the file list is shortened. */
  stacked?: boolean
}

/** happy-dom is 1024px wide: pretend the window is wide, or narrow when asked. */
function stubMedia(matches: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {}
  })) as unknown as typeof window.matchMedia
}

/** Renders the editor for `view` (null = an empty draft with no style yet). */
export function renderEditor({
  view,
  styleId = view ? view.id : null,
  mode = 'new',
  firstStyle = false,
  client = {},
  shell,
  props,
  stacked = false
}: HarnessOptions) {
  stubMedia(stacked)
  const styles = fakeStyles(view, client)
  const clients = createFakeClients({ 'style-library': styles })
  const result = renderWithApp(
    <StyleEditor
      styleId={styleId}
      mode={mode}
      firstStyle={firstStyle}
      active
      onSaved={() => {}}
      {...props}
    />,
    { clients, shell }
  )
  return { ...result, styles, clients }
}
