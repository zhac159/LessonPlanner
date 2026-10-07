/**
 * Circle to edit: the geometry types (design/ai-pipeline.md §6). Pure types, slide units (1920x1080).
 */
import type { Box } from '../deck/layout'

export type { Box }

/** `[x, y]` in slide units. */
export type Point = [number, number]

/**
 * A circled area. `path` is a closed polygon WITHOUT the first point repeated at the end (the last
 * vertex joins the first); every function in this folder also accepts a path that repeats it.
 */
export interface Region {
  id: string
  /** The number drawn on the slide and used in the teacher's text: 1, 2, 3... */
  n: number
  slideId: string
  path: Point[]
  bbox: Box
}
