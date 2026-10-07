/**
 * StylesService: everything about her styles in the main process (design/style-profile.md, 04-create-style.md).
 * Plain class with injected deps (folder, AiService, clock, ids, emit); the `style-library` module is a thin
 * wrapper around it. State lives in memory and is written through to `<dir>/<styleId>/…` on every change.
 */
import type { AddedFiles, StyleDraftView, StyleSummary } from '@shared/contracts/style-library'
import { fail, ok, type Result } from '@shared/result'
import { finaliseCorrected } from '@shared/style/corrections'
import { createDraftProfile } from '@shared/style/draft'
import type { StyleProfile } from '@shared/style/types'
import { StyleCore } from './core'
import { addFiles, removeFile, restoreFile, retryFile } from './fileOps'
import { LearningControl } from './learning'
import { emptyMeta } from './metaSchema'
import type { LearnHandle, StyleState, StylesServiceDeps } from './types'
import { countByStatus } from './views'

export const DEFAULT_STYLE_NAME = 'My style'
export const MAX_NAME_LENGTH = 40

export class StylesService {
  private readonly core: StyleCore
  private readonly learning: LearningControl

  constructor(deps: StylesServiceDeps) {
    this.core = new StyleCore(deps)
    this.learning = new LearningControl(this.core)
  }

  private async find(styleId: string): Promise<StyleState | undefined> {
    await this.core.ready()
    return this.core.states.get(styleId)
  }

  private async withStyle<T extends object>(
    styleId: string,
    run: (state: StyleState) => Promise<Result<T>>
  ): Promise<Result<T>> {
    const state = await this.find(styleId)
    return state ? run(state) : fail('not-found', 'Style not found')
  }

  // ---- reading

  /** Home cards and the style chip: default first, then most recently changed. */
  async listSummaries(): Promise<StyleSummary[]> {
    await this.core.ready()
    return this.core.summaries()
  }

  /** The whole Create a style screen state for one style. */
  get(styleId: string): Promise<Result<{ style: StyleDraftView }>> {
    return this.withStyle(styleId, async (state) => {
      await this.core.refreshPictures(state) // names, thumbnails and what she has saved since
      return ok({ style: this.core.view(state) })
    })
  }

  /** The full profile (for lesson generation). Undefined for unknown styles. */
  async getProfile(styleId: string): Promise<StyleProfile | undefined> {
    const state = await this.find(styleId)
    if (state) await this.core.refreshPictures(state) // rules for assets she has saved since the style was learned
    return state?.profile
  }

  /** The default style's profile, if any style exists. */
  async getDefaultProfile(): Promise<StyleProfile | undefined> {
    await this.core.ready()
    const state = [...this.core.states.values()].find((s) => s.profile.isDefault)
    if (state) await this.core.refreshPictures(state)
    return state?.profile
  }

  // ---- creating, editing, deleting

  /** A new empty draft. The first style ever created becomes the default. */
  async create(name: string = DEFAULT_STYLE_NAME): Promise<{ styleId: string }> {
    await this.core.ready()
    const id = this.core.ids('sty')
    const profile = createDraftProfile(
      id,
      cleanName(name) || DEFAULT_STYLE_NAME,
      this.core.nowIso()
    )
    profile.isDefault = this.core.states.size === 0
    const state: StyleState = { profile, meta: emptyMeta(), analyses: new Map() }
    this.core.states.set(id, state)
    await this.core.commit(state)
    this.core.emitChanged()
    return { styleId: id }
  }

  /**
   * A draft from dropped or picked files. Fails (and creates nothing) when none of the files can be added;
   * the message is the first rejection's reason.
   */
  async createDraft(paths: string[]): Promise<Result<AddedFiles & { styleId: string }>> {
    const { styleId } = await this.create()
    const added = await this.addFiles(styleId, paths)
    if (!added.ok || added.added === 0) {
      await this.delete(styleId)
      return added.ok ? fail('invalid-input', 'None of those files can be added') : added
    }
    return ok({ styleId, added: added.added, rejected: added.rejected })
  }

  /** Renames and/or makes default; local edits with no Claude call. Unchecking the only default is ignored. */
  update(
    styleId: string,
    patch: { name?: string; isDefault?: boolean }
  ): Promise<Result<{ style: StyleDraftView }>> {
    return this.withStyle(styleId, async (state) => {
      if (patch.name !== undefined) {
        const name = cleanName(patch.name)
        if (!name) return fail('invalid-input', 'Give this style a name.')
        await this.core.commit(state, () => {
          state.profile.name = name
          state.meta.nameSource = 'user'
        })
      }
      if (patch.isDefault === true) await this.setDefault(styleId)
      this.core.emitChanged()
      return ok({ style: this.core.view(state) })
    })
  }

  /** Makes this the one default style. */
  setDefault(styleId: string): Promise<Result> {
    return this.withStyle(styleId, async (target) => {
      for (const state of this.core.states.values()) {
        const wanted = state === target
        if (state.profile.isDefault !== wanted) {
          await this.core.commit(state, () => (state.profile.isDefault = wanted))
        }
      }
      this.core.emitChanged()
      return ok()
    })
  }

  /** Deletes a style and its files; if it was the default another style is promoted. */
  delete(styleId: string): Promise<Result> {
    return this.withStyle(styleId, async () => {
      await this.learning.stop(styleId)
      this.core.states.delete(styleId)
      await this.core.store.remove(styleId)
      await this.core.ensureDefault()
      this.core.emitChanged()
      return ok()
    })
  }

  /** Marks the draft as saved: `ready`, or `learning` while files are still being read. */
  save(styleId: string): Promise<Result<{ style: StyleSummary }>> {
    return this.withStyle(styleId, async (state) => {
      if (countByStatus(state, 'learned') === 0)
        return fail('invalid-input', 'Learn at least one file first')
      await this.core.commit(state, () => (state.meta.saved = true))
      this.core.emitChanged()
      return ok({ style: this.core.summaries().find((s) => s.id === styleId)! })
    })
  }

  // ---- files

  /** Validates and copies files into the style, then starts learning them in the background. */
  addFiles(styleId: string, paths: string[]): Promise<Result<AddedFiles>> {
    return this.withStyle(styleId, async (state) => {
      const { added, rejected, sources } = await addFiles(this.core, state, paths)
      for (const file of sources) this.core.emitProgress(state, undefined, { file })
      if (added > 0) {
        this.core.emitChanged()
        this.learning.start(state)
      }
      return ok({ added, rejected })
    })
  }

  /** Removes a file; `undoToken` is the id to pass to `restoreFile` (valid for an hour). */
  removeFile(styleId: string, fileId: string): Promise<Result<{ undoToken: string }>> {
    return this.withStyle(styleId, async (state) => {
      const removed = await removeFile(this.core, state, fileId)
      if (!removed.ok) return removed
      this.core.emitProgress(state)
      this.core.emitChanged()
      if (removed.resynthesise) this.learning.scheduleResynthesis(styleId)
      return ok({ undoToken: removed.undoToken })
    })
  }

  /** Undo of `removeFile` (no new Claude call for files that were already learned). */
  restoreFile(styleId: string, fileId: string): Promise<Result> {
    return this.withStyle(styleId, async (state) => {
      const restored = await restoreFile(this.core, state, fileId)
      if (!restored.ok) return restored
      this.core.emitProgress(state)
      this.core.emitChanged()
      if (restored.learned) this.learning.scheduleResynthesis(styleId)
      else this.learning.start(state)
      return ok()
    })
  }

  retryFile(styleId: string, fileId: string): Promise<Result> {
    return this.withStyle(styleId, async (state) => {
      const retried = await retryFile(this.core, state, fileId)
      if (retried.ok) this.learning.start(state)
      return retried
    })
  }

  // ---- learning

  /**
   * Starts (or joins) the learning job for a style: reads waiting files two at a time, then synthesises.
   * Progress goes out through `emit('progress')`. Resolves to a handle; await `handle.done` for the outcome.
   */
  startLearning(styleId: string): Promise<Result<{ job: LearnHandle }>> {
    return this.withStyle(styleId, async (state) => this.learning.start(state))
  }

  /** "Carry on" after an account or network pause. */
  resume(styleId: string): Promise<Result> {
    return this.withStyle(styleId, async (state) => {
      await this.learning.resume(state)
      return ok()
    })
  }

  /** Cancels a running job; files already learned stay learned. */
  cancelLearning(styleId: string): void {
    this.learning.cancel(styleId)
  }

  /** Resolves when no job is running for the style. */
  whenIdle(styleId: string): Promise<void> {
    return this.learning.whenIdle(styleId)
  }

  /** At app start: carry on with styles that still have waiting files (and are not paused). */
  async resumePending(): Promise<void> {
    await this.core.ready()
    this.learning.resumePending()
  }

  /** Cancels all jobs and timers (app quit, tests). */
  async dispose(): Promise<void> {
    await this.learning.stopAll()
  }

  // ---- corrections

  /**
   * "Anything I got wrong?": Claude returns the corrected profile; it is validated, `version` goes up by one,
   * and the correction is recorded. On any failure nothing changes.
   */
  correct(styleId: string, text: string): Promise<Result<{ message: string; version: number }>> {
    return this.withStyle(styleId, async (state) => {
      const correction = text.trim()
      if (!correction) return fail('invalid-input', 'Tell me what to change')
      if (countByStatus(state, 'learned') === 0)
        return fail('invalid-input', 'Learn at least one file first')
      const before = state.profile
      const result = await this.core.ai.applyStyleCorrection({ profile: before, correction })
      if (!result.ok) return result
      if (state.profile.version !== before.version) {
        return fail('invalid-input', 'The style changed while I was working. Please try again.')
      }
      const finalised = finaliseCorrected(before, result.profile, correction, this.core.nowIso())
      if (!finalised.ok) return finalised
      await this.core.commit(state, () => {
        state.profile = finalised.profile
        state.meta.hasSynthesis = true // from now on the local vote must not overwrite her correction
      })
      await this.core.store.snapshot(state.profile)
      this.core.emitProgress(state, undefined, { partial: state.profile })
      this.core.emitChanged()
      return ok({ message: result.message, version: state.profile.version })
    })
  }
}

const cleanName = (name: string): string => name.trim().slice(0, MAX_NAME_LENGTH).trim()
