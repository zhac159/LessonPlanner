import { AssetDetailPanel } from '@ui/assets'
import { Callout } from '@ui/atoms'
import { useAssetDetail } from '../hooks/useAssetDetail'
import type { AssetActions } from '../hooks/useAssetActions'
import type { LessonLinks } from '../hooks/useLessonLinks'

export interface DetailPaneProps {
  assetId: string | null
  actions: Pick<AssetActions, 'askDelete' | 'replaceFile'>
  links: Pick<LessonLinks, 'chooseLesson' | 'showUsage' | 'useDisabledReason'>
}

/** The A1 detail pane for the selected card: edits save in place. */
export function DetailPane({ assetId, actions, links }: DetailPaneProps) {
  const detail = useAssetDetail(assetId)
  const { asset } = detail
  if (!assetId) return null
  if (!asset) {
    return (
      <div className="as-detail-wait" aria-busy="true">
        <Callout variant="soft">Opening the asset…</Callout>
      </div>
    )
  }
  const sourceUrl = asset.credit?.pageUrl
  return (
    <>
      {asset.leftOut && (
        <Callout variant="warning" title="Some parts are not shown">
          This picture has {asset.leftOut} that Slide Planner cannot draw yet. Your file is kept
          exactly as it was.
        </Callout>
      )}
      <AssetDetailPanel
        asset={asset}
        nameError={detail.nameError}
        checkingName={detail.checkingName}
        status={detail.status}
        onNameDraft={detail.setNameDraft}
        onRename={(name) => void detail.rename(name)}
        onTitleCommit={(title) => void detail.setTitle(title)}
        onDescriptionCommit={(text) => void detail.setDescription(text)}
        onTagsChange={(tags) => void detail.setTags(tags)}
        onUseInLesson={() => !links.useDisabledReason && links.chooseLesson(asset)}
        useDisabledReason={links.useDisabledReason}
        onReplaceFile={() => void actions.replaceFile(asset)}
        onDelete={() => actions.askDelete(asset)}
        onOpenUsage={() => void links.showUsage(asset.id)}
        onOpenSource={sourceUrl ? () => window.open(sourceUrl, '_blank', 'noopener') : undefined}
      />
    </>
  )
}
