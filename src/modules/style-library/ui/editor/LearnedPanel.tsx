import { Sparkles } from 'lucide-react'
import type { LearnProgress, StyleProfileView } from '@shared/contracts/style-library'
import { Card, CardHeaderBand, EmptyState } from '@ui/atoms'
import { CorrectionBox, type PastCorrection } from '@ui/style'
import type { Correction } from '../hooks/useCorrection'
import type { StyleIdentity } from '../hooks/useStyleIdentity'
import { AssetsFoundCard } from './AssetsFoundCard'
import { NameRow } from './NameRow'
import { PictureHabitsCard } from './PictureHabitsCard'
import { ProfileGrid } from './ProfileGrid'

export interface LearnedPanelProps {
  identity: StyleIdentity
  profile: StyleProfileView | null
  /** The draft has no files at all: the panel body is an EmptyState instead of skeleton cards. */
  empty: boolean
  correction: Correction
  corrections: readonly PastCorrection[]
  /** The queue's state: the picture cards show skeleton rows while files are still being looked at. */
  progress: LearnProgress
  /** "Review assets" (with this style's batch) and "Open Assets" (the library). */
  onReviewAssets: (batchId: string | null) => void
  onOpenAssets: () => void
}

const BUSY_STAGES: ReadonlyArray<LearnProgress['stage']> = ['reading', 'pictures', 'synthesising']

/** Skeleton while the pictures are being looked at, "No pictures found" when there are none, else the lines. */
function pictureState(
  profile: StyleProfileView | null,
  progress: LearnProgress
): 'building' | 'none' | 'ready' {
  if (profile === null) return 'building'
  const lines = profile.pictureHabits ?? []
  if (lines.length > 0) return 'ready'
  const looked = profile.assetsFound != null
  return !looked && BUSY_STAGES.includes(progress.stage) ? 'building' : 'none'
}

/** "What I've learned so far": name row, the six learned cards and the correction box (04 §3). */
export function LearnedPanel({
  identity,
  profile,
  empty,
  correction,
  corrections,
  progress,
  onReviewAssets,
  onOpenAssets
}: LearnedPanelProps) {
  const learned = profile !== null
  return (
    <Card as="section" variant="panel" className="cs-panel" aria-labelledby="cs-panel-title">
      <CardHeaderBand
        tone="yellow"
        level={2}
        title={<span id="cs-panel-title">What I’ve learned so far</span>}
        padding="16px 22px"
        trailing="Updates as each file is read"
      />
      <div className="cs-panel__body">
        <NameRow identity={identity} />
        {empty ? (
          <EmptyState icon={<Sparkles />} variant="list" title="Nothing learned yet">
            Add a few of your decks and I’ll show you what I learn here.
          </EmptyState>
        ) : (
          <ProfileGrid profile={profile} styleName={identity.name} correcting={correction.busy} />
        )}
        {!empty && (
          <PictureHabitsCard
            lines={profile?.pictureHabits ?? []}
            state={pictureState(profile, progress)}
            decks={progress.learned}
            chips={profile?.assetsFound?.preview}
          />
        )}
        {!empty && profile?.assetsFound && profile.assetsFound.found > 0 && (
          <AssetsFoundCard
            found={profile.assetsFound}
            onReview={() => onReviewAssets(profile.assetsFound?.batchId ?? null)}
            onOpenAssets={onOpenAssets}
          />
        )}
        {!empty && (
          <fieldset className="cs-correction" disabled={!learned}>
            <CorrectionBox
              value={correction.value}
              onChange={correction.setValue}
              onSubmit={(text) => void correction.submit(text)}
              busy={correction.busy}
              error={correction.error}
              confirmation={correction.confirmation}
              corrections={corrections}
            />
          </fieldset>
        )}
      </div>
    </Card>
  )
}
