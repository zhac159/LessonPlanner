import { AssetNameTag } from '@ui/assets'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '@shared/deck/types'
import type { StagePreview } from '../logic/preview'
import './StagePreviewLayer.css'

/** Where the note sits under the box: centred, or pinned to the near edge so a long name stays on the stage. */
export function tagAnchor(box: { x: number; w: number }): 'start' | 'centre' | 'end' {
  const centre = (box.x + box.w / 2) / SLIDE_WIDTH
  return centre > 0.62 ? 'end' : centre < 0.38 ? 'start' : 'centre'
}

/**
 * The live preview on the stage (A11, A13): the picture at the frame `placeAsset` will write, inside a dashed orange
 * box, with the note under it (`leaf_cross_section · fitted to region 1`). Positions are percentages of the slide, so
 * it follows the stage at any size.
 */
export function StagePreviewLayer({ preview }: { preview: StagePreview }) {
  const { box } = preview
  const style = {
    left: `${(box.x / SLIDE_WIDTH) * 100}%`,
    top: `${(box.y / SLIDE_HEIGHT) * 100}%`,
    width: `${(box.w / SLIDE_WIDTH) * 100}%`,
    height: `${(box.h / SLIDE_HEIGHT) * 100}%`
  }
  return (
    <div className="stage-preview" style={style} data-fit={box.fit} data-anchor={tagAnchor(box)}>
      {preview.src && (
        <img
          className="stage-preview__img"
          src={preview.src}
          alt=""
          draggable={false}
          style={{ objectFit: box.fit }}
        />
      )}
      <AssetNameTag live className="stage-preview__tag">
        {preview.tag}
      </AssetNameTag>
    </div>
  )
}
