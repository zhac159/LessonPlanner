import { Card } from '../../atoms/Card/Card'
import { CardHeaderBand } from '../../atoms/CardHeaderBand/CardHeaderBand'
import { BasedOnStrip, type BasedOnStripProps } from './BasedOnStrip'
import { KeepForm, type KeepFormProps } from './KeepForm'
import { MakeRequestForm, type MakeRequestFormProps } from './MakeRequestForm'
import { VersionPicker, type VersionPickerProps } from './VersionPicker'
import './MakeNewPanel.css'

export interface MakeNewPanelProps {
  basedOn: BasedOnStripProps
  request: MakeRequestFormProps
  /** Present once a job has produced (or is producing) versions. */
  versions?: VersionPickerProps
  /** Present with the versions: the name and the Keep / Try again buttons. */
  keep?: KeepFormProps
  /** "Pictures made with Nano Banana Pro carry an invisible Google watermark." Only in picture-maker mode. */
  footnote?: string
  className?: string
}

/** The A8 right pane: "Make a new one like these" with Based on, the request, the versions and Keep. */
export function MakeNewPanel({
  basedOn,
  request,
  versions,
  keep,
  footnote,
  className
}: MakeNewPanelProps) {
  return (
    <Card
      as="section"
      variant="panel"
      padding={0}
      aria-label="Make a new one like these"
      className={className}
    >
      <CardHeaderBand
        title="Make a new one like these"
        subtitle="Same lines, colours and feel as the ones you picked"
        level={2}
      />
      <div className="as-make-panel">
        <BasedOnStrip {...basedOn} />
        <MakeRequestForm {...request} />
        {versions && (
          <>
            <hr className="as-make-panel__rule" />
            <VersionPicker {...versions} />
            {keep && <KeepForm {...keep} />}
          </>
        )}
        {footnote && <p className="as-make-panel__footnote">{footnote}</p>}
      </div>
    </Card>
  )
}
