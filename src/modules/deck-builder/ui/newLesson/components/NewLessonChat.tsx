import { ChatPanel } from '@ui/chat'
import { MAX_DOCUMENTS } from '../buildRequest'
import { LessonIntro, type LessonIntroProps } from './LessonIntro'
import { ComposerBar, type ComposerBarProps } from './ComposerBar'
import { Notices, type NoticesProps } from './Notices'

export interface NewLessonChatProps
  extends
    Pick<LessonIntroProps, 'setup' | 'onSetupChange'>,
    Omit<ComposerBarProps, 'onAttach' | 'creating' | 'documents'>,
    Omit<NoticesProps, 'creating'> {
  /** "Knows your Science style". */
  subtitle: string
  /** Claude cannot be reached: the "Offline" pill. */
  offline: boolean
  documents: ComposerBarProps['documents']
  /** The paperclip and the Dropzone click. */
  onAttach(): void
  /** Files dropped on the Dropzone or anywhere on the panel. */
  onDropFiles(files: File[]): void
  adding: boolean
  creating: boolean
}

/**
 * The chat panel in "generate" mode (05 §3): the intro, set-up chips and Dropzone, then progress and
 * errors, with the tall Composer pinned underneath.
 */
export function NewLessonChat(props: NewLessonChatProps) {
  const { documents, creating, adding, onAttach, onDropFiles } = props
  return (
    <ChatPanel
      className="nl-chat"
      subtitle={props.subtitle}
      offline={props.offline}
      onDropFiles={onDropFiles}
      composer={
        <ComposerBar
          text={props.text}
          onTextChange={props.onTextChange}
          textareaRef={props.textareaRef}
          documents={documents}
          onRemoveDocument={props.onRemoveDocument}
          onAttach={onAttach}
          onSubmit={props.onSubmit}
          creating={creating}
          plugins={props.plugins}
          onManagePlugins={props.onManagePlugins}
        />
      }
    >
      <LessonIntro
        setup={props.setup}
        onSetupChange={props.onSetupChange}
        documentsFull={documents.length >= MAX_DOCUMENTS}
        adding={adding}
        onBrowse={onAttach}
      />
      <Notices
        creating={creating}
        error={props.error}
        retryable={props.retryable}
        needsKey={props.needsKey}
        documentError={props.documentError}
        onRetry={props.onRetry}
        onConnect={props.onConnect}
        onDismissDocumentError={props.onDismissDocumentError}
      />
    </ChatPanel>
  )
}
