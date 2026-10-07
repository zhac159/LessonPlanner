import { useEffect } from 'react'
import { FitControl, PickerSheet, type VersionView } from '@ui/assets'
import { Button, Callout } from '@ui/atoms'
import type { SpotSheetModel } from '../hooks/useSpotFlow'
import type { SpotPick } from '../hooks/useSpotSources'
import { spotSubtitle } from '../logic/spotFlow'
import { SpotAssetsTab } from './SpotAssetsTab'
import { SpotMakeTab } from './SpotMakeTab'
import { SpotOnlineTab } from './SpotOnlineTab'

export interface SpotSheetProps {
  model: SpotSheetModel
  onOpenLibrary(): void
  onAddPictureMaker(): void
}

const STAGE_LABELS = { describing: 'Looking at your pictures…', drawing: 'Drawing…' } as const

/** A13: "Fill this picture spot" with its three tabs, how it should fit and "Place it · next spot". */
export function SpotSheet({ model, onOpenLibrary, onAddPictureMaker }: SpotSheetProps) {
  const { sources, spot, tab } = model
  const pick = sources.pick
  const selected = <T extends SpotPick['tab']>(kind: T): Extract<SpotPick, { tab: T }> | null =>
    pick?.tab === kind ? (pick as Extract<SpotPick, { tab: T }>) : null
  const online = selected('online')
  const made = selected('make')
  const picked = sources.online.results.find((r) => r.id === online?.resultId)
  const progress = sources.make.progress
  const versions: VersionView[] = (progress?.versions ?? []).map((v) => ({
    index: v.index,
    state: v.state,
    thumbSrc: v.thumbDataUrl
  }))
  const lowResolution = model.lowResolution

  // A new spot (or the sheet opening): focus goes to the chosen tab, so the keyboard is inside the sheet at once.
  useEffect(() => {
    document
      .querySelector<HTMLElement>(
        '[aria-label="Fill this picture spot"] [role="tab"][aria-selected="true"]'
      )
      ?.focus()
  }, [spot.elementId])

  return (
    <PickerSheet
      title="Fill this picture spot"
      subtitle={spotSubtitle(spot, model.k, model.n)}
      tab={tab}
      onTabChange={model.setTab}
      onBack={model.close}
      onEscape={model.close}
      onSubmitShortcut={() => void model.placeIt()}
      footer={
        <>
          <Button variant="secondary" disabled={model.placing} onClick={model.skip}>
            Skip
          </Button>
          <Button
            variant="primary"
            loading={model.placing}
            loadingLabel="Placing…"
            disabled={!model.canPlace}
            onClick={() => void model.placeIt()}
          >
            {model.primaryLabel}
          </Button>
        </>
      }
    >
      {tab === 'assets' && (
        <SpotAssetsTab
          library={sources.library}
          suggestions={sources.suggestions}
          search={sources.search}
          onSearch={sources.setSearch}
          selectedId={selected('assets')?.assetId ?? null}
          onPick={(assetId) => sources.setPick({ tab: 'assets', assetId })}
          onFindOnline={() => model.setTab('online')}
          onOpenLibrary={onOpenLibrary}
        />
      )}
      {tab === 'online' && (
        <SpotOnlineTab
          state={sources.online}
          query={sources.onlineQuery}
          onQueryChange={sources.setOnlineQuery}
          onSearch={sources.runOnline}
          freeToUse={sources.freeToUse}
          onFreeToUseChange={sources.setFreeToUse}
          selectedId={online?.resultId ?? null}
          onSelect={(resultId) => sources.setPick({ tab: 'online', resultId })}
          saved={
            picked
              ? {
                  name: sources.savedName,
                  onNameChange: sources.setSavedName,
                  error: sources.nameError,
                  withCredit: picked.licence.requiresCredit
                }
              : null
          }
        />
      )}
      {tab === 'make' && (
        <SpotMakeTab
          status={sources.make.status}
          prompt={sources.makePrompt}
          onPromptChange={sources.setMakePrompt}
          versions={sources.makeVersions}
          onVersionsChange={sources.setMakeVersions}
          onMake={sources.startMake}
          busy={
            sources.make.starting ||
            (progress !== null && progress.stage !== 'done' && progress.stage !== 'error')
          }
          failure={sources.make.failure}
          jobError={progress?.error?.message}
          basedOn={sources.basedOn}
          onRemoveBasis={sources.removeBasis}
          made={versions}
          stageLabel={
            progress && (progress.stage === 'describing' || progress.stage === 'drawing')
              ? STAGE_LABELS[progress.stage]
              : undefined
          }
          selected={made?.version ?? null}
          onSelect={(version) => sources.setPick({ tab: 'make', version })}
          name={sources.savedName}
          onNameChange={sources.setSavedName}
          nameError={sources.nameError}
          onUse={() => void model.placeIt()}
          onTryAgain={() => {
            sources.setPick(null)
            sources.make.reset()
          }}
          onAddPictureMaker={onAddPictureMaker}
        />
      )}
      <FitControl
        target="spot"
        value={model.fit}
        onChange={model.setFit}
        lowResolution={lowResolution}
      />
      {model.error && <Callout variant="error">{model.error}</Callout>}
    </PickerSheet>
  )
}
