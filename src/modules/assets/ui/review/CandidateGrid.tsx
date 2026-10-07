import type { ReviewCandidate } from '@shared/contracts/assets'
import type { AssetKind } from '@shared/assets/types'
import { AssetGrid, ReviewFilter, ReviewRow, foundSummary, type ReviewView } from '@ui/assets'
import { Card, CardHeaderBand } from '@ui/atoms'

export interface CandidateGridProps {
  candidates: readonly ReviewCandidate[]
  found: number
  keeping: number
  show: ReviewView
  onShowChange(show: ReviewView): void
  nameErrors: Readonly<Record<string, string>>
  onKeep(id: string, keep: boolean): void
  onName(id: string, name: string): void
  onKind(id: string, kind: AssetKind): void
}

/** The right card of A2: "Found 12 · keeping 9", the All / Keeping / Left out pills and the candidate cards. */
export function CandidateGrid({
  candidates,
  found,
  keeping,
  show,
  onShowChange,
  nameErrors,
  onKeep,
  onName,
  onKind
}: CandidateGridProps) {
  return (
    <Card as="section" variant="page" padding={0} aria-label="Found pictures" className="as-found">
      <CardHeaderBand
        tone="yellow"
        title={foundSummary(found, keeping)}
        trailing={<ReviewFilter value={show} onChange={onShowChange} />}
        padding="18px 24px"
      />
      <div className="as-found__body">
        <AssetGrid
          label="Found pictures"
          layout="results"
          items={candidates}
          getKey={(candidate) => candidate.id}
          empty={<p className="as-nomatch">Nothing here.</p>}
          renderItem={(candidate) => (
            <ReviewRow
              name={candidate.name}
              kind={candidate.kind}
              thumbSrc={candidate.thumbDataUrl}
              decks={candidate.decks}
              keep={candidate.keep}
              leftOut={candidate.leftOut}
              nameError={nameErrors[candidate.id]}
              onKeepChange={(keep) => onKeep(candidate.id, keep)}
              onNameCommit={(name) => onName(candidate.id, name)}
              onKindChange={(kind) => onKind(candidate.id, kind)}
            />
          )}
        />
      </div>
    </Card>
  )
}
