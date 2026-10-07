import { useCallback, useState } from 'react'
import { useClient } from '@renderer/sdk'
import type { AddedPictures, AssetSummary } from '@shared/contracts/assets'
import type { Result } from '@shared/result'
import { useToast } from '@ui/overlays'
import { MODULE_ID, type AssetsFullApi } from '../../shared'
import { COULDNT_SAVE, addedMessage, rejectionMessages } from '../model/messages'

export interface AssetActions {
  /** Files are being handed to the review queue. */
  adding: boolean
  /** Delete: unused assets go at once with an Undo toast; used ones ask first (`pendingDelete`). */
  askDelete(asset: Pick<AssetSummary, 'id' | 'name' | 'usedInCount'>): void
  pendingDelete: Pick<AssetSummary, 'id' | 'name' | 'usedInCount'> | null
  confirmDelete(): Promise<void>
  cancelDelete(): void
  replaceFile(asset: Pick<AssetSummary, 'id' | 'name'>): Promise<void>
  /** Upload: the native dialog. */
  pick(): Promise<void>
  /** Dropped files (anywhere on the page). */
  drop(files: File[]): Promise<void>
}

/**
 * Everything the library does to assets besides editing them: delete with Undo, Replace file and Upload.
 * `onReview` opens the review screen for a batch that was just started.
 */
export function useAssetActions(onReview: (batchId: string) => void): AssetActions {
  const client = useClient<AssetsFullApi>(MODULE_ID)
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [pendingDelete, setPending] = useState<AssetActions['pendingDelete']>(null)

  const fail = useCallback(
    (message: string): void => void toast.show({ message, tone: 'error' }),
    [toast]
  )

  const remove = useCallback(
    async (asset: Pick<AssetSummary, 'id' | 'name'>) => {
      const result = await client.remove({ assetId: asset.id }).catch(() => null)
      if (!result) return fail(COULDNT_SAVE)
      if (!result.ok) return fail(result.message)
      toast.show({
        message: `${asset.name} deleted`,
        action: {
          label: 'Undo',
          onAction: () => {
            void client
              .restore({ assetId: asset.id })
              .then((undone) => !undone.ok && fail(undone.message))
              .catch(() => fail(COULDNT_SAVE))
          }
        }
      })
    },
    [client, fail, toast]
  )

  const askDelete: AssetActions['askDelete'] = useCallback(
    (asset) => {
      if (asset.usedInCount > 0) setPending(asset)
      else void remove(asset)
    },
    [remove]
  )

  const confirmDelete = useCallback(async () => {
    const asset = pendingDelete
    setPending(null)
    if (asset) await remove(asset)
  }, [pendingDelete, remove])

  const replaceFile = useCallback(
    async (asset: Pick<AssetSummary, 'id' | 'name'>) => {
      const result = await client.replaceFile({ assetId: asset.id }).catch(() => null)
      if (!result) return fail(COULDNT_SAVE)
      if (!result.ok) return fail(result.message)
      if ('cancelled' in result) return
      toast.show({
        message: `${asset.name} now uses the new file. Lessons that already use it keep the old one.`
      })
    },
    [client, fail, toast]
  )

  const started = useCallback(
    (result: Result<AddedPictures | { cancelled: true }>): void => {
      if (!result.ok) return fail(result.message)
      if ('cancelled' in result) return
      rejectionMessages(result.rejected).forEach((message) => toast.show({ message }))
      if (result.accepted > 0) {
        const note = addedMessage(result)
        if (note) toast.show({ message: note })
        onReview(result.batchId)
      }
    },
    [fail, onReview, toast]
  )

  const guarded = useCallback(
    async (run: () => Promise<Result<AddedPictures | { cancelled: true }>>) => {
      setAdding(true)
      try {
        started(await run())
      } catch {
        fail('Couldn’t add those files. Please try again.')
      } finally {
        setAdding(false)
      }
    },
    [fail, started]
  )

  const pick = useCallback(() => guarded(() => client['add:pick']()), [client, guarded])
  const drop = useCallback(
    async (files: File[]) => {
      const paths = files.map((file) => window.api.files.pathFor(file)).filter(Boolean)
      if (paths.length > 0) await guarded(() => client['add:paths']({ paths }))
    },
    [client, guarded]
  )

  return {
    adding,
    askDelete,
    pendingDelete,
    confirmDelete,
    cancelDelete: () => setPending(null),
    replaceFile,
    pick,
    drop
  }
}
