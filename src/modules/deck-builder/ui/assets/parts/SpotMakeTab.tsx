import {
  BasedOnStrip,
  KeepForm,
  MakeRequestForm,
  VersionPicker,
  type VersionView
} from '@ui/assets'
import { Callout } from '@ui/atoms'
import type { MakeVersions } from '@shared/assets/pictureMaker'
import type { AssetSummary } from '@shared/contracts/assets'
import type { MakeStatus } from '../hooks/useMakeVersions'

export interface SpotMakeTabProps {
  status: MakeStatus | null
  prompt: string
  onPromptChange(prompt: string): void
  versions: MakeVersions
  onVersionsChange(versions: MakeVersions): void
  onMake(): void
  busy: boolean
  failure: string | null
  basedOn: readonly AssetSummary[]
  onRemoveBasis(id: string): void
  /** The versions of the running job; empty before the first "Make". */
  made: readonly VersionView[]
  stageLabel?: string
  selected: number | null
  onSelect(version: number): void
  name: string
  onNameChange(name: string): void
  nameError?: string
  onUse(): void
  onTryAgain(): void
  onAddPictureMaker(): void
  /** The picture maker's error for the job, if any. */
  jobError?: string
}

/** "Make one" tab of A13: the A8 form with the spot's words, versions, and "Use version 3" instead of Keep. */
export function SpotMakeTab(props: SpotMakeTabProps) {
  const mode = props.status?.mode ?? 'unavailable'
  return (
    <>
      <BasedOnStrip
        items={props.basedOn.map((a) => ({ id: a.id, name: a.name, thumbSrc: a.thumbDataUrl }))}
        onRemove={props.onRemoveBasis}
      />
      <MakeRequestForm
        prompt={props.prompt}
        onPromptChange={props.onPromptChange}
        versions={props.versions}
        onVersionsChange={props.onVersionsChange}
        onMake={props.onMake}
        busy={props.busy}
        mode={mode}
        perPictureUsd={props.status?.perPictureUsd ?? undefined}
        onAddPictureMaker={props.onAddPictureMaker}
      />
      {(props.failure || props.jobError) && (
        <Callout variant="error">{props.failure ?? props.jobError}</Callout>
      )}
      {props.made.length > 0 && (
        <>
          <VersionPicker
            versions={props.made}
            selected={props.selected}
            onSelect={props.onSelect}
            stageLabel={props.stageLabel}
          />
          <KeepForm
            verb="Use"
            version={props.selected}
            name={props.name}
            onNameChange={props.onNameChange}
            nameError={props.nameError}
            onKeep={props.onUse}
            onTryAgain={props.onTryAgain}
          />
        </>
      )}
    </>
  )
}
