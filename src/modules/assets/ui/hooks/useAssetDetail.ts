import { useCallback, useEffect, useRef, useState } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import type { AssetDetail, AssetsEvents } from '@shared/contracts/assets'
import type { Result } from '@shared/result'
import { useToast } from '@ui/overlays'
import { MODULE_ID, type AssetsFullApi } from '../../shared'
import { COULDNT_SAVE } from '../model/messages'
import { useDebounced } from './useDebounced'

export interface AssetDetailState {
  asset: AssetDetail | null
  /** The message of the name check; empty while the name is fine. */
  nameError: string | undefined
  checkingName: boolean
  /** A polite line for screen readers ("Saved"). */
  status: string
  setNameDraft(draft: string): void
  rename(name: string): Promise<void>
  setTitle(title: string): Promise<void>
  setDescription(description: string): Promise<void>
  setTags(tags: string[]): Promise<void>
}

/**
 * The asset shown in the detail pane: loaded when the selection changes, refreshed by `assets:changed`.
 * Edits save in place; the name has a live check (150 ms after the last key) and `rename` is the check that counts.
 */
export function useAssetDetail(assetId: string | null): AssetDetailState {
  const client = useClient<AssetsFullApi>(MODULE_ID)
  const toast = useToast()
  const [asset, setAsset] = useState<AssetDetail | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | undefined>()
  const [checkingName, setChecking] = useState(false)
  const [status, setStatus] = useState('')
  const loaded = useRef<string | null>(null)

  const load = useCallback(
    (id: string | null) => {
      if (!id) {
        setAsset(null)
        return Promise.resolve()
      }
      return client
        .get({ assetId: id })
        .then((answer) => {
          if (loaded.current !== id) return
          setAsset(answer.ok ? answer.asset : null)
        })
        .catch(() => loaded.current === id && setAsset(null))
    },
    [client]
  )

  useEffect(() => {
    loaded.current = assetId
    setDraft(null)
    setNameError(undefined)
    setStatus('')
    void load(assetId)
  }, [assetId, load])

  useEvent<AssetsEvents, 'changed'>(MODULE_ID, 'changed', () => void load(loaded.current))

  // The live check: runs 150 ms after the last key, ignores a name that is unchanged.
  const settled = useDebounced(draft, 150)
  useEffect(() => {
    if (settled === null || !asset || settled === asset.name) {
      setNameError(undefined)
      setChecking(false)
      return
    }
    let alive = true
    setChecking(true)
    client
      .checkName({ name: settled, assetId: asset.id })
      .then((check) => alive && setNameError(check.ok ? undefined : check.message))
      .catch(() => undefined)
      .finally(() => alive && setChecking(false))
    return () => {
      alive = false
    }
  }, [settled, asset, client])

  const save = useCallback(
    async (run: () => Promise<Result<object>>, saved: string): Promise<boolean> => {
      try {
        const result = await run()
        if (!result.ok) {
          toast.show({ message: result.message, tone: 'error' })
          return false
        }
        setStatus(saved)
        return true
      } catch {
        toast.show({ message: COULDNT_SAVE, tone: 'error' })
        return false
      }
    },
    [toast]
  )

  const rename = useCallback(
    async (name: string) => {
      if (!asset) return
      const result = await client.rename({ assetId: asset.id, name }).catch(() => null)
      if (result && !result.ok) {
        // The old name stays; the field shows why.
        setNameError(result.message)
        return
      }
      setNameError(undefined)
      setDraft(null)
      setStatus('Name saved')
      void load(asset.id)
    },
    [asset, client, load]
  )

  const edit = useCallback(
    async (change: { title?: string; description?: string; tags?: string[] }, saved: string) => {
      if (!asset) return
      const done = await save(() => client.update({ assetId: asset.id, ...change }), saved)
      if (done) void load(asset.id)
    },
    [asset, client, load, save]
  )

  return {
    asset,
    nameError,
    checkingName,
    status,
    setNameDraft: setDraft,
    rename,
    setTitle: (title) => edit({ title }, 'Title saved'),
    setDescription: (description) => edit({ description }, 'Description saved'),
    setTags: (tags) => edit({ tags }, 'Tags saved')
  }
}
