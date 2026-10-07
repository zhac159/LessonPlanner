import { Download, Play } from 'lucide-react'
import { Button } from '@ui/atoms'
import { PageHeader } from '@ui/chrome'
import { LessonTitleField } from './LessonTitleField'
import { StyleChip, type StyleChipProps } from './StyleChip'

export interface NewLessonHeaderProps extends Omit<StyleChipProps, 'disabled'> {
  title: string
  onTitleChange(title: string): void
  /** The "My lessons" back button. */
  onBack(): void
}

/**
 * The editor-style header of an empty lesson (05 §3): back, title, style chip, and Present and Export
 * which stay disabled until there are slides.
 */
export function NewLessonHeader({ title, onTitleChange, onBack, ...style }: NewLessonHeaderProps) {
  return (
    <PageHeader
      variant="editor"
      back={{ label: 'My lessons', onClick: onBack }}
      center={<LessonTitleField value={title} onCommit={onTitleChange} />}
      actions={
        <>
          <StyleChip {...style} />
          <Button shape="pill" icon={<Play strokeWidth={2.2} />} disabled>
            Present
          </Button>
          <Button icon={<Download strokeWidth={2.2} />} disabled>
            Export to PowerPoint
          </Button>
        </>
      }
    />
  )
}
