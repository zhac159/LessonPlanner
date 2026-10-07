import { useEffect, useMemo, useRef, useState } from 'react'
import { useShell } from '@renderer/sdk'
import type { NewLessonScreenProps } from '../seams'
import type { LessonDraft } from './buildRequest'
import { EmptyStage } from './components/EmptyStage'
import { NewLessonChat } from './components/NewLessonChat'
import { NewLessonHeader } from './components/NewLessonHeader'
import { PastLessonDialog } from './components/PastLessonDialog'
import { useAiReady } from './hooks/useAiReady'
import { useCreateLesson } from './hooks/useCreateLesson'
import { useLessonSetup } from './hooks/useLessonSetup'
import { useLoDocuments } from './hooks/useLoDocuments'
import { useOnline } from './hooks/useOnline'
import { usePastLessons } from './hooks/usePastLessons'
import { usePluginList } from './hooks/usePluginList'
import { useStyleChoice } from './hooks/useStyleChoice'
import './newLesson.css'

/** "Knows your Science style"; "Ready to plan with you" on the plain style (05 §5). */
export const panelSubtitle = (styleName: string | null): string =>
  styleName ? `Knows your ${styleName} style` : 'Ready to plan with you'

/**
 * The New lesson screen (05): an empty editor with the planning buddy in "generate" mode. Nothing is
 * saved until "Make my slides", "Blank slide" or "Start from a past lesson"; then `onOpenLesson`
 * hands the lesson to the editor.
 */
export function NewLessonScreen({ onOpenLesson, onBack, prefill }: NewLessonScreenProps) {
  const { navigate } = useShell()
  const [text, setText] = useState(prefill?.text ?? '')
  const [title, setTitle] = useState(prefill?.title ?? '')
  const [pastOpen, setPastOpen] = useState(false)
  const textarea = useRef<HTMLTextAreaElement>(null)

  const aiReady = useAiReady()
  const online = useOnline()
  const setup = useLessonSetup()
  const style = useStyleChoice()
  const docs = useLoDocuments({ reads: aiReady !== false, onRead: setup.detectFromDocument })
  const plugins = usePluginList()
  const past = usePastLessons(pastOpen)

  const { detectFrom } = setup
  useEffect(() => detectFrom(text), [detectFrom, text])
  useEffect(() => textarea.current?.focus(), [])

  const draft = useMemo<LessonDraft>(
    () => ({
      text,
      title,
      documents: docs.documents,
      styleId: style.styleId,
      setup: setup.setup
    }),
    [text, title, docs.documents, style.styleId, setup.setup]
  )
  const create = useCreateLesson({
    draft,
    aiReady,
    onCreated: onOpenLesson,
    onRemember: setup.remember
  })
  const busy = create.creating !== null

  return (
    <div className="nl">
      <NewLessonHeader
        title={title}
        onTitleChange={setTitle}
        onBack={onBack}
        styles={style.styles}
        styleId={style.styleId}
        onChange={style.choose}
        onCreateStyle={() => navigate('style-library', { kind: 'new-style' })}
      />
      <div className="nl__body">
        <div className="nl__main">
          <EmptyStage
            busy={busy}
            onPastLesson={() => setPastOpen(true)}
            onBlankSlide={() => void create.submit('blank')}
          />
        </div>
        <NewLessonChat
          subtitle={panelSubtitle(style.style?.name ?? null)}
          offline={!online || create.networkFailed}
          text={text}
          onTextChange={setText}
          textareaRef={textarea}
          setup={setup.setup}
          onSetupChange={setup.choose}
          documents={docs.documents}
          documentError={docs.error}
          adding={docs.adding}
          onAttach={() => void docs.pick()}
          onDropFiles={(files) => void docs.drop(files)}
          onRemoveDocument={docs.remove}
          onDismissDocumentError={docs.dismissError}
          creating={busy}
          error={create.error}
          retryable={create.retryable}
          needsKey={create.needsKey}
          onSubmit={() => void create.submit('generate')}
          onRetry={() => void create.retry()}
          onConnect={() => navigate('settings', { kind: 'ai' })}
          plugins={plugins}
          onManagePlugins={() => navigate('plugins')}
        />
      </div>
      <PastLessonDialog
        open={pastOpen}
        status={past.status}
        lessons={past.lessons}
        copying={past.copying}
        error={past.error}
        onClose={() => setPastOpen(false)}
        onUse={(lessonId) => void past.use(lessonId, onOpenLesson)}
      />
    </div>
  )
}
