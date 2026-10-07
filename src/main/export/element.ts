/** Dispatches one deck element to its writer; a failing element never sinks the whole export. */
import type { Element } from '@shared/deck/types'
import { addCalloutElement } from './callout'
import { addChipsElement } from './chips'
import { slideWarn, type SlideContext } from './context'
import { addDiagramElement, addImageElement } from './image'
import { addShapeElement } from './shape'
import { addTableElement } from './table'
import { addTextElement } from './text'

async function write(ctx: SlideContext, el: Element): Promise<void> {
  switch (el.type) {
    case 'text':
      return addTextElement(ctx, el)
    case 'chips':
      return addChipsElement(ctx, el)
    case 'callout':
      return addCalloutElement(ctx, el)
    case 'image':
      return addImageElement(ctx, el)
    case 'diagram':
      return addDiagramElement(ctx, el)
    case 'shape':
      return addShapeElement(ctx, el)
    case 'table':
      return addTableElement(ctx, el)
  }
}

/** Painting order: array order, with an explicit `z` lifting or sinking an element (stable). */
export function paintOrder(elements: readonly Element[]): Element[] {
  return elements
    .map((el, index) => ({ el, index }))
    .sort((a, b) => (a.el.z ?? 0) - (b.el.z ?? 0) || a.index - b.index)
    .map(({ el }) => el)
}

/** Writes every element of a slide in paint order, turning failures into warnings. */
export async function writeElements(
  ctx: SlideContext,
  elements: readonly Element[]
): Promise<void> {
  for (const el of paintOrder(elements)) {
    try {
      await write(ctx, el)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      slideWarn(ctx, `“${el.name ?? el.id}” could not be exported and was left out (${reason}).`)
    }
  }
}
