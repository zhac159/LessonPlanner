import { useCallback, useEffect, useRef, useState } from 'react'
import { useShell, type ModuleViewProps, type NavIntent } from '@renderer/sdk'
import { EditorScreen } from './editor/EditorScreen'
import { routeForIntent, type Route } from './editor/logic/route'
import { CreateLessonRoute } from './editor/parts/CreateLessonRoute'
import { NewLessonScreen } from './newLesson'

const NEW_LESSON: Route = { screen: 'new-lesson' }

/**
 * The deck-builder module's router. The shell says where to go with an intent (03 §8, 05 §2, 06 §2):
 *
 *   { kind: 'new-lesson' }                    the New lesson screen
 *   { kind: 'create-lesson', request }        make the lesson from Home's quick card, then open it generating
 *   { kind: 'open-lesson', lessonId }         the editor
 *
 * `open-lesson` and `new-lesson` may carry `composerText` (the Assets page's "Use in a lesson"): it goes into the
 * chat box, which takes focus.
 *
 * The module stays mounted when the teacher visits another page, so an open lesson (and its chat draft) is still
 * there when she comes back. Opening the same lesson again re-reads it.
 */
export function DeckBuilderView({ active }: ModuleViewProps) {
  const { intent, consumeIntent, navigate } = useShell()
  const [route, setRoute] = useState<Route>(() => (intent && routeForIntent(intent)) || NEW_LESSON)
  const [epoch, setEpoch] = useState(0)
  const [reloadToken, setReloadToken] = useState(0)
  const seen = useRef<NavIntent | null>(intent)
  const current = useRef(route)
  current.current = route

  useEffect(() => {
    // A page that is mounted but hidden must not take (consume) an intent meant for the page being opened.
    if (!intent || !active) return
    if (seen.current !== intent) {
      seen.current = intent
      const next = routeForIntent(intent)
      if (next) {
        const open = current.current
        if (
          next.screen === 'editor' &&
          open.screen === 'editor' &&
          open.lessonId === next.lessonId
        ) {
          setReloadToken((n) => n + 1)
          setRoute(next)
          setEpoch((n) => n + 1)
        } else {
          setRoute(next)
          setEpoch((n) => n + 1)
        }
      }
    }
    consumeIntent()
  }, [active, intent, consumeIntent])

  const toHome = useCallback(() => navigate('home'), [navigate])
  const openLesson = useCallback((lessonId: string) => setRoute({ screen: 'editor', lessonId }), [])
  const connectClaude = useCallback(() => navigate('settings', { kind: 'ai' }), [navigate])

  switch (route.screen) {
    case 'editor':
      return (
        <EditorScreen
          key={route.lessonId}
          lessonId={route.lessonId}
          reloadToken={reloadToken}
          composer={route.composerText ? { text: route.composerText, key: epoch } : undefined}
          active={active}
          onBack={toHome}
          onConnectClaude={connectClaude}
        />
      )
    case 'create-lesson':
      return (
        <CreateLessonRoute
          key={epoch}
          request={route.request}
          onCreated={openLesson}
          onBack={toHome}
        />
      )
    case 'new-lesson':
      return (
        <NewLessonScreen
          key={epoch}
          prefill={route.prefill}
          onOpenLesson={openLesson}
          onBack={toHome}
        />
      )
  }
}
