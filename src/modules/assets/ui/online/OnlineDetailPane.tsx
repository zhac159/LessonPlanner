import { OnlineDetail } from '@ui/assets'
import type { OnlineState } from '../hooks/useOnline'

/** The A9 pane for the selected result: preview, licence notice, the name and "Add to Your assets". */
export function OnlineDetailPane({ online }: { online: OnlineState }) {
  const result = online.selected
  if (!result) return null
  return (
    <OnlineDetail
      title={result.title}
      providerLabel={result.providerLabel}
      licence={result.licence}
      width={result.width}
      height={result.height}
      previewSrc={result.thumbDataUrl}
      name={online.name}
      onNameChange={online.setName}
      nameError={online.nameError}
      adding={online.adding}
      onAdd={() => void online.addSelected()}
      onOpenSource={() => window.open(result.pageUrl, '_blank', 'noopener')}
    />
  )
}
