import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useShell } from '@renderer/sdk'
import { cx } from '@ui/atoms'
import { ChatPanel, Composer } from '@ui/chat'
import { PluginMenu, PluginSheet } from '@ui/plugin'
import type { ChatItem } from '@shared/contracts/deck-builder-chat'
import { useAssetNames } from '../assets/hooks/useAssetNames'
import { useAssetsMenu } from '../assets/hooks/useAssetsMenu'
import { useInsertPicker } from '../assets/hooks/useInsertPicker'
import { useMessageChips } from '../assets/hooks/useMessageChips'
import {
  refsOf,
  removeAssetToken,
  unknownNames,
  unknownNamesLine
} from '../assets/logic/composerTokens'
import { renderAssetText } from '../assets/parts/AssetText'
import { ComposerAssetChips } from '../assets/parts/ComposerAssetChips'
import { InsertAssetCard } from '../assets/parts/InsertAssetCard'
import type { EditorChatProps } from '../seams'
import { setSentHighlight } from '../circle/sentHighlight'
import { usePluginHost } from '../plugins'
import { draftChips } from './regions'
import { Transcript } from './Transcript'
import type { EditorChatExtras } from './types'
import { useChatSession } from './useChatSession'
import { useComposerDraft } from './useComposerDraft'
import { useFileActions } from './useFileActions'
import { useOnline } from './useOnline'
import { useStyleName } from './useStyleName'
import './EditorChat.css'

/**
 * The editor's right-hand panel (06 §8.5-§8.7, 07): the conversation, the Composer with its circled-region and asset
 * chips, the "+" menu (Add asset and the plugins) and, in place of the conversation, the plugin options sheet or one
 * of the asset sheets the editor passes in (A11, A13).
 */
export function EditorChat(props: EditorChatProps & EditorChatExtras) {
  const { lessonId, deck, regions, onRegionsChange, onHighlightRegion, onConnectClaude } = props
  const { user, navigate } = useShell()
  const needsKey = user !== null && !user.claudeConnected
  const online = useOnline()
  const styleName = useStyleName(deck.styleId)
  const draft = useComposerDraft(lessonId)
  const files = useFileActions()
  const wrapper = useRef<HTMLDivElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const plus = useRef<HTMLElement | null>(null)

  const session = useChatSession({
    lessonId,
    deck,
    initialChat: props.initialChat,
    runningJob: props.runningJob,
    currentSlideId: props.currentSlideId,
    regions,
    needsKey,
    onLessonChanged: props.onLessonChanged,
    history: props.history
  })
  const host = usePluginHost({
    lessonId,
    deck,
    selectedSlideIds: props.selectedSlideIds,
    currentSlideId: props.currentSlideId,
    regions,
    busy: session.busy,
    chat: session
  })

  const names = useAssetNames(draft.text)
  const unknown = names.settled ? unknownNames(draft.text, names.lookup) : []
  const composerChips = useMemo(
    () => [...new Map([...names.chips.values()].map((chip) => [chip.assetId, chip])).values()],
    [names.chips]
  )
  const menu = useAssetsMenu()
  const insert = useInsertPicker({
    text: draft.text,
    setText: draft.setText,
    textarea,
    plus,
    onUsed: menu.recordUse
  })
  const messages = useMemo(
    () => session.entries.flatMap((entry) => (entry.kind === 'message' ? [entry.item] : [])),
    [session.entries]
  )
  const messageChips = useMessageChips(messages)
  const renderText = useCallback(
    (text: string) => renderAssetText(text, messageChips),
    [messageChips]
  )

  // The "+" lives inside the Composer: find it once so the menu can return focus to it.
  useEffect(() => {
    plus.current =
      wrapper.current?.querySelector<HTMLElement>('button[aria-label="Plugins"]') ?? null
  }, [])
  // Circling something moves focus to the box so she can type straight away (06 §8.4 step 5).
  const circled = useRef(regions.length)
  useEffect(() => {
    if (regions.length > circled.current) textarea.current?.focus()
    circled.current = regions.length
  }, [regions.length])
  // A deep link (the Assets page's "Use in a lesson") leaves text in the box and focuses it, once per request.
  const request = props.composerRequest
  const applied = useRef<number | null>(null)
  const { setText } = draft
  useEffect(() => {
    if (!request || applied.current === request.key) return
    applied.current = request.key
    setText((current) =>
      current.trim() === '' ? request.text : `${current.trimEnd()} ${request.text}`
    )
    textarea.current?.focus()
  }, [request, setText])
  // Closing the plugin sheet puts focus back on "+" (07 §8.8).
  const pluginSheetOpen = host.sheet !== null
  const wasOpen = useRef(false)
  useEffect(() => {
    if (wasOpen.current && !pluginSheetOpen) plus.current?.focus()
    wasOpen.current = pluginSheetOpen
  }, [pluginSheetOpen])
  const sheetOpen = pluginSheetOpen || !!props.sheet

  const handleSend = useCallback(async (): Promise<void> => {
    const sent = { ...draft.draft, assetRefs: refsOf(names.refs, draft.text) }
    const sentRegions = regions
    if (needsKey) return void (await session.send(sent))
    draft.clear()
    onRegionsChange([])
    if (!(await session.send(sent))) {
      draft.restore(sent)
      onRegionsChange(sentRegions)
    }
  }, [draft, names.refs, regions, needsKey, session, onRegionsChange])

  const handleChange = (text: string): void => {
    // "/" as the first character of an empty box opens the plugin menu (06 §8.7).
    if (draft.text === '' && text === '/') host.setMenuOpen(true)
    else {
      draft.setText(text)
      insert.onTextChange(text)
    }
  }

  const onErrorAction = useCallback(
    (item: ChatItem): void =>
      files.errorAction(item, {
        retry: () => void (item.pluginId ? host.rerunLast() : session.resend()),
        settings: onConnectClaude,
        finish: () => void session.finishGeneration()
      }),
    [files, host, session, onConnectClaude]
  )

  const stage = {
    onUndo: (id: string) => void session.results.undo(id),
    onRedo: (id: string) => void session.results.redo(id),
    onHighlightSlides: props.onHighlightSlides,
    onHighlightSent: setSentHighlight,
    onSelectSlide: props.onSelectSlide,
    onErrorAction,
    onOpenFile: files.open,
    onShowFile: files.show
  }

  return (
    <div className="editor-chat" ref={wrapper}>
      <ChatPanel
        className={cx('editor-chat__panel', sheetOpen && 'editor-chat__panel--hidden')}
        subtitle={
          deck.styleId === null
            ? 'Ready to plan with you'
            : styleName
              ? `Knows your ${styleName} style`
              : undefined
        }
        status={session.busy ? { label: 'Working', tone: 'working' } : undefined}
        offline={!online}
        onDropFiles={(dropped) => void draft.addFiles(dropped)}
        composer={
          <div className="editor-chat__composer" onKeyDownCapture={insert.onKeyDownCapture}>
            {insert.mode && (
              <div ref={insert.card} className="editor-chat__picker">
                <InsertAssetCard
                  library={insert.library}
                  typedQuery={insert.typedQuery}
                  onPick={insert.pick}
                  onClose={() => insert.close(insert.mode === 'sheet' ? 'plus' : 'box')}
                  onOpenLibrary={() => navigate('assets', { kind: 'library' })}
                  onFindOnline={() => navigate('assets', { kind: 'online' })}
                />
              </div>
            )}
            <PluginMenu
              open={host.menuOpen}
              plugins={host.plugins}
              unavailableReason={host.reasonFor}
              returnFocusRef={plus}
              addAsset={{ onChoose: insert.openSheet, showNew: menu.showNew }}
              onSelect={(plugin) => void host.choose(plugin)}
              onClose={() => host.setMenuOpen(false)}
              onManage={files.managePlugins}
            />
            <Composer
              value={draft.text}
              onChange={handleChange}
              onSend={() => void handleSend()}
              onStop={session.stop}
              busy={session.busy}
              attachments={draft.cards}
              onRemoveAttachment={draft.remove}
              regions={draftChips(regions, deck)}
              onRemoveRegion={(id) => onRegionsChange(regions.filter((r) => r.id !== id))}
              onHighlightRegion={onHighlightRegion}
              staged={
                <ComposerAssetChips
                  chips={composerChips}
                  onRemove={(name) => draft.setText(removeAssetToken(draft.text, name))}
                />
              }
              sendBlocked={unknown.length > 0}
              notice={unknownNamesLine(unknown) || undefined}
              onAttach={() => void draft.pick()}
              onPlus={() => host.setMenuOpen(!host.menuOpen)}
              pluginsOpen={host.menuOpen}
              onPasteFiles={(pasted) => void draft.addFiles(pasted)}
              textareaRef={textarea}
            />
          </div>
        }
      >
        <Transcript
          entries={session.entries}
          live={session.live}
          deck={deck}
          history={session.history}
          busyChangeSetId={session.results.busyId}
          actions={stage}
          onStop={session.stop}
          onConnectClaude={onConnectClaude}
          renderText={renderText}
          spots={props.spots}
        />
      </ChatPanel>
      {props.sheet}
      {host.sheet && (
        <PluginSheet
          manifest={host.sheet.manifest}
          lastInputs={host.sheet.lastInputs}
          slides={host.slides}
          jobRunning={session.busy}
          submitting={host.submitting}
          needsKey={needsKey}
          onConnect={onConnectClaude}
          onSubmit={(values) => void host.submit(values)}
          onBack={host.back}
          onCancel={host.cancel}
        />
      )}
    </div>
  )
}
