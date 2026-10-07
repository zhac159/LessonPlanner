/** Sample data for the style gallery and the section tests: the Science KS3 design fixture. */
import styleJson from '../../../../../design/fixtures/style-profile.science-ks3.json'
import type { StyleProfile } from '@shared/style/types'
import { fromProfile } from './learned/learnedView'

export const sampleStyle = styleJson as unknown as StyleProfile

/** What the cards show for the fixture profile. */
export const sampleData = fromProfile(sampleStyle)
