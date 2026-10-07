import { resolveTextStyle } from '@shared/deck/textStyle'
import type { TextElement } from '@shared/deck/types'
import { useSlideContext } from '../context'
import { FittedText } from './FittedText'

/** Text element: role/styleRef resolve font, colour and size from the profile; two-colour titles come from run colours. */
export function TextView({ element }: { element: TextElement }) {
  const { style } = useSlideContext()
  return (
    <FittedText
      elementId={element.id}
      paragraphs={element.paragraphs}
      textStyle={resolveTextStyle(element, style)}
      align={element.align}
      valign={element.valign}
      shrink={(element.autoFit ?? 'shrink') === 'shrink'}
      width={element.w}
      height={element.h}
    />
  )
}
