import { Check, Images } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { keepLabel } from '@ui/assets'
import { Button, EmptyState, StatusPill } from '@ui/atoms'
import { PageHeader } from '@ui/chrome'
import { ConfirmDialog } from '@ui/overlays'
import { useAssetActions } from '../hooks/useAssetActions'
import { useReview } from '../hooks/useReview'
import { CandidateGrid } from './CandidateGrid'
import { WhereILooked } from './WhereILooked'

export interface ReviewScreenProps {
  /** "‹ Assets", and after Keep (when nothing is still being read). */
  onBack(): void
}

/** A2 "Check what I found": nothing found automatically is saved until she says so. */
export function ReviewScreen({ onBack }: ReviewScreenProps) {
  const problemId = useId()
  const [confirmThrow, setConfirmThrow] = useState(false)
  const view = useRef<ReturnType<typeof useReview> | null>(null)
  const review = useReview(() => {
    // Files still being read keep the batch open for the rest.
    if (!view.current?.data?.stillReading) onBack()
  })
  useEffect(() => {
    view.current = review
  })
  const actions = useAssetActions(() => undefined)
  const { data, status } = review
  const reading = data?.stillReading ?? 0
  const blocked = review.keeping === 0 || review.firstProblem !== null

  if (status === 'ready' && data && data.candidates.length === 0 && reading === 0) {
    return (
      <div className="as-review-page">
        <PageHeader
          variant="bar"
          title="Check what I found"
          back={{ label: 'Assets', onClick: onBack }}
        />
        <div className="as-review-page__body as-review-page__body--empty">
          <EmptyState
            icon={<Images />}
            title="I couldn’t find any pictures to reuse in these files."
            actions={
              <Button variant="primary" onClick={onBack}>
                Back to Assets
              </Button>
            }
          >
            Scanned pages and one-off photos are left out. You can still upload pictures yourself.
          </EmptyState>
        </div>
      </div>
    )
  }

  return (
    <div className="as-review-page">
      <PageHeader
        variant="bar"
        title="Check what I found"
        back={{ label: 'Assets', onClick: onBack }}
        status={
          reading > 0 ? (
            <StatusPill tone="working" size="lg" live>
              {`Still reading ${reading} ${reading === 1 ? 'file' : 'files'}`}
            </StatusPill>
          ) : undefined
        }
        actions={
          <>
            <Button
              variant="primary"
              icon={<Check strokeWidth={2.6} />}
              loading={review.busy}
              aria-disabled={blocked || undefined}
              aria-describedby={review.firstProblem ? problemId : undefined}
              onClick={() => !blocked && void review.accept()}
            >
              {keepLabel(review.keeping)}
            </Button>
            {review.firstProblem && (
              <span id={problemId} className="as-sr-only">
                {`Fix the name of ${review.firstProblem.name} first: ${review.nameErrors[review.firstProblem.id]}`}
              </span>
            )}
          </>
        }
      />
      {status === 'error' ? (
        <div className="as-review-page__body">
          <EmptyState
            icon={<Images />}
            title="Couldn’t open the review"
            actions={<Button onClick={onBack}>Back to Assets</Button>}
          >
            Nothing was added. Go back and try again.
          </EmptyState>
        </div>
      ) : (
        <div className="as-review-page__body">
          <WhereILooked
            batches={data?.batches ?? []}
            adding={actions.adding}
            onFiles={(files) => void actions.drop(files)}
            onBrowse={() => void actions.pick()}
            onThrowAway={() => setConfirmThrow(true)}
            onRetry={(batchId, fileId) => void review.retryFile(batchId, fileId)}
          />
          <CandidateGrid
            candidates={review.candidates}
            found={review.found}
            keeping={review.keeping}
            show={review.show}
            onShowChange={review.setShow}
            nameErrors={review.nameErrors}
            onKeep={review.setKeep}
            onName={review.setName}
            onKind={review.setKind}
          />
        </div>
      )}
      <ConfirmDialog
        open={confirmThrow}
        title="Throw these away?"
        message="Nothing from these files will be saved."
        confirmLabel="Throw away"
        cancelLabel="Keep looking"
        destructive
        onConfirm={() => {
          setConfirmThrow(false)
          void review.dismiss().then((done) => done && onBack())
        }}
        onCancel={() => setConfirmThrow(false)}
      />
    </div>
  )
}
