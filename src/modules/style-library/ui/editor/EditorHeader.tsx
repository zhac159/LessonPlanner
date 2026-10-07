import { Check } from 'lucide-react'
import type { LearnProgress } from '@shared/contracts/style-library'
import { Button, StatusPill } from '@ui/atoms'
import { PageHeader } from '@ui/chrome'
import { describeHeaderPill } from '../model/progressText'

export interface EditorHeaderProps {
  mode: 'new' | 'edit'
  progress: LearnProgress
  canSave: boolean
  saving: boolean
  onBack: () => void
  onSave: () => void
}

/** Back to Home, the title, the learning StatusPill and the always-reachable Save button (04 §3). */
export function EditorHeader({
  mode,
  progress,
  canSave,
  saving,
  onBack,
  onSave
}: EditorHeaderProps) {
  const pill = describeHeaderPill(progress)
  const edit = mode === 'edit'
  return (
    <PageHeader
      variant="bar"
      className="cs-header"
      back={{ label: 'Home', onClick: onBack }}
      title={edit ? 'Edit style' : 'Create a style'}
      status={
        pill && (
          <StatusPill tone={pill.tone} check={pill.check} size="lg" live>
            {pill.text}
          </StatusPill>
        )
      }
      actions={
        <Button
          icon={<Check strokeWidth={2.6} />}
          disabled={!canSave}
          loading={saving}
          loadingLabel="Saving…"
          onClick={onSave}
        >
          {edit ? 'Save changes' : 'Save style'}
        </Button>
      }
    />
  )
}
