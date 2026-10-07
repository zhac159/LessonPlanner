import { useCallback, useEffect, useRef, useState } from 'react'
import { useShell, type ModuleViewProps } from '@renderer/sdk'
import { useEntryContext, type EntryContext } from './hooks/useEntryContext'
import { StyleEditor } from './editor/StyleEditor'
import { StylesList } from './list/StylesList'

type Route =
  | { kind: 'list' }
  | {
      kind: 'editor'
      key: number
      styleId: string | null
      mode: 'new' | 'edit'
      context: EntryContext
    }

const OWNED_INTENTS = ['new-style', 'edit-style']

const asId = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null

/**
 * The style-library page. Intents: `{ kind: 'new-style', styleId?, firstRun? }` opens Create a style (empty,
 * or on a draft Home already made), `{ kind: 'edit-style', styleId }` opens Edit style. Without an intent
 * (the Styles item in the sidebar) it resumes the open editor, else shows the Styles list, or an empty draft
 * when she has no style yet. Leaving never discards a draft.
 */
export function StyleLibraryView({ active }: ModuleViewProps) {
  const { intent, consumeIntent } = useShell()
  const [route, setRoute] = useState<Route | null>(null)
  const keys = useRef(0)
  // Set once something (an intent or the first-visit default) has decided what to show, so a slow
  // first-visit lookup can never overwrite an editor that an intent has just opened.
  const decided = useRef(false)
  const mounted = useRef(true)
  const loadContext = useEntryContext()

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const openEditor = useCallback(
    async (styleId: string | null, mode: 'new' | 'edit', known?: EntryContext): Promise<void> => {
      const context = known ?? (await loadContext())
      if (!mounted.current) return
      setRoute({ kind: 'editor', key: ++keys.current, styleId, mode, context })
    },
    [loadContext]
  )

  useEffect(() => {
    // A page that is mounted but hidden must not take (consume) an intent meant for the page being opened.
    if (!intent || !active) return
    if (OWNED_INTENTS.includes(intent.kind)) {
      const styleId = asId(intent.styleId)
      decided.current = true
      if (intent.kind === 'edit-style' && !styleId) setRoute({ kind: 'list' })
      else void openEditor(styleId, intent.kind === 'edit-style' ? 'edit' : 'new')
    }
    consumeIntent()
  }, [active, intent, consumeIntent, openEditor])

  useEffect(() => {
    if (!active || decided.current || (intent && OWNED_INTENTS.includes(intent.kind))) return
    decided.current = true
    void loadContext().then((context) => {
      if (!mounted.current) return
      if (context.styleCount === 0) return openEditor(null, 'new', context)
      setRoute((current) => current ?? { kind: 'list' })
    })
  }, [active, intent, loadContext, openEditor])

  if (!route) return null
  if (route.kind === 'list') {
    return (
      <StylesList
        onNew={() => void openEditor(null, 'new')}
        onOpenDraft={(styleId) => void openEditor(styleId, 'new')}
        onEdit={(style) => void openEditor(style.id, style.status === 'draft' ? 'new' : 'edit')}
      />
    )
  }
  return (
    <StyleEditor
      key={route.key}
      styleId={route.styleId}
      mode={route.mode}
      subject={route.context.subject}
      firstStyle={route.context.styleCount === 0}
      active={active}
      onSaved={() => setRoute({ kind: 'list' })}
    />
  )
}
