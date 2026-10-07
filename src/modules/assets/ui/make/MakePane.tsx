import { MakeNewPanel } from '@ui/assets'
import type { AssetSummary } from '@shared/contracts/assets'
import type { MakeNew } from '../hooks/useMakeNew'

export interface MakePaneProps {
  maker: MakeNew
  /** The ticked cards: "Based on". */
  basedOn: readonly AssetSummary[]
  onUntick(asset: AssetSummary): void
  /** "Add a picture maker": opens Settings › AI. */
  onAddPictureMaker(): void
}

/** The A8 right pane: Based on, the request, the versions and Keep, from `useMakeNew`. */
export function MakePane({ maker, basedOn, onUntick, onAddPictureMaker }: MakePaneProps) {
  const info = maker.mode
  const made = maker.versionViews !== null
  return (
    <MakeNewPanel
      basedOn={{
        items: basedOn.map((a) => ({ id: a.id, name: a.name, thumbSrc: a.thumbDataUrl })),
        onRemove: (id) => {
          const asset = basedOn.find((a) => a.id === id)
          if (asset) onUntick(asset)
        }
      }}
      request={{
        prompt: maker.prompt,
        onPromptChange: maker.setPrompt,
        versions: maker.versions,
        onVersionsChange: maker.setVersions,
        onMake: () => void maker.start(),
        busy: maker.busy,
        mode: info?.mode ?? 'unavailable',
        perPictureUsd: info?.perPictureUsd ?? undefined,
        wantsPhoto: maker.wantsPhoto,
        onAddPictureMaker
      }}
      versions={
        maker.versionViews
          ? {
              versions: maker.versionViews,
              selected: maker.selected,
              onSelect: maker.select,
              onRetryVersion: (version: number) => void maker.retryVersion(version),
              stageLabel: maker.stageLabel
            }
          : undefined
      }
      keep={
        made
          ? {
              version: maker.selected,
              name: maker.name,
              onNameChange: maker.setName,
              nameError: maker.nameError,
              onKeep: () => void maker.keep(),
              onTryAgain: () => void maker.tryAgain(),
              busy: maker.keeping
            }
          : undefined
      }
      footnote={
        info?.mode === 'picture-maker' && info.modelLabel
          ? `Pictures made with ${info.modelLabel} carry an invisible Google watermark.`
          : undefined
      }
    />
  )
}
