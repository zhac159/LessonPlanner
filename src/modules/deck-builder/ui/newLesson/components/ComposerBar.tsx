import { useEffect, useRef, useState, type Ref } from 'react'
import type { PluginSummary } from '@shared/contracts/deck-builder-plugins'
import { Composer } from '@ui/chat'
import { PluginMenu } from '@ui/plugin'
import { LONG_TEXT_HINT, isLongText, type DraftDocument } from '../buildRequest'
import { UNREADABLE } from '../hooks/useLoDocuments'

export const NO_SLIDES_YET = 'Make your slides first'

export interface ComposerBarProps {
  text: string
  onTextChange(text: string): void
  textareaRef?: Ref<HTMLTextAreaElement>
  documents: ReadonlyArray<DraftDocument>
  onRemoveDocument(id: string): void
  /** The paperclip. */
  onAttach(): void
  /** Make my slides (button, or Ctrl+Enter). */
  onSubmit(): void
  /** The lesson is being made: the button says so and does nothing. */
  creating: boolean
  /** Enabled plugins for the "+" menu; they are all unavailable until there are slides. */
  plugins: ReadonlyArray<PluginSummary>
  onManagePlugins(): void
}

/**
 * The tall Composer with the yellow attention ring (05 §3): Enter adds a line, Ctrl+Enter makes the
 * slides. "+" opens the plugin menu with every tile disabled, because no plugin can run on an empty lesson.
 */
export function ComposerBar({
  text,
  onTextChange,
  textareaRef,
  documents,
  onRemoveDocument,
  onAttach,
  onSubmit,
  creating,
  plugins,
  onManagePlugins
}: ComposerBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const plus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    plus.current =
      wrapper.current?.querySelector<HTMLElement>('button[aria-label="Plugins"]') ?? null
  })

  return (
    <div ref={wrapper} className="nl-composer">
      <PluginMenu
        open={menuOpen}
        plugins={[...plugins]}
        returnFocusRef={plus}
        unavailableReason={() => NO_SLIDES_YET}
        onSelect={() => {}}
        onManage={onManagePlugins}
        onClose={() => setMenuOpen(false)}
      />
      <Composer
        mode="generate"
        className="nl-composer__box"
        minRows={7}
        value={text}
        onChange={onTextChange}
        onSend={onSubmit}
        sendLabel={creating ? 'Starting…' : undefined}
        textareaRef={textareaRef}
        placeholder={
          'e.g. Photosynthesis, Y8 set 3. Lots of them mix up respiration and photosynthesis.\nLO1: Describe where photosynthesis happens in a plant'
        }
        attachments={documents.map((doc) => ({
          id: doc.id,
          name: doc.name,
          sizeBytes: doc.sizeBytes,
          kind: doc.kind,
          status: doc.status,
          detail: doc.detail,
          errorText: UNREADABLE
        }))}
        onRemoveAttachment={onRemoveDocument}
        onAttach={onAttach}
        onPlus={() => setMenuOpen((open) => !open)}
        pluginsOpen={menuOpen}
      />
      {isLongText(text) && (
        <p className="nl-composer__hint" role="status">
          {LONG_TEXT_HINT}
        </p>
      )}
    </div>
  )
}
