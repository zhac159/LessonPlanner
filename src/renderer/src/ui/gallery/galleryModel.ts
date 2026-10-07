import type { ReactNode } from 'react'

/** One labelled specimen: a component in one state (or a small family of states). */
export interface GallerySection {
  name: string
  render: () => ReactNode
}

/** What each `src/renderer/src/ui/<area>/gallery.tsx` default-exports. */
export interface GalleryGroup {
  title: string
  sections: GallerySection[]
}

/** Safe fragment id for a group title: "Form fields" -> "form-fields". */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'group'
  )
}

const isSection = (value: unknown): value is GallerySection =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as GallerySection).name === 'string' &&
  typeof (value as GallerySection).render === 'function'

const isGroup = (value: unknown): value is GalleryGroup =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as GalleryGroup).title === 'string' &&
  Array.isArray((value as GalleryGroup).sections) &&
  (value as GalleryGroup).sections.every(isSection)

/**
 * Turn the discovered `gallery.tsx` default exports into an ordered list of groups. Anything that
 * does not have the right shape is skipped (and listed in `skipped`) rather than crashing the page.
 */
export function collectGalleries(exports: Record<string, unknown>): {
  groups: GalleryGroup[]
  skipped: string[]
} {
  const groups: GalleryGroup[] = []
  const skipped: string[] = []
  for (const [path, value] of Object.entries(exports)) {
    if (isGroup(value)) groups.push(value)
    else skipped.push(path)
  }
  groups.sort((a, b) => a.title.localeCompare(b.title))
  return { groups, skipped: skipped.sort() }
}
