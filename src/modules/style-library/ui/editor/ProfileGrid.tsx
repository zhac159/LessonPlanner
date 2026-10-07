import type { StyleProfileView } from '@shared/contracts/style-library'
import {
  ColoursSection,
  FontsSection,
  HabitsSection,
  SlideTypesSection,
  TestSlidePreview,
  VoiceSection,
  fromProfileView
} from '@ui/style'
import { previewStyle, slideFor } from '../model/previewSlide'

export interface ProfileGridProps {
  /** Null until the first file is learned: every card shows skeleton rows. */
  profile: StyleProfileView | null
  styleName: string
  /** Claude is applying a correction: the test slide shows its skeleton. */
  correcting: boolean
}

/** The six cards of "What I've learned so far", filling in as files finish (04 §3). */
export function ProfileGrid({ profile, styleName, correcting }: ProfileGridProps) {
  const data = fromProfileView(profile)
  const text = profile?.tokens.colors.text?.hex
  return (
    <div className="cs-grid">
      <ColoursSection colours={data.colours} />
      <FontsSection fonts={data.fonts} textColour={text} />
      <HabitsSection habits={data.habits} />
      <SlideTypesSection names={data.slideTypes} />
      <VoiceSection rules={data.voiceRules} />
      <TestSlidePreview
        slide={profile ? slideFor(profile) : null}
        style={previewStyle(profile, styleName)}
        version={profile?.version}
        loading={correcting}
      />
    </div>
  )
}
