import { useCallback, useRef, useState } from 'react'
import { useClient } from '@renderer/sdk'
import {
  SETTINGS,
  type AiStatus,
  type ModelChoice,
  type SettingsApi
} from '@shared/contracts/settings'
import { asOutcome, type TestOutcome } from '../connect/outcome'
import { useAiStatus } from './useAiStatus'

/** What `runTest` resolves with: the test result, or `format-error` when the typed key was refused. */
export type RunTestResult = TestOutcome | 'format-error'

export interface ConnectClaude {
  status: AiStatus | null
  /** The key as typed. Held only until `setApiKey` succeeds, then cleared (02 §6). */
  keyValue: string
  setKeyValue(value: string): void
  /** Replace mode: a saved key exists but the teacher is typing a new one. */
  replacing: boolean
  startReplace(): void
  keepSaved(): void
  /** Format or storage error for the key field. */
  formError: string | null
  /** Saving the typed key or testing is in progress. */
  busy: boolean
  /** What the pill shows: this session's test, else the last stored one; null while testing. */
  outcome: TestOutcome | null
  /** Saves the typed key (if any), then tests the stored one. */
  runTest(): Promise<RunTestResult>
  /** Reads the connection state again (after the key was removed elsewhere). */
  refreshStatus(): Promise<void>
  /** Saves the model and, when a key is saved, tests again (02 §8 step 5). */
  changeModel(model: ModelChoice): Promise<void>
}

/** State machine of the Connect Claude form, shared by the first-run step and Settings › AI. */
export function useConnectClaude(): ConnectClaude {
  const settings = useClient<SettingsApi>(SETTINGS)
  const { status, setStatus, refresh } = useAiStatus()
  const [keyValue, setKeyValueState] = useState('')
  const [replacing, setReplacing] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sessionOutcome, setSessionOutcome] = useState<TestOutcome | null>(null)
  const running = useRef(false)
  // The latest typed key for callbacks that run after an await.
  const typed = useRef('')

  const setKeyValue = useCallback((value: string) => {
    typed.current = value
    setKeyValueState(value)
    setFormError(null)
  }, [])

  const runTest = useCallback(async (): Promise<RunTestResult> => {
    if (running.current) return 'unknown'
    running.current = true
    setBusy(true)
    setFormError(null)
    try {
      const key = typed.current.trim()
      if (key) {
        const saved = await settings.setApiKey(key)
        if (!saved.ok) {
          setFormError(saved.message)
          return 'format-error'
        }
        setKeyValue('')
        setReplacing(false)
        await refresh()
      }
      setSessionOutcome(null)
      let outcome: TestOutcome
      try {
        const result = await settings.testConnection()
        outcome = result.ok ? 'connected' : asOutcome(result.code)
      } catch {
        outcome = 'unknown'
      }
      setSessionOutcome(outcome)
      return outcome
    } finally {
      running.current = false
      setBusy(false)
    }
  }, [settings, refresh, setKeyValue])

  const changeModel = useCallback(
    async (model: ModelChoice) => {
      setStatus((current) => current && { ...current, model, lastTest: null })
      setSessionOutcome(null)
      await settings.setModel(model)
      const next = await refresh()
      if (next?.hasKey && !typed.current.trim()) await runTest()
    },
    [settings, setStatus, refresh, runTest]
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
    runTest,
    refreshStatus: async () => void (await refresh()),
    changeModel
  }
}
