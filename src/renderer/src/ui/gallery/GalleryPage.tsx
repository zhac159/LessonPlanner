import { Gallery } from './Gallery'
import { collectGalleries } from './galleryModel'

/**
 * Each UI area registers its specimens by adding `src/renderer/src/ui/<area>/gallery.tsx` with a
 * default export `{ title, sections }`. Nothing else needs editing.
 */
const found = import.meta.glob('../*/gallery.tsx', { eager: true, import: 'default' })
const { groups, skipped } = collectGalleries(found)

/** The gallery with every discovered area. */
export function GalleryPage() {
  return <Gallery groups={groups} skipped={skipped} />
}
