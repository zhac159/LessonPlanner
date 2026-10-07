import { useCallback, useEffect, useRef, useState } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import {
  SETTINGS,
  type PictureMakerEvents,
  type PictureMakerModel,
  type PictureMakerStatus,
  type SettingsApi
} from '@shared/contracts/settings'
import { asOutcome, type TestOutcome } from '../connect/outcome'

export interface PictureMaker {
  /** Null until the first answer arrives. */
  status: PictureMakerStatus | null
  /** The Google key as typed. Held only until `setPictureMakerKey` succeeds, then cleared. */
  keyValue: string
  setKeyValue(value: string): void
  /** A saved key exists but a new one is being typed. */
  replacing: boolean
  startReplace(): void
  keepSaved(): void
  /** Format or storage error for the key field. */
  formError: string | null
  /** Saving the typed key or testing is in progress. */
  busy: boolean
  /** What the pill shows: this session's test, else the last stored one; null while busy. */
  outcome: TestOutcome | null
  /** First run: the section is folded into the "skipped" line. */
  collapsed: boolean
  /** Opens a skipped section again (first run). */
  reopen(): void
  /** Saves the typed key, if any, WITHOUT testing it ("Next: your style"). False when it was refused. */
  saveTyped(): Promise<boolean>
  /** Saves the typed key, if any, then runs the free key check. */
  runTest(): Promise<void>
  skip(): Promise<void>
  changeModel(model: PictureMakerModel): Promise<void>
  remove(): Promise<void>
}

/** State machine of the "Add a picture maker" section (A7), shared by the first-run step and Settings › AI. */
export function usePictureMaker(): PictureMaker {
  const settings = useClient<SettingsApi>(SETTINGS)
  const [status, setStatus] = useState<PictureMakerStatus | null>(null)
  const [keyValue, setKeyValueState] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sessionOutcome, setSessionOutcome] = useState<TestOutcome | null>(null)
  const [reopened, setReopened] = useState(false)
  const running = useRef(false)
  // The latest typed key for callbacks that run after an await.
  const typed = useRef('')

  const refresh = useCallback(async (): Promise<PictureMakerStatus | null> => {
    try {
      const next = await settings.getPictureMakerStatus()
      setStatus(next)
      return next
    } catch {
      return null
    }
  }, [settings])

  useEffect(() => {
    void refresh()
  }, [refresh])
  useEvent<PictureMakerEvents>(SETTINGS, 'pictureMakerStatusChanged', setStatus)

  const setKeyValue = useCallback((value: string) => {
    typed.current = value
    setKeyValueState(value)
    setFormError(null)
  }, [])

  const saveTypedKey = useCallback(async (): Promise<boolean> => {
    const key = typed.current.trim()
    if (!key) return true
    const saved = await settings.setPictureMakerKey(key)
    if (!saved.ok) {
      setFormError(saved.message)
      return false
    }
    setKeyValue('')
    setReplacing(false)
    setSessionOutcome(null)
    await refresh()
    return true
  }, [settings, refresh, setKeyValue])

  /** Runs `task` once at a time with the busy flag on. */
  const exclusive = useCallback(async (task: () => Promise<boolean>): Promise<boolean> => {
    if (running.current) return false
    running.current = true
    setBusy(true)
    setFormError(null)
    try {
      return await task()
    } finally {
      running.current = false
      setBusy(false)
    }
  }, [])

  const runTest = useCallback(async (): Promise<void> => {
    await exclusive(async () => {
      if (!(await saveTypedKey())) return false
      setSessionOutcome(null)
      try {
        const result = await settings.testPictureMaker()
        setSessionOutcome(result.ok ? 'connected' : asOutcome(result.code))
      } catch {
        setSessionOutcome('unknown')
      }
      return true
    })
  }, [exclusive, saveTypedKey, settings])

  const changeModel = useCallback(
    async (model: PictureMakerModel): Promise<void> => {
      setStatus((current) => current && { ...current, model, lastTest: null })
      setSessionOutcome(null)
      await settings.setPictureMakerModel(model)
      const next = await refresh()
      // The check is free, so a saved key is looked at again for the new model.
      if (next?.hasKey && !typed.current.trim()) await runTest()
    },
    [settings, refresh, runTest]
  )

  const outcome =
    busy || !status?.hasKey ? null : (sessionOutcome ?? status.lastTest?.result ?? null)

  return {
    status,
    keyValue,
    setKeyValue,
    replacing,
    startReplace: () => setReplacing(true),
    keepSaved: () => {
      setKeyValue('')
      setReplacing(false)
    },
    formError,
    busy,
    outcome,
    collapsed: Boolean(status?.skipped) && !status?.hasKey && !reopened && keyValue === '',
    reopen: () => setReopened(true),
    saveTyped: () => exclusive(saveTypedKey),
    runTest,
    skip: async () => {
      setKeyValue('')
      setReopened(false)
      await settings.skipPictureMaker()
      await refresh()
    },
    changeModel,
    remove: async () => {
      await settings.removePictureMakerKey()
      setSessionOutcome(null)
      await refresh()
    }
  }
}
