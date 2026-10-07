import type { GalleryGroup } from '../gallery'
import { actionSections } from './galleryActions'
import { displaySections } from './galleryDisplay'
import { flowSections } from './galleryFlow'

const gallery: GalleryGroup = {
  title: 'Atoms',
  sections: [...actionSections, ...displaySections, ...flowSections]
}

export default gallery
