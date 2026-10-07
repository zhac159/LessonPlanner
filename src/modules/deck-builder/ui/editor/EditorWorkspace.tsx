import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Lasso } from 'lucide-react'
import type { LessonView } from '@shared/contracts/deck-builder'
import { Callout } from '@ui/atoms'
import { ToolRail, type EditorTool } from '@ui/editor'
import { ConfirmDialog, useToast } from '@ui/overlays'
import { useAssetEditor } from '../assets/hooks/useAssetEditor'
import { useAssetPictures } from '../assets/hooks/useAssetPictures'
import { composerBox } from '../assets/hooks/useReturnFocus'
import { ExportSpotsDialog } from '../assets/parts/ExportSpotsDialog'
import { EditorChat } from '../chat'
import { CircleLayer } from '../circle'
import { useDeckEdits, type PlanSource } from './hooks/useDeckEdits'
import { usePptxExport } from './hooks/useExport'
import { useGenerationEvents } from './hooks/useGenerationEvents'
import { useHistoryHints } from './hooks/useHistoryHints'
import { useEditorShortcuts } from './hooks/useEditorShortcuts'
import type { UseLesson } from './hooks/useLesson'
import { useLessonEvents } from './hooks/useLessonEvents'
import { useLessonStyle } from './hooks/useLessonStyle'
import { usePresent } from './hooks/usePresent'
import { useRegions } from './hooks/useRegions'
import { useSlideActions } from './hooks/useSlideActions'
import { useSlideSelection } from './hooks/useSlideSelection'
import { useStageEditing } from './hooks/useStageEditing'
import { useStickyNotes } from './hooks/useStickyNotes'
import { useToolRailLock } from './hooks/useToolRailLock'
import { pendingSlides, slidesWithLive, unfinishedSummary } from './logic/generation'
import { renderStyleOf } from './logic/renderStyle'
import { EditorHeader } from './parts/EditorHeader'
import { FilmstripPane } from './parts/FilmstripPane'
import { StoppedBanner } from './parts/LessonStates'
import { PresentMode } from './parts/PresentMode'
import { StagePane } from './parts/StagePane'

export interface EditorWorkspaceProps {
  lessonId: string
  view: LessonView
  lesson: UseLesson
  /** Text for the chat box from a deep link. */
  composer?: { text: string; key: number }
  /** The deck-builder is the visible module: shortcuts only listen then. */
  active: boolean
  onBack(): void
  onConnectClaude(): void
}

/** Tools that cannot be used while the stage is view-only (06 §7). */
const EDIT_TOOLS = ['circle', 'draw', 'text', 'note']

/**
 * A lesson that opened: the header, tool rail, stage, filmstrip and chat (06 §3). It wires the hooks that own the data
 * (`useLesson` results, edits, generation and chat events) to presentational parts and keeps the screen's own state:
 * the active tool, the circled regions and the slide show.
 */
export function EditorWorkspace({
  lessonId,
  view,
  lesson,
  composer,
  active,
  onBack,
  onConnectClaude
}: EditorWorkspaceProps) {
  const toast = useToast()
  const deck = lesson.snapshot?.deck ?? view.deck
  const history = lesson.snapshot?.history ?? view.history
  const edits = useDeckEdits(lessonId, lesson)
  const generation = useGenerationEvents(
    lessonId,
    view.runningJob?.kind === 'generation',
    lesson.refresh
  )
  const events = useLessonEvents(
    lessonId,
    view.runningJob !== null && view.runningJob.kind !== 'generation',
    lesson.refresh
  )
  const busy = generation.view.running || events.chatBusy

  const slides = useMemo(
    () => slidesWithLive(deck.slides, generation.view),
    [deck.slides, generation.view]
  )
  const slideIds = useMemo(() => slides.map((slide) => slide.id), [slides])
  const selection = useSlideSelection(lessonId, slideIds)
  const slide = slides.find((s) => s.id === selection.selection.current) ?? null
  const slideNumber = slide ? slideIds.indexOf(slide.id) + 1 : 0
  const styleProfile = useMemo(() => renderStyleOf(lesson.style), [lesson.style])

  const [tool, setTool] = useState<EditorTool>('select')
  const [highlightSlides, setHighlightSlides] = useState<string[]>([])
  const regions = useRegions(slides)
  const notes = useStickyNotes(lessonId, view.stickyNotes)
  const exporter = usePptxExport(lessonId)
  const lessonStyle = useLessonStyle(lessonId, deck.styleId, selection.selection.current)
  const stageRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const focusStage = useCallback(() => stageRef.current?.focus(), [])

  const present = usePresent(slides.length > 0 && !busy, (index) => {
    if (slides[index]) selection.select(slides[index].id)
    focusStage()
  })

  const changeTool = useCallback(
    (next: EditorTool) => {
      if (next === 'draw') {
        toast.show({ message: 'Drawing for the assistant is coming soon.' })
        return
      }
      if (busy && next !== 'select') return
      setTool(next)
    },
    [busy, toast]
  )
  useEffect(() => {
    if (busy) setTool('select')
  }, [busy])
  useToolRailLock(railRef, busy ? EDIT_TOOLS : ['draw'])
  useHistoryHints(railRef, history)

  const apply = useCallback(
    async (source: PlanSource): Promise<boolean> => {
      if (busy) return false
      return edits.apply(source)
    },
    [busy, edits]
  )
  const editing = useStageEditing(slide, busy, apply, () => setTool('select'))

  const actions = useSlideActions(slides, apply, edits.undo, selection.select)
  const pictures = useAssetPictures(deck, selection.selection.current)
  const assets = useAssetEditor({
    lessonId,
    lesson,
    slides: deck.slides,
    regions,
    onShowSlide: selection.select,
    onSelectElement: editing.select
  })
  // While a picture is being chosen, the element it would replace is hidden so the preview stands in for it.
  const stageSlide = useMemo(
    () =>
      slide && assets.preview?.hideElementId
        ? {
            ...slide,
            elements: slide.elements.filter((e) => e.id !== assets.preview?.hideElementId)
          }
        : slide,
    [slide, assets.preview?.hideElementId]
  )

  const canChange = !busy
  useEditorShortcuts(active && present.presenting === null, {
    onExport: () => {
      if (canChange && slides.length > 0) void exporter.start()
    },
    onPresentFromStart: () => present.start(0),
    onPresentFromCurrent: () => present.start(Math.max(slideNumber - 1, 0))
  })

  const stopped = unfinishedSummary(generation.view)
  const regionSlides = [...new Set(regions.regions.map((region) => region.slideId))]

  return (
    <div className="editor" data-busy={busy || undefined}>
      <EditorHeader
        title={generation.title ?? deck.title}
        busy={busy}
        empty={slides.length === 0}
        exporting={exporter.exporting}
        styles={lessonStyle.styles}
        styleId={deck.styleId}
        onBack={onBack}
        onRename={(title) => void edits.rename(title)}
        onPickStyle={lessonStyle.ask}
        onPresent={() => present.start(Math.max(slideNumber - 1, 0))}
        onExport={() => void exporter.start()}
      />
      <div className="editor__body">
        <div className="editor__main">
          <div ref={railRef} className="editor__rail">
            <ToolRail
              tool={tool}
              onToolChange={changeTool}
              canUndo={history.canUndo && canChange}
              canRedo={history.canRedo && canChange}
              onUndo={() => void edits.undo()}
              onRedo={() => void edits.redo()}
              shortcuts={active && present.presenting === null}
            />
          </div>
          <div className="editor__column">
            <StagePane
              slide={stageSlide}
              resolveAsset={pictures}
              preview={assets.preview}
              onFillSpot={assets.fillSpot}
              slideNumber={slideNumber}
              styleProfile={styleProfile}
              tool={tool}
              onToolChange={changeTool}
              readOnly={busy}
              generating={generation.view.running}
              editing={editing}
              notes={notes}
              slideNotes={notes.notes.filter((note) => note.slideId === slide?.id)}
              onStepSlide={(delta) => selection.step(delta < 0 ? 'prev' : 'next')}
              onAddBlank={() => actions.addAfter(null)}
              stageRef={stageRef}
              layers={(box) =>
                slide && (
                  <CircleLayer
                    slide={slide}
                    regions={regions.regions}
                    highlightedRegionId={regions.highlightedId}
                    active={tool === 'circle'}
                    onAddRegion={regions.add}
                    onRemoveRegion={regions.remove}
                    box={box}
                    onAddAsset={assets.openRegion}
                    onAskClaude={() => composerBox()?.focus()}
                    onExit={() => setTool('select')}
                  />
                )
              }
            />
            {tool === 'circle' && (
              <Callout variant="tip" icon={<Lasso size={18} aria-hidden="true" />}>
                Circle it, then say what you want — the assistant does the rest.
              </Callout>
            )}
            <FilmstripPane
              slides={slides}
              styleProfile={styleProfile}
              selection={selection}
              readOnly={busy}
              pending={pendingSlides(generation.view)}
              reveal={generation.view.running}
              flashIds={events.flashIds}
              highlightIds={highlightSlides}
              regionSlideIds={regionSlides}
              onMove={actions.move}
              onDelete={actions.remove}
              onDuplicate={actions.duplicate}
              onAddAfter={actions.addAfter}
              onFocusStage={focusStage}
              resolveAsset={pictures}
              spotCounts={assets.spotCounts}
              onSpotBadge={assets.fillFirstOnSlide}
            />
            {stopped && (
              <StoppedBanner
                done={stopped.done}
                total={stopped.total}
                busy={busy}
                onFinish={() => void generation.finish()}
              />
            )}
          </div>
        </div>
        <div className="editor__chat">
          <EditorChat
            lessonId={lessonId}
            deck={deck}
            style={lesson.style}
            initialChat={view.chat}
            runningJob={view.runningJob}
            selectedSlideIds={selection.selection.ids}
            currentSlideId={selection.selection.current}
            regions={regions.regions}
            onRegionsChange={regions.setRegions}
            onHighlightRegion={regions.setHighlightedId}
            onLessonChanged={(change) => lesson.commit(change)}
            onHighlightSlides={setHighlightSlides}
            circleToolActive={tool === 'circle'}
            onConnectClaude={onConnectClaude}
            history={history}
            onSelectSlide={selection.select}
            composerRequest={composer}
            sheet={assets.sheet}
            spots={assets.spots}
          />
        </div>
      </div>
      {present.presenting && (
        <PresentMode
          slides={slides}
          styleProfile={styleProfile}
          startIndex={present.presenting.index}
          onExit={present.exit}
        />
      )}
      <ExportSpotsDialog
        count={exporter.spotsPrompt?.count ?? null}
        busy={exporter.exporting}
        onFill={() => {
          exporter.dismissSpots()
          assets.fillFirst()
        }}
        onExportAnyway={() => void exporter.startIgnoringSpots()}
        onCancel={exporter.dismissSpots}
      />
      <ConfirmDialog
        open={lessonStyle.pending !== null}
        title="Restyle this lesson?"
        message={`All ${slides.length} slides will be redrawn in ${lessonStyle.pending?.name ?? ''}. You can undo this.`}
        confirmLabel="Restyle"
        busy={lessonStyle.restyling}
        onConfirm={() => void lessonStyle.confirm()}
        onCancel={lessonStyle.cancel}
      />
    </div>
  )
}
